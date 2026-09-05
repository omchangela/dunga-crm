import { Request, Response } from 'express'
import prisma                from '../lib/prisma'
import bcrypt                from 'bcryptjs'
import { z }                 from 'zod'
import { sendWelcomeEmail }  from '../lib/config/employeeMail'
import {
    signEmployeeAccess,
    signEmployeeRefresh,
    verifyEmployeeRefresh,
    EMPLOYEE_REFRESH_EXPIRES_MS
} from '../lib/employeeJwt'
import { EmployeeRequest } from '../middleware/employeeAuth'
import {
    SERVICE_TYPES,
    LEAD_SOURCES,
    LEAD_STATUSES
} from '../lib/enums'
import { pdfQueue } from '../lib/queues/pdfQueue'
import supabase, { BUCKET } from '../lib/supabase'

// ─── HELPERS ──────────────────────────────────────

const ROLES = [
    'Sales Executive',
    'Sales Manager',
    'Support',
    'Business Development'
] as const

// generate random password
const generatePassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789@#$'
    let pass = ''
    for (let i = 0; i < 10; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)]
    }
    return pass
}

// get current month target for employee
const getCurrentTarget = async (employeeId: string) => {
    const now   = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    return prisma.employeeTarget.findUnique({
        where: {
            employeeId_month_year: { employeeId, month, year }
        }
    })
}

// calculate achieved amount (sum of project budgets for employee's customers)
const getAchieved = async (employeeId: string, month: number, year: number) => {
    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month, 1)

    const projects = await prisma.project.findMany({
        where: {
            customer: {
                assignedTo: employeeId
            },
            createdAt: {
                gte: start,
                lt:  end
            }
        },
        select: { budget: true, costHistory: true }
    })

    return projects.reduce((sum, p) => {
        const extra = (p.costHistory as any[])?.reduce(
            (s, c) => s + (parseFloat(c.amount) || 0), 0
        ) || 0
        return sum + p.budget + extra
    }, 0)
}

// set cookies
const setEmployeeCookies = (res: Response, access: string, refresh: string) => {
    const isProd = process.env.NODE_ENV === 'production'

    const base = {
        httpOnly: true,
        secure:   isProd,
        sameSite: (isProd ? 'none' : 'lax') as any,
        path:     '/'
    }

    res.cookie('employee_access_token',  access,  { ...base, maxAge: 8 * 60 * 60 * 1000 })
    res.cookie('employee_refresh_token', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

const clearEmployeeCookies = (res: Response) => {
    const isProd = process.env.NODE_ENV === 'production'
    const base = {
        httpOnly: true,
        secure:   isProd,
        sameSite: (isProd ? 'none' : 'lax') as any,
        path:     '/'
    }
    res.clearCookie('employee_access_token',  base)
    res.clearCookie('employee_refresh_token', base)
}

// ─── SCHEMAS ──────────────────────────────────────

const createEmployeeSchema = z.object({
    name:   z.string().min(2,  'Name required'),
    email:  z.string().email('Invalid email'),
    phone:  z.string().optional(),
    role:   z.enum(ROLES).default('Sales Executive'),
    target: z.union([z.string(), z.number()])
             .transform(v => parseFloat(String(v)) || 0).optional()
})

const updateEmployeeSchema = z.object({
    name:     z.string().min(2).optional(),
    email:    z.string().email().optional(),
    phone:    z.string().optional(),
    role:     z.enum(ROLES).optional(),
    isActive: z.boolean().optional()
})

const setTargetSchema = z.object({
    target: z.union([z.string(), z.number()])
             .transform(v => parseFloat(String(v)) || 0),
    month:  z.number().min(1).max(12).optional(),
    year:   z.number().optional()
})

const loginSchema = z.object({
    email:    z.string().email(),
    password: z.string().min(1)
})

const assignLeadSchema = z.object({
    employeeId: z.string().uuid('Valid employee id required')
})

const followUpSchema = z.object({
    note: z.string().min(1, 'Note required')
})

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword:     z.string().min(8, 'Min 8 characters')
})

// ─── ADMIN CONTROLLERS ────────────────────────────

// CREATE employee
export const createEmployee = async (req: Request, res: Response) => {

    const parsed = createEmployeeSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { name, email, phone, role, target } = parsed.data

    const existing = await prisma.employee.findUnique({ where: { email } })

    if (existing) {
        res.status(409).json({
            success: false,
            message: 'Employee with this email already exists'
        })
        return
    }

    const plainPassword = generatePassword()
    const hash          = await bcrypt.hash(plainPassword, 12)

    const employee = await prisma.employee.create({
        data: { name, email, phone: phone || null, role, password: hash }
    })

    // create initial monthly target if provided
    if (target && target > 0) {
        const now = new Date()
        await prisma.employeeTarget.create({
            data: {
                employeeId: employee.id,
                month:      now.getMonth() + 1,
                year:       now.getFullYear(),
                target
            }
        })
    }

    // send welcome email
    let emailSent = false
    try {
        await sendWelcomeEmail({
            email,
            name,
            password: plainPassword,
            role
        })
        emailSent = true
    } catch (err: any) {
        console.error('Welcome email failed:', err.message)
    }

    res.status(201).json({
        success: true,
        message: emailSent
            ? 'Employee created and welcome email sent'
            : 'Employee created (email failed)',
        data: {
            id:       employee.id,
            name:     employee.name,
            email:    employee.email,
            phone:    employee.phone,
            role:     employee.role,
            isActive: employee.isActive,
            emailSent
        }
    })
}

// GET all employees
export const getAllEmployees = async (req: Request, res: Response) => {

    const employees = await prisma.employee.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id:        true,
            name:      true,
            email:     true,
            phone:     true,
            role:      true,
            isActive:  true,
            createdAt: true,
            _count: {
                select: {
                    leads:     true,
                    customers: true
                }
            }
        }
    })

    const now   = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    const withTargets = await Promise.all(
        employees.map(async emp => {
            const target   = await prisma.employeeTarget.findUnique({
                where: {
                    employeeId_month_year: {
                        employeeId: emp.id,
                        month,
                        year
                    }
                }
            })
            const achieved = await getAchieved(emp.id, month, year)

            return {
                ...emp,
                currentTarget: {
                    month,
                    year,
                    target:   target?.target   || 0,
                    achieved,
                    percent:  target?.target
                        ? Math.round((achieved / target.target) * 100)
                        : 0
                }
            }
        })
    )

    res.status(200).json({ success: true, data: withTargets })
}

// GET single employee
export const getEmployee = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const employee = await prisma.employee.findUnique({
        where: { id },
        select: {
            id:        true,
            name:      true,
            email:     true,
            phone:     true,
            role:      true,
            isActive:  true,
            createdAt: true,
            targets:   {
                orderBy: [{ year: 'desc' }, { month: 'desc' }],
                take:    6
            },
            _count: {
                select: {
                    leads:     true,
                    customers: true,
                    followUps: true
                }
            }
        }
    })

    if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const now      = new Date()
    const month    = now.getMonth() + 1
    const year     = now.getFullYear()
    const achieved = await getAchieved(id, month, year)

    res.status(200).json({
        success: true,
        data: {
            ...employee,
            currentMonth: { month, year, achieved }
        }
    })
}

// UPDATE employee
export const updateEmployee = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.employee.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const parsed = updateEmployeeSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    if (data.email && data.email !== existing.email) {
        const taken = await prisma.employee.findUnique({
            where: { email: data.email }
        })
        if (taken) {
            res.status(409).json({
                success: false,
                message: 'Email already used'
            })
            return
        }
    }

    const updated = await prisma.employee.update({
        where: { id },
        data,
        select: {
            id:        true,
            name:      true,
            email:     true,
            phone:     true,
            role:      true,
            isActive:  true,
            updatedAt: true
        }
    })

    res.status(200).json({
        success: true,
        message: 'Employee updated successfully',
        data:    updated
    })
}

// DELETE employee
export const deleteEmployee = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.employee.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    await prisma.employee.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Employee deleted successfully'
    })
}

// SET monthly target
export const setTarget = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.employee.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const parsed = setTargetSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const now   = new Date()
    const month = parsed.data.month || now.getMonth() + 1
    const year  = parsed.data.year  || now.getFullYear()

    const target = await prisma.employeeTarget.upsert({
        where: {
            employeeId_month_year: { employeeId: id, month, year }
        },
        update: { target: parsed.data.target },
        create: {
            employeeId: id,
            month,
            year,
            target: parsed.data.target
        }
    })

    res.status(200).json({
        success: true,
        message: 'Target set successfully',
        data:    target
    })
}

// GET employee stats (admin view)
export const getEmployeeStats = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const employee = await prisma.employee.findUnique({
        where: { id },
        select: {
            id:    true,
            name:  true,
            email: true,
            role:  true
        }
    })

    if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const now   = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    const [
        totalLeads,
        pendingLeads,
        convertedLeads,
        totalCustomers,
        totalFollowUps,
        target,
        achieved,
        recentFollowUps
    ] = await Promise.all([
        prisma.lead.count({ where: { assignedTo: id } }),
        prisma.lead.count({ where: { assignedTo: id, status: 'PENDING' } }),
        prisma.lead.count({ where: { assignedTo: id, status: 'CONVERTED' } }),
        prisma.customer.count({ where: { assignedTo: id } }),
        prisma.leadFollowUp.count({ where: { employeeId: id } }),
        prisma.employeeTarget.findUnique({
            where: {
                employeeId_month_year: { employeeId: id, month, year }
            }
        }),
        getAchieved(id, month, year),
        prisma.leadFollowUp.findMany({
            where:   { employeeId: id },
            orderBy: { followedAt: 'desc' },
            take:    10,
            include: {
                lead: {
                    select: { id: true, fullName: true, phone: true }
                }
            }
        })
    ])

    res.status(200).json({
        success: true,
        data: {
            employee,
            leads: {
                total:     totalLeads,
                pending:   pendingLeads,
                converted: convertedLeads
            },
            customers:  totalCustomers,
            followUps:  totalFollowUps,
            target: {
                month,
                year,
                target:   target?.target || 0,
                achieved,
                percent:  target?.target
                    ? Math.round((achieved / target.target) * 100)
                    : 0,
                remaining: Math.max(0, (target?.target || 0) - achieved)
            },
            recentFollowUps
        }
    })
}

// ─── EMPLOYEE AUTH ─────────────────────────────────

// EMPLOYEE LOGIN
export const employeeLogin = async (req: Request, res: Response) => {

    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { email, password } = parsed.data

    const employee = await prisma.employee.findUnique({ where: { email } })

    if (!employee) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    if (!employee.isActive) {
        res.status(403).json({
            success: false,
            message: 'Account is inactive. Contact admin.'
        })
        return
    }

    const valid = await bcrypt.compare(password, employee.password)

    if (!valid) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    const expiresAt = new Date(Date.now() + EMPLOYEE_REFRESH_EXPIRES_MS)

    const refreshRecord = await prisma.employeeRefreshToken.create({
        data: {
            employeeId: employee.id,
            userAgent:  req.headers['user-agent'] || null,
            ipAddress:  req.ip || null,
            expiresAt
        }
    })

    const accessToken  = signEmployeeAccess({
        employeeId: employee.id,
        role:       employee.role
    })
    const refreshToken = signEmployeeRefresh({
        employeeId: employee.id,
        jti:        refreshRecord.id
    })

    setEmployeeCookies(res, accessToken, refreshToken)

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            id:       employee.id,
            name:     employee.name,
            email:    employee.email,
            role:     employee.role,
            phone:    employee.phone
        }
    })
}

// EMPLOYEE LOGOUT
export const employeeLogout = async (req: Request, res: Response) => {

    const token = req.cookies.employee_refresh_token

    if (token) {
        try {
            const payload = verifyEmployeeRefresh(token)
            await prisma.employeeRefreshToken.updateMany({
                where: { id: payload.jti, revokedAt: null },
                data:  { revokedAt: new Date() }
            })
        } catch {
            // ignore
        }
    }

    clearEmployeeCookies(res)

    res.status(200).json({ success: true, message: 'Logged out successfully' })
}

// GET ME (employee)
export const getEmployeeMe = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId

    if (!employeeId) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
    }

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
            id:        true,
            name:      true,
            email:     true,
            phone:     true,
            role:      true,
            isActive:  true,
            createdAt: true
        }
    })

    if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const now      = new Date()
    const month    = now.getMonth() + 1
    const year     = now.getFullYear()
    const target   = await getCurrentTarget(employeeId)
    const achieved = await getAchieved(employeeId, month, year)

    res.status(200).json({
        success: true,
        data: {
            ...employee,
            target: {
                month,
                year,
                target:    target?.target   || 0,
                achieved,
                percent:   target?.target
                    ? Math.round((achieved / target.target) * 100)
                    : 0,
                remaining: Math.max(0, (target?.target || 0) - achieved)
            }
        }
    })
}

// EMPLOYEE — GET assigned leads
export const getEmployeeLeads = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const page       = parseInt(String(req.query.page  || '1'))
    const limit      = parseInt(String(req.query.limit || '10'))
    const status     = String(req.query.status || '')
    const skip       = (page - 1) * limit

    const where: any = { assignedTo: employeeId }

    if (status && status !== 'ALL') {
        where.status = status
    } else if (!status) {
        where.status = { in: ['PENDING', 'REJECTED'] }
    }

    const [leads, total] = await Promise.all([
        prisma.lead.findMany({
            where,
            skip,
            take:    limit,
            orderBy: { createdAt: 'desc' },
            include: {
                reminders: {
                    where:   { status: 'PENDING' },
                    orderBy: { reminderAt: 'asc' },
                    take:    1
                },
                followUps: {
                    orderBy: { followedAt: 'desc' },
                    take:    3
                }
            }
        }),
        prisma.lead.count({ where })
    ])

    res.status(200).json({
        success: true,
        data: {
            leads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1
            }
        }
    })
}

// EMPLOYEE — GET assigned customers
export const getEmployeeCustomers = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const page       = parseInt(String(req.query.page  || '1'))
    const limit      = parseInt(String(req.query.limit || '10'))
    const skip       = (page - 1) * limit

    const where = { assignedTo: employeeId }

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            skip,
            take:    limit,
            orderBy: { createdAt: 'desc' },
            include: {
                projects: {
                    select: {
                        id:     true,
                        status: true
                    }
                }
            }
        }),
        prisma.customer.count({ where })
    ])

    // same pipeline logic as admin
    const customersWithPipeline = customers.map(c => {
        const pipeline = {
            pending:   c.projects.filter(p => p.status === 'PENDING').length,
            converted: c.projects.filter(p => p.status === 'CONVERTED').length,
            rejected:  c.projects.filter(p => p.status === 'REJECTED').length
        }
        return {
            ...c,
            totalProjects: c.projects.length,
            pipeline
        }
    })

    res.status(200).json({
        success: true,
        data: {
            customers: customersWithPipeline,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1
            }
        }
    })
}

// EMPLOYEE — GET assigned projects
export const getEmployeeProjects = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const status     = String(req.query.status || '')

    const where: any = {
        customer: { assignedTo: employeeId },
        status:   {
            in: ['CONVERTED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
        }
    }

    // allow override via query param
    if (status) {
        const statusList = status.split(',').map(s => s.trim().toUpperCase())
        where.status = { in: statusList }
    }

    const projects = await prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            customer: {
                select: {
                    id:       true,
                    fullName: true,
                    phone:    true
                }
            }
        }
    })

    // resolve developer IDs → objects
    const allDevIds = new Set<string>()
    projects.forEach(p => {
        (p.developers || []).forEach((id: string) => allDevIds.add(id))
    })

    const developers = allDevIds.size > 0
        ? await prisma.developer.findMany({
            where:  { id: { in: Array.from(allDevIds) } },
            select: { id: true, name: true, role: true }
        })
        : []

    const devMap = new Map(developers.map(d => [d.id, d]))

    const result = projects.map(p => ({
        id:               p.id,
        projectName:      p.projectName,
        serviceType:      p.serviceType,
        description:      p.description,
        status:           p.status,
        budget:           p.budget,
        deadline:         p.deadline,
        createdAt:        p.createdAt,
        customerId:       p.customerId,
        clientName:       p.customer.fullName,
        phone:            p.customer.phone,
        developers:       (p.developers || [])
                              .map((id: string) => devMap.get(id))
                              .filter(Boolean),
        estimationPdfUrl: p.estimationPdfUrl,
        projectPdfUrl:    p.projectPdfUrl
    }))

    res.status(200).json({
        success: true,
        data:    result
    })
}

// EMPLOYEE — dashboard stats
export const getEmployeeDashboard = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const now        = new Date()
    const month      = now.getMonth() + 1
    const year       = now.getFullYear()

    const [
        totalLeads,
        pendingLeads,
        convertedLeads,
        totalCustomers,
        totalFollowUps,
        target,
        achieved,
        upcomingReminders,
        recentFollowUps
    ] = await Promise.all([
        prisma.lead.count({ where: { assignedTo: employeeId } }),
        prisma.lead.count({ where: { assignedTo: employeeId, status: 'PENDING' } }),
        prisma.lead.count({ where: { assignedTo: employeeId, status: 'CONVERTED' } }),
        prisma.customer.count({ where: { assignedTo: employeeId } }),
        prisma.leadFollowUp.count({ where: { employeeId } }),
        getCurrentTarget(employeeId),
        getAchieved(employeeId, month, year),
        prisma.reminder.findMany({
            where: {
                status: 'PENDING',
                lead:   { assignedTo: employeeId },
                reminderAt: { gte: now }
            },
            orderBy: { reminderAt: 'asc' },
            take:    5,
            include: {
                lead: {
                    select: {
                        id:       true,
                        fullName: true,
                        phone:    true
                    }
                }
            }
        }),
        prisma.leadFollowUp.findMany({
            where:   { employeeId },
            orderBy: { followedAt: 'desc' },
            take:    5,
            include: {
                lead: {
                    select: {
                        id:       true,
                        fullName: true,
                        phone:    true
                    }
                }
            }
        })
    ])

    res.status(200).json({
        success: true,
        data: {
            leads: {
                total:     totalLeads,
                pending:   pendingLeads,
                converted: convertedLeads
            },
            customers:  totalCustomers,
            followUps:  totalFollowUps,
            target: {
                month,
                year,
                target:    target?.target   || 0,
                achieved,
                percent:   target?.target
                    ? Math.round((achieved / target.target) * 100)
                    : 0,
                remaining: Math.max(0, (target?.target || 0) - achieved)
            },
            upcomingReminders,
            recentFollowUps
        }
    })
}

// EMPLOYEE — change own password
export const employeeChangePassword = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!

    const parsed = changePasswordSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
    })

    if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, employee.password)

    if (!valid) {
        res.status(401).json({
            success: false,
            message: 'Current password is incorrect'
        })
        return
    }

    const hash = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.employee.update({
        where: { id: employeeId },
        data:  { password: hash }
    })

    await prisma.employeeRefreshToken.updateMany({
        where: { employeeId, revokedAt: null },
        data:  { revokedAt: new Date() }
    })

    clearEmployeeCookies(res)

    res.status(200).json({
        success: true,
        message: 'Password changed. Please login again.'
    })
}

// ─── LEAD ACTIONS ──────────────────────────────────

// ASSIGN lead to employee (admin)
export const assignLead = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const lead = await prisma.lead.findUnique({ where: { id } })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const parsed = assignLeadSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const employee = await prisma.employee.findUnique({
        where: { id: parsed.data.employeeId }
    })

    if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found' })
        return
    }

    if (!employee.isActive) {
        res.status(400).json({
            success: false,
            message: 'Cannot assign to inactive employee'
        })
        return
    }

    const updated = await prisma.lead.update({
        where: { id },
        data:  { assignedTo: parsed.data.employeeId }
    })

    res.status(200).json({
        success: true,
        message: `Lead assigned to ${employee.name}`,
        data:    updated
    })
}

// UNASSIGN lead
export const unassignLead = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const lead = await prisma.lead.findUnique({ where: { id } })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const updated = await prisma.lead.update({
        where: { id },
        data:  { assignedTo: null }
    })

    res.status(200).json({
        success: true,
        message: 'Lead unassigned',
        data:    updated
    })
}

// LOG follow-up on lead (employee)
export const logFollowUp = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    // employee can only follow up their own assigned leads
    if (lead.assignedTo !== employeeId) {
        res.status(403).json({
            success: false,
            message: 'This lead is not assigned to you'
        })
        return
    }

    const parsed = followUpSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const followUp = await prisma.leadFollowUp.create({
        data: {
            leadId,
            employeeId,
            note: parsed.data.note
        },
        include: {
            lead: {
                select: { id: true, fullName: true, phone: true }
            },
            employee: {
                select: { id: true, name: true }
            }
        }
    })

    // auto-set followUp flag on lead
    await prisma.lead.update({
        where: { id: leadId },
        data:  { followUp: true }
    })

    res.status(201).json({
        success: true,
        message: 'Follow-up logged successfully',
        data:    followUp
    })
}

// GET follow-ups for a lead
export const getLeadFollowUps = async (req: Request, res: Response) => {

    const leadId = req.params.id as string

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const followUps = await prisma.leadFollowUp.findMany({
        where:   { leadId },
        orderBy: { followedAt: 'desc' },
        include: {
            employee: {
                select: { id: true, name: true, role: true }
            }
        }
    })

    res.status(200).json({ success: true, data: followUps })
}

// GET enums for employees
export const getEmployeeEnums = async (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        data: {
            roles: ROLES
        }
    })
}


// ─── EMPLOYEE PORTAL DETAIL ENDPOINTS ─────────────

// GET single lead (employee — only if assigned to them)
export const getEmployeeLead = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
            followUps: {
                orderBy: { followedAt: 'desc' },
                select: {
                    id:         true,
                    note:       true,
                    followedAt: true,
                    createdAt:  true
                }
            },
            reminders: {
                orderBy: { reminderAt: 'asc' },
                select: {
                    id:         true,
                    reminderAt: true,
                    note:       true,
                    status:     true
                }
            }
        }
    })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Lead not found'
        })
        return
    }

    res.status(200).json({
        success: true,
        data: {
            id:          lead.id,
            fullName:    lead.fullName,
            phone:       lead.phone,
            email:       lead.email,
            state:       lead.state,
            city:        lead.city,
            serviceType: lead.serviceType,
            source:      lead.source,
            status:      lead.status,
            followUp:    lead.followUp,
            createdAt:   lead.createdAt,
            followUps:   lead.followUps,
            reminders:   lead.reminders
        }
    })
}

// GET single customer (employee — only if assigned to them)
export const getEmployeeCustomer = async (req: EmployeeRequest, res: Response) => {

    const customerId = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
            lead: true,
            projects: {
                orderBy: { createdAt: 'desc' },
                include: {
                    subscriptions: {
                        orderBy: { renewalDate: 'asc' }
                    },
                    transactions: {
                        select: { amount: true }
                    }
                }
            }
        }
    })

    if (!customer || customer.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Customer not found'
        })
        return
    }

    // collect all developer IDs across projects
    const allDevIds = new Set<string>()
    customer.projects.forEach(p => {
        (p.developers || []).forEach((devId: string) => allDevIds.add(devId))
    })

    // fetch all developers in one query
    const developers = allDevIds.size > 0
        ? await prisma.developer.findMany({
            where: { id: { in: Array.from(allDevIds) } },
            select: {
                id:         true,
                name:       true,
                role:       true,
                experience: true,
                skills:     true
            }
        })
        : []

    const developerMap = new Map(developers.map(d => [d.id, d]))

    // compute subscription status
    const computeSubStatus = (sub: any): string => {
        if (sub.status === 'Cancelled') return 'Cancelled'
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const renew = new Date(sub.renewalDate)
        renew.setHours(0, 0, 0, 0)
        if (renew < today) return 'Expired'
        return 'Active'
    }

    // calculate total project cost
    const getProjectTotal = (budget: number, costHistory: any[]): number => {
        return (costHistory || []).reduce(
            (sum, c) => sum + (parseFloat(c.amount) || 0), budget
        )
    }

    // enrich projects — same as admin
    const enrichedProjects = customer.projects.map(p => {

        const projectDevs = (p.developers || [])
            .map((devId: string) => developerMap.get(devId))
            .filter(Boolean)

        const totalBudget = getProjectTotal(p.budget, p.costHistory as any[])
        const totalPaid   = p.transactions.reduce((sum, t) => sum + t.amount, 0)
        const remaining   = totalBudget - totalPaid

        const subscriptions = p.subscriptions.map(s => ({
            id:           s.id,
            name:         s.name,
            description:  s.description,
            category:     s.category,
            amount:       s.amount,
            billingCycle: s.billingCycle,
            renewalDate:  s.renewalDate,
            lastPaidAt:   s.lastPaidAt,
            paidUntil:    s.paidUntil,
            status:       computeSubStatus(s)
        }))

        return {
            ...p,
            developers:   projectDevs,
            subscriptions,
            finance: {
                totalBudget,
                totalPaid,
                remainingBalance: remaining
            },
            transactions: undefined
        }
    })

    res.status(200).json({
        success: true,
        data: {
            ...customer,
            projects: enrichedProjects
        }
    })
}

// GET single project (employee — only if from their customer)
export const getEmployeeProject = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            customer: {
                select: {
                    id:                true,
                    fullName:          true,
                    phone:             true,
                    email:             true,
                    applicationNumber: true,
                    assignedTo:        true
                }
            }
        }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    // resolve developer IDs → objects
    const devIds = (project.developers || []) as string[]
    const developers = devIds.length > 0
        ? await prisma.developer.findMany({
            where:  { id: { in: devIds } },
            select: { id: true, name: true, role: true, experience: true, skills: true }
        })
        : []

    const costHistory      = (project.costHistory as any[]) || []
    const totalProjectCost = project.budget + costHistory.reduce(
        (sum, c) => sum + (parseFloat(c.amount) || 0), 0
    )

    res.status(200).json({
        success: true,
        data: {
            id:               project.id,
            projectName:      project.projectName,
            serviceType:      project.serviceType,
            description:      project.description,
            status:           project.status,
            budget:           project.budget,
            contractNumber:   project.contractNumber,
            deadline:         project.deadline,
            webOverview:      project.webOverview,
            appOverview:      project.appOverview,
            adminOverview:    project.adminOverview,
            payments:         project.payments,
            timelines:        project.timelines,
            schedules:        project.schedules,
            featureItems:     project.featureItems,
            costHistory:      project.costHistory,
            totalProjectCost,
            developers,
            estimationPdfUrl: project.estimationPdfUrl,
            estimationPdfAt:  project.estimationPdfAt,
            projectPdfUrl:    project.projectPdfUrl,
            projectPdfAt:     project.projectPdfAt,
            createdAt:        project.createdAt,
            updatedAt:        project.updatedAt,
            customerId:       project.customerId,
            clientName:       project.customer.fullName,
            phone:            project.customer.phone,
            email:            project.customer.email,
            applicationNumber: project.customer.applicationNumber
        }
    })
}

// CREATE project from employee portal
export const createEmployeeProject = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!

    // verify customer belongs to this employee
    const { customerId } = req.body

    if (!customerId) {
        res.status(400).json({
            success: false,
            message: 'customerId is required'
        })
        return
    }

    const customer = await prisma.customer.findUnique({
        where: { id: customerId }
    })

    if (!customer || customer.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Customer not found'
        })
        return
    }

    // reuse exact same schema as admin createProject
    const paymentRowSchema = z.object({
        description: z.string().optional(),
        amount:      z.union([z.string(), z.number()]).optional()
    })

    const timelineRowSchema = z.object({
        description: z.string().optional(),
        workingDays: z.union([z.string(), z.number()]).optional()
    })

    const scheduleRowSchema = z.object({
        description: z.string().optional(),
        payment:     z.union([z.string(), z.number()]).optional()
    })

    const schema = z.object({
        projectName:   z.string().min(2, 'Project name required'),
        description:   z.string().optional(),
        serviceType:   z.enum(SERVICE_TYPES),
        webOverview:   z.array(z.string()).optional(),
        appOverview:   z.array(z.string()).optional(),
        adminOverview: z.array(z.string()).optional(),
        payments:      z.array(paymentRowSchema).optional(),
        timelines:     z.array(timelineRowSchema).optional(),
        schedules:     z.array(scheduleRowSchema).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const {
        projectName,
        description,
        serviceType,
        webOverview,
        appOverview,
        adminOverview,
        payments,
        timelines,
        schedules
    } = parsed.data

    // clean empty rows
    const cleanRows = (rows: any[], fields: string[]) =>
        rows.filter(row => fields.some(f => row[f] && String(row[f]).trim() !== ''))

    const cleanedPayments  = cleanRows(payments  || [], ['description', 'amount'])
    const cleanedTimelines = cleanRows(timelines || [], ['description', 'workingDays'])
    const cleanedSchedules = cleanRows(schedules || [], ['description', 'payment'])

    // calculate budget
    const budget = cleanedPayments.reduce(
        (sum, p) => sum + (parseFloat(p.amount) || 0), 0
    )

    // calculate deadline
    let autoDeadline: Date | null = null
    if (cleanedTimelines.length > 0) {
        const totalDays = cleanedTimelines.reduce(
            (sum, t) => sum + (parseInt(String(t.workingDays)) || 0), 0
        )
        if (totalDays > 0) {
            let calDays = Math.ceil((totalDays * 7) / 5)
            calDays    += Math.floor(calDays / 30) * 2
            autoDeadline = new Date()
            autoDeadline.setDate(autoDeadline.getDate() + calDays)
        }
    }

    const project = await prisma.project.create({
        data: {
            customerId,
            projectName,
            description:   description || null,
            serviceType,
            status:        'PENDING',
            webOverview:   webOverview   || [],
            appOverview:   appOverview   || [],
            adminOverview: adminOverview || [],
            payments:      cleanedPayments  as any,
            timelines:     cleanedTimelines as any,
            schedules:     cleanedSchedules as any,
            budget,
            deadline:      autoDeadline
        },
        include: {
            customer: {
                select: {
                    id:       true,
                    fullName: true,
                    phone:    true,
                    email:    true
                }
            }
        }
    })

    res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data:    project
    })
}
// ─── EMPLOYEE LEAD ACTIONS ─────────────────────────

// CREATE lead (auto-assigned to employee)
export const createEmployeeLead = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!

    const schema = z.object({
        fullName:    z.string().min(2, 'Full name required'),
        phone:       z.string().length(10, 'Phone must be 10 digits'),
        email:       z.string().email().optional().or(z.literal('')),
        state:       z.string().optional(),
        city:        z.string().optional(),
        serviceType: z.enum(SERVICE_TYPES),
        source:      z.enum(LEAD_SOURCES)
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { fullName, phone, email, state, city, serviceType, source } = parsed.data

    const existing = await prisma.lead.findUnique({ where: { phone } })

    if (existing) {
        res.status(409).json({
            success: false,
            message: 'Lead with this phone already exists'
        })
        return
    }

    const lead = await prisma.lead.create({
        data: {
            fullName,
            phone,
            email:       email || null,
            state:       state || null,
            city:        city  || null,
            serviceType,
            source,
            status:      'PENDING',
            followUp:    false,
            assignedTo:  employeeId   // auto-assign to creator
        }
    })

    res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data:    lead
    })
}

// PATCH lead status (employee)
export const updateEmployeeLeadStatus = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const schema = z.object({
        status: z.enum(['PENDING', 'REJECTED'])
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.lead.update({
        where: { id: leadId },
        data:  { status: parsed.data.status }
    })

    res.status(200).json({
        success: true,
        message: `Lead status updated to ${parsed.data.status}`,
        data:    updated
    })
}

// CONVERT lead to customer (employee)
export const convertEmployeeLead = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    if (lead.status === 'CONVERTED') {
        res.status(400).json({
            success: false,
            message: 'Lead already converted'
        })
        return
    }

    // check if customer already exists for this lead
    const existingCustomer = await prisma.customer.findUnique({
        where: { leadId }
    })

    if (existingCustomer) {
        res.status(400).json({
            success: false,
            message: 'Customer already exists for this lead'
        })
        return
    }

    // generate application number
    const now    = new Date()
    const year   = now.getFullYear()
    const month  = String(now.getMonth() + 1).padStart(2, '0')
    const rand   = Math.random().toString(36).substring(2, 6).toUpperCase()
    const appNum = `APP-${year}${month}-${rand}`

    const [customer] = await prisma.$transaction([
        prisma.customer.create({
            data: {
                fullName:          lead.fullName,
                phone:             lead.phone,
                email:             lead.email,
                state:             lead.state,
                city:              lead.city,
                serviceType:       lead.serviceType,
                applicationNumber: appNum,
                leadId:            lead.id,
                assignedTo:        employeeId
            }
        }),
        prisma.lead.update({
            where: { id: leadId },
            data:  { status: 'CONVERTED' }
        })
    ])

    res.status(201).json({
        success: true,
        message: 'Lead converted to customer',
        data:    { id: customer.id }
    })
}

// TOGGLE follow-up flag (employee)
export const toggleEmployeeLeadFollowUp = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const updated = await prisma.lead.update({
        where: { id: leadId },
        data:  { followUp: !lead.followUp }
    })

    res.status(200).json({
        success: true,
        message: `Follow-up ${updated.followUp ? 'enabled' : 'disabled'}`,
        data:    updated
    })
}

// CREATE reminder on lead (employee)
export const createEmployeeLeadReminder = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const schema = z.object({
        reminderAt: z.string().datetime('Invalid date format'),
        note:       z.string().optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const reminder = await prisma.reminder.create({
        data: {
            leadId,
            reminderAt: new Date(parsed.data.reminderAt),
            note:       parsed.data.note || null,
            status:     'PENDING'
        },
        include: {
            lead: {
                select: {
                    id:          true,
                    fullName:    true,
                    phone:       true,
                    serviceType: true,
                    followUp:    true
                }
            }
        }
    })

    res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        data:    reminder
    })
}

// ─── EMPLOYEE ESTIMATION ────────────────────────────

// GET estimation list (employee's pending/rejected projects)
export const getEmployeeEstimation = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!

    const projects = await prisma.project.findMany({
        where: {
            status:   { in: ['PENDING', 'REJECTED'] },
            customer: { assignedTo: employeeId }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            customer: {
                select: {
                    id:       true,
                    fullName: true,
                    phone:    true
                }
            }
        }
    })

    const data = projects.map(p => ({
        id:               p.id,
        projectName:      p.projectName,
        serviceType:      p.serviceType,
        clientName:       p.customer.fullName,
        clientPhone:      p.customer.phone,
        status:           p.status,
        budget:           p.budget,
        payments:         p.payments,
        webOverview:      p.webOverview,
        appOverview:      p.appOverview,
        adminOverview:    p.adminOverview,
        timelines:        p.timelines,
        estimationPdfUrl: p.estimationPdfUrl,
        customerId:       p.customerId,
        createdAt:        p.createdAt
    }))

    res.status(200).json({
        success: true,
        data:    { projects: data }
    })
}

// ─── EMPLOYEE PROJECT ACTIONS ───────────────────────

// PATCH project status (employee)
export const updateEmployeeProjectStatus = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const schema = z.object({
        status:   z.enum([
            'PENDING', 'REJECTED', 'CONVERTED',
            'ACTIVE',  'COMPLETED', 'ON_HOLD', 'CANCELLED'
        ]),
        payments: z.array(z.any()).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updateData: any = { status: parsed.data.status }

    if (parsed.data.payments) {
        updateData.payments = parsed.data.payments
        updateData.budget   = parsed.data.payments.reduce(
            (sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0
        )
    }

    const updated = await prisma.project.update({
        where: { id: projectId },
        data:  updateData
    })

    res.status(200).json({
        success: true,
        message: `Project status updated to ${parsed.data.status}`,
        data:    updated
    })
}

// PATCH project fields (employee)
export const updateEmployeeProject = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const schema = z.object({
        projectName:   z.string().min(2).optional(),
        description:   z.string().optional(),
        serviceType:   z.enum(SERVICE_TYPES).optional(),
        webOverview:   z.array(z.string()).optional(),
        appOverview:   z.array(z.string()).optional(),
        adminOverview: z.array(z.string()).optional(),
        payments:      z.array(z.any()).optional(),
        timelines:     z.array(z.any()).optional(),
        schedules:     z.array(z.any()).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // recompute budget if payments changed
    if (data.payments) {
        data.budget = data.payments.reduce(
            (sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0
        )
    }

    // recalculate deadline if timelines changed
    if (data.timelines && data.timelines.length > 0) {
        const totalDays = data.timelines.reduce(
            (sum: number, t: any) => sum + (parseInt(t.workingDays) || 0), 0
        )
        if (totalDays > 0) {
            let calDays = Math.ceil((totalDays * 7) / 5)
            calDays    += Math.floor(calDays / 30) * 2
            const dl    = new Date(project.createdAt)
            dl.setDate(dl.getDate() + calDays)
            data.deadline = dl
        }
    }

    const updated = await prisma.project.update({
        where: { id: projectId },
        data
    })

    res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data:    updated
    })
}

// GENERATE estimation PDF (employee)
export const generateEmployeeEstimationPdf = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: {
            customer: {
                select: {
                    id:                true,
                    fullName:          true,
                    phone:             true,
                    email:             true,
                    applicationNumber: true,
                    assignedTo:        true
                }
            }
        }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const job = await pdfQueue.add(
        `estimation-${projectId}`,
        { projectId, type: 'ESTIMATION' },
        { jobId: `estimation-${projectId}-${Date.now()}` }
    )

    res.status(202).json({
        success: true,
        message: 'PDF generation queued',
        data: {
            jobId:     job.id,
            projectId,
            status:    'queued'
        }
    })
}

// GET estimation PDF status (employee)
export const getEmployeeEstimationPdfStatus = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id  as string
    const jobId      = req.params.jobId as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const job = await pdfQueue.getJob(jobId)

    if (!job) {
        res.status(404).json({
            success: false,
            message: 'Job not found or expired'
        })
        return
    }

    const state    = await job.getState()
    const progress = job.progress as number
    const result   = job.returnvalue
    const failErr  = job.failedReason

    const messages: Record<string, string> = {
        'waiting':   'Queued, waiting to start...',
        'active':    getPdfProgressMessage(progress),
        'completed': 'PDF ready',
        'failed':    `Failed: ${failErr}`,
        'delayed':   'Retrying...',
        'unknown':   'Unknown status'
    }

    res.status(200).json({
        success: true,
        data: {
            jobId,
            state,
            progress,
            message: messages[state] || 'Processing...',
            result:  state === 'completed' ? result : null,
            error:   state === 'failed'    ? failErr : null
        }
    })
}

// DOWNLOAD estimation PDF (employee)
export const downloadEmployeeEstimationPdf = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    if (!project.estimationPdfUrl) {
        res.status(404).json({
            success: false,
            message: 'No estimation PDF generated yet'
        })
        return
    }

    const filePath = extractStoragePath(project.estimationPdfUrl)

    if (!filePath) {
        res.status(500).json({ success: false, message: 'Invalid PDF path' })
        return
    }

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600)

    if (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate download URL'
        })
        return
    }

    res.status(200).json({
        success: true,
        data: { downloadUrl: data.signedUrl }
    })
}

// GENERATE project PDF (employee)
export const generateEmployeeProjectPdf = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const job = await pdfQueue.add(
        `project-pdf-${projectId}`,
        { projectId, type: 'PROJECT' },
        { jobId: `project-${projectId}-${Date.now()}` }
    )

    res.status(202).json({
        success: true,
        message: 'Project PDF generation queued',
        data: {
            jobId:     job.id,
            projectId,
            status:    'queued'
        }
    })
}

// GET project PDF status (employee)
export const getEmployeeProjectPdfStatus = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id   as string
    const jobId      = req.params.jobId as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const job = await pdfQueue.getJob(jobId)

    if (!job) {
        res.status(404).json({
            success: false,
            message: 'Job not found or expired'
        })
        return
    }

    const state    = await job.getState()
    const progress = job.progress as number
    const result   = job.returnvalue
    const failErr  = job.failedReason

    const messages: Record<string, string> = {
        'waiting':   'Queued...',
        'active':    getPdfProgressMessage(progress),
        'completed': 'PDF ready',
        'failed':    `Failed: ${failErr}`,
        'delayed':   'Retrying...',
        'unknown':   'Unknown status'
    }

    res.status(200).json({
        success: true,
        data: {
            jobId,
            state,
            progress,
            message: messages[state] || 'Processing...',
            result:  state === 'completed' ? result : null,
            error:   state === 'failed'    ? failErr : null
        }
    })
}

// DOWNLOAD project PDF (employee)
export const downloadEmployeeProjectPdf = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    if (!project.projectPdfUrl) {
        res.status(404).json({
            success: false,
            message: 'No project PDF generated yet'
        })
        return
    }

    const filePath = extractStoragePath(project.projectPdfUrl)

    if (!filePath) {
        res.status(500).json({ success: false, message: 'Invalid PDF path' })
        return
    }

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600)

    if (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate download URL'
        })
        return
    }

    res.status(200).json({
        success: true,
        data: { downloadUrl: data.signedUrl }
    })
}

// ─── SHARED HELPERS ────────────────────────────────

const extractStoragePath = (publicUrl: string): string => {
    try {
        const url       = new URL(publicUrl)
        const pathParts = url.pathname.split(`/object/public/${BUCKET}/`)
        return pathParts[1] || ''
    } catch {
        return ''
    }
}

const getPdfProgressMessage = (progress: number): string => {
    if (progress < 25)  return 'Fetching project data...'
    if (progress < 60)  return 'Generating PDF...'
    if (progress < 75)  return 'Uploading to storage...'
    if (progress < 90)  return 'Saving...'
    if (progress < 100) return 'Sending email...'
    return 'Almost done...'
}

// ─── EMPLOYEE REMINDERS ────────────────────────────

// GET all reminders (scoped to employee's leads)
export const getEmployeeReminders = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const status     = String(req.query.status || '')

    const where: any = {
        lead: { assignedTo: employeeId }
    }

    if (status === 'ALL') {
        // no status filter
    } else if (status === 'DONE') {
        where.status = 'DONE'
    } else {
        where.status = 'PENDING'
    }

    const [reminders, pendingCount] = await Promise.all([
        prisma.reminder.findMany({
            where,
            orderBy: { reminderAt: 'asc' },
            include: {
                lead: {
                    select: {
                        id:          true,
                        fullName:    true,
                        phone:       true,
                        serviceType: true,
                        followUp:    true
                    }
                },
                parentReminder: {
                    select: {
                        id:         true,
                        reminderAt: true
                    }
                }
            }
        }),
        prisma.reminder.count({
            where: {
                status: 'PENDING',
                lead:   { assignedTo: employeeId }
            }
        })
    ])

    const formatted = reminders.map(r => ({
        ...r,
        isReReminder: !!r.parentReminderId
    }))

    res.status(200).json({
        success: true,
        data: {
            reminders:    formatted,
            pendingCount
        }
    })
}

// CREATE re-reminder (employee)
export const createEmployeeReReminder = async (req: EmployeeRequest, res: Response) => {

    const parentReminderId = req.params.id as string
    const employeeId       = req.employee?.employeeId!

    const schema = z.object({
        reminderAt: z.string().datetime('Invalid date format'),
        note:       z.string().optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const parentReminder = await prisma.reminder.findUnique({
        where:   { id: parentReminderId },
        include: { lead: { select: { assignedTo: true } } }
    })

    if (!parentReminder || parentReminder.lead?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    const reminder = await prisma.reminder.create({
        data: {
            leadId:          parentReminder.leadId,
            reminderAt:      new Date(parsed.data.reminderAt),
            note:            parsed.data.note || null,
            status:          'PENDING',
            parentReminderId
        },
        include: {
            lead: {
                select: {
                    id:          true,
                    fullName:    true,
                    phone:       true,
                    serviceType: true,
                    followUp:    true
                }
            },
            parentReminder: true
        }
    })

    res.status(201).json({
        success: true,
        message: 'Re-reminder created successfully',
        data:    reminder
    })
}

// MARK reminder as done (employee)
export const markEmployeeReminderDone = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const reminder = await prisma.reminder.findUnique({
        where:   { id },
        include: { lead: { select: { assignedTo: true } } }
    })

    if (!reminder || reminder.lead?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    const updated = await prisma.reminder.update({
        where: { id },
        data:  { status: 'DONE' },
        include: {
            lead: {
                select: {
                    id:          true,
                    fullName:    true,
                    phone:       true,
                    serviceType: true,
                    followUp:    true
                }
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Reminder marked as done',
        data:    updated
    })
}

// DELETE reminder (employee)
export const deleteEmployeeReminder = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const reminder = await prisma.reminder.findUnique({
        where:   { id },
        include: { lead: { select: { assignedTo: true } } }
    })

    if (!reminder || reminder.lead?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    await prisma.reminder.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Reminder deleted successfully'
    })
}

// DELETE lead (employee — only if assigned to them)
export const deleteEmployeeLead = async (req: EmployeeRequest, res: Response) => {

    const leadId     = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const lead = await prisma.lead.findUnique({ where: { id: leadId } })

    if (!lead || lead.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Lead not found'
        })
        return
    }

    if (lead.status === 'CONVERTED') {
        res.status(400).json({
            success: false,
            message: 'Cannot delete a converted lead'
        })
        return
    }

    await prisma.lead.delete({ where: { id: leadId } })

    res.status(200).json({
        success: true,
        message: 'Lead deleted successfully'
    })
}

// ─── EMPLOYEE SUBSCRIPTIONS ────────────────────────

// GET subscriptions (scoped to employee's projects)
export const getEmployeeSubscriptions = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!
    const category   = String(req.query.category  || '')
    const status     = String(req.query.status    || '')
    const projectId  = String(req.query.projectId || '')

    const where: any = {
        project: {
            customer: { assignedTo: employeeId }
        }
    }

    if (projectId) where.projectId = projectId
    if (category)  where.category  = category

    const subs = await prisma.subscription.findMany({
        where,
        orderBy: { renewalDate: 'asc' },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: { id: true, fullName: true }
                    }
                }
            }
        }
    })

    // compute status
    const computeStatus = (sub: any): string => {
        if (sub.status === 'Cancelled') return 'Cancelled'
        const today = new Date(); today.setHours(0,0,0,0)
        const renew = new Date(sub.renewalDate); renew.setHours(0,0,0,0)
        return renew < today ? 'Expired' : 'Active'
    }

    let formatted = subs.map(sub => ({
        id:           sub.id,
        name:         sub.name,
        description:  sub.description,
        category:     sub.category,
        amount:       sub.amount,
        billingCycle: sub.billingCycle,
        renewalDate:  sub.renewalDate,
        lastPaidAt:   sub.lastPaidAt || null,
        paidUntil:    sub.paidUntil  || null,
        status:       computeStatus(sub),
        createdAt:    sub.createdAt,
        projectId:    sub.projectId,
        projectName:  sub.project?.projectName   || null,
        customerId:   sub.project?.customer?.id  || null,
        customerName: sub.project?.customer?.fullName || null
    }))

    // apply status filter after computing
    if (status) {
        formatted = formatted.filter(s => s.status === status)
    }

    // summary counts
    const today          = new Date(); today.setHours(0,0,0,0)
    const renewSoon      = new Date(today); renewSoon.setDate(today.getDate() + 30)
    const activeCount    = formatted.filter(s => s.status === 'Active').length
    const expiredCount   = formatted.filter(s => s.status === 'Expired').length
    const renewingSoon   = formatted.filter(s => {
        const r = new Date(s.renewalDate)
        return s.status === 'Active' && r >= today && r <= renewSoon
    }).length

    res.status(200).json({
        success: true,
        data: {
            subscriptions: formatted,
            summary: {
                total:       formatted.length,
                active:      activeCount,
                expired:     expiredCount,
                renewingSoon
            }
        }
    })
}

// GET single subscription (employee)
export const getEmployeeSubscription = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const sub = await prisma.subscription.findUnique({
        where: { id },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: {
                            id:        true,
                            fullName:  true,
                            assignedTo: true
                        }
                    }
                }
            }
        }
    })

    if (!sub || sub.project?.customer?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Subscription not found'
        })
        return
    }

    const computeStatus = (s: any): string => {
        if (s.status === 'Cancelled') return 'Cancelled'
        const today = new Date(); today.setHours(0,0,0,0)
        const renew = new Date(s.renewalDate); renew.setHours(0,0,0,0)
        return renew < today ? 'Expired' : 'Active'
    }

    res.status(200).json({
        success: true,
        data: {
            id:           sub.id,
            name:         sub.name,
            description:  sub.description,
            category:     sub.category,
            amount:       sub.amount,
            billingCycle: sub.billingCycle,
            renewalDate:  sub.renewalDate,
            lastPaidAt:   sub.lastPaidAt || null,
            paidUntil:    sub.paidUntil  || null,
            status:       computeStatus(sub),
            createdAt:    sub.createdAt,
            projectId:    sub.projectId,
            projectName:  sub.project?.projectName  || null,
            customerId:   sub.project?.customer?.id || null,
            customerName: sub.project?.customer?.fullName || null
        }
    })
}

// CREATE subscription (employee — on their project)
export const createEmployeeSubscription = async (req: EmployeeRequest, res: Response) => {

    const employeeId = req.employee?.employeeId!

    const schema = z.object({
        projectId:    z.string().uuid('Valid project id required'),
        name:         z.string().optional(),
        description:  z.string().optional(),
        category:     z.enum(['Domain','Hosting','SSL','Maintenance','Software Subscription']),
        amount:       z.union([z.string(), z.number()])
                      .transform(v => parseFloat(String(v)) || 0),
        billingCycle: z.enum(['Monthly','Quarterly','Yearly']).default('Monthly'),
        renewalDate:  z.string().min(1, 'Renewal date required'),
        status:       z.enum(['Active','Expired','Cancelled']).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    // verify project belongs to employee
    const project = await prisma.project.findUnique({
        where:   { id: parsed.data.projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Project not found'
        })
        return
    }

    const name = parsed.data.name?.trim() || project.projectName

    const sub = await prisma.subscription.create({
        data: {
            projectId:    parsed.data.projectId,
            name,
            description:  parsed.data.description || null,
            category:     parsed.data.category,
            amount:       parsed.data.amount,
            billingCycle: parsed.data.billingCycle,
            renewalDate:  new Date(parsed.data.renewalDate),
            status:       parsed.data.status || 'Active'
        },
        include: {
            project: {
                select: {
                    id: true, projectName: true,
                    customer: { select: { id: true, fullName: true } }
                }
            }
        }
    })

    const computeStatus = (s: any) => {
        if (s.status === 'Cancelled') return 'Cancelled'
        const today = new Date(); today.setHours(0,0,0,0)
        const renew = new Date(s.renewalDate); renew.setHours(0,0,0,0)
        return renew < today ? 'Expired' : 'Active'
    }

    res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data: {
            id:           sub.id,
            name:         sub.name,
            category:     sub.category,
            amount:       sub.amount,
            billingCycle: sub.billingCycle,
            renewalDate:  sub.renewalDate,
            status:       computeStatus(sub),
            projectId:    sub.projectId,
            projectName:  sub.project?.projectName || null
        }
    })
}

// PAY subscription (employee)
export const payEmployeeSubscription = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const sub = await prisma.subscription.findUnique({
        where: { id },
        include: {
            project: {
                select: {
                    id: true,
                    customer: { select: { assignedTo: true } }
                }
            }
        }
    })

    if (!sub || sub.project?.customer?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Subscription not found'
        })
        return
    }

    if (!sub.projectId) {
        res.status(400).json({
            success: false,
            message: 'Subscription must be linked to a project'
        })
        return
    }

    const schema = z.object({
        amount:        z.union([z.string(), z.number()])
                       .transform(v => parseFloat(String(v)) || 0).optional(),
        paymentDate:   z.string().optional(),
        paymentMethod: z.enum(['UPI','BANK_TRANSFER','CASH','CHEQUE','OTHER']).optional(),
        note:          z.string().optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const amount        = parsed.data.amount || sub.amount
    const paymentDate   = parsed.data.paymentDate
        ? new Date(parsed.data.paymentDate)
        : new Date()
    const paymentMethod = parsed.data.paymentMethod || 'OTHER'
    const note          = parsed.data.note || null

    // advance renewal date
    const newRenewalDate = new Date(sub.renewalDate)
    if (sub.billingCycle === 'Monthly')   newRenewalDate.setMonth(newRenewalDate.getMonth() + 1)
    if (sub.billingCycle === 'Quarterly') newRenewalDate.setMonth(newRenewalDate.getMonth() + 3)
    if (sub.billingCycle === 'Yearly')    newRenewalDate.setFullYear(newRenewalDate.getFullYear() + 1)

    const [updatedSub, transaction] = await prisma.$transaction([

        prisma.subscription.update({
            where: { id },
            data: {
                renewalDate: newRenewalDate,
                lastPaidAt:  paymentDate,
                paidUntil:   newRenewalDate,
                status:      'Active'
            }
        }),

        prisma.financeTransaction.create({
            data: {
                projectId:      sub.projectId,
                subscriptionId: sub.id,
                amount,
                paymentMethod:  paymentMethod as any,
                paymentDate,
                note:           note || `${sub.category} subscription renewal`,
                source:         'SUBSCRIPTION',
                allocations:    []
            }
        })
    ])

    res.status(200).json({
        success: true,
        message: 'Payment recorded. Renewal date advanced.',
        data: {
            subscription: {
                id:          updatedSub.id,
                renewalDate: updatedSub.renewalDate,
                lastPaidAt:  updatedSub.lastPaidAt,
                paidUntil:   updatedSub.paidUntil,
                status:      'Active'
            },
            transaction
        }
    })
}

// UPDATE subscription (employee)
export const updateEmployeeSubscription = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const existing = await prisma.subscription.findUnique({
        where:   { id },
        include: {
            project: {
                select: { customer: { select: { assignedTo: true } } }
            }
        }
    })

    if (!existing || existing.project?.customer?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Subscription not found'
        })
        return
    }

    const schema = z.object({
        name:         z.string().optional(),
        description:  z.string().optional(),
        category:     z.enum(['Domain','Hosting','SSL','Maintenance','Software Subscription']).optional(),
        amount:       z.union([z.string(), z.number()])
                      .transform(v => parseFloat(String(v)) || 0).optional(),
        billingCycle: z.enum(['Monthly','Quarterly','Yearly']).optional(),
        renewalDate:  z.string().optional(),
        status:       z.enum(['Active','Expired','Cancelled']).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }
    if (data.renewalDate) data.renewalDate = new Date(data.renewalDate)

    const updated = await prisma.subscription.update({
        where: { id },
        data
    })

    res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data:    updated
    })
}

// DELETE subscription (employee)
export const deleteEmployeeSubscription = async (req: EmployeeRequest, res: Response) => {

    const id         = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const existing = await prisma.subscription.findUnique({
        where:   { id },
        include: {
            project: {
                select: { customer: { select: { assignedTo: true } } }
            }
        }
    })

    if (!existing || existing.project?.customer?.assignedTo !== employeeId) {
        res.status(404).json({
            success: false,
            message: 'Subscription not found'
        })
        return
    }

    await prisma.subscription.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Subscription deleted successfully'
    })
}


// GET developers list (employee — read only for assignment)
export const getEmployeeDevelopers = async (req: EmployeeRequest, res: Response) => {

    const search = String(req.query.search || '')
    const skill  = String(req.query.skill  || '')

    const where: any = {
        status: 'Active'   // only active developers
    }

    if (skill)  where.skills = { has: skill }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { role: { contains: search, mode: 'insensitive' } }
        ]
    }

    const developers = await prisma.developer.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
            id:         true,
            name:       true,
            role:       true,
            experience: true,
            skills:     true,
            status:     true
        }
    })

    res.status(200).json({
        success: true,
        data:    { developers }
    })
}

// ADD feature to project (employee)
export const addEmployeeProjectFeature = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const schema = z.object({
        name:  z.string().min(1, 'Feature name required'),
        price: z.union([z.string(), z.number()]).optional()
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { name, price } = parsed.data
    const amount           = parseFloat(String(price)) || 0

    const featureItems = (project.featureItems as any[]) || []
    const costHistory  = (project.costHistory  as any[]) || []

    const genId = (prefix: string) =>
        `${prefix}-${Math.random().toString(36).substring(2, 8)}`

    const featureId  = genId('feat')
    const newFeature = { id: featureId, name, price: String(amount) }

    featureItems.push(newFeature)

    if (amount > 0) {
        costHistory.push({
            id:      genId('ch'),
            label:   name,
            amount,
            addedAt: new Date().toISOString()
        })
    }

    await prisma.project.update({
        where: { id: projectId },
        data: {
            featureItems: featureItems as any,
            costHistory:  costHistory  as any
        }
    })

    res.status(201).json({
        success: true,
        message: 'Feature added successfully',
        data:    newFeature
    })
}

// REMOVE feature from project (employee)
export const removeEmployeeProjectFeature = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id        as string
    const featureId  = req.params.featureId as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project || project.customer?.assignedTo !== employeeId) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const featureItems = (project.featureItems as any[]) || []
    const costHistory  = (project.costHistory  as any[]) || []

    const feature = featureItems.find(f => f.id === featureId)

    if (!feature) {
        res.status(404).json({ success: false, message: 'Feature not found' })
        return
    }

    const newFeatures    = featureItems.filter(f => f.id !== featureId)
    const newCostHistory = costHistory.filter(c =>
        !(c.label === feature.name &&
          parseFloat(c.amount) === parseFloat(feature.price))
    )

    await prisma.project.update({
        where: { id: projectId },
        data: {
            featureItems: newFeatures    as any,
            costHistory:  newCostHistory as any
        }
    })

    res.status(200).json({
        success: true,
        message: 'Feature removed successfully'
    })
}

// ASSIGN developers to project (employee)
export const assignEmployeeProjectDevelopers = async (req: EmployeeRequest, res: Response) => {

    const projectId  = req.params.id as string
    const employeeId = req.employee?.employeeId!

    const project = await prisma.project.findUnique({
        where:   { id: projectId },
        include: { customer: { select: { assignedTo: true } } }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    if (project.customer?.assignedTo !== employeeId) {
        res.status(403).json({
            success: false,
            message: 'This project does not belong to your customers'
        })
        return
    }

    const schema = z.object({
        developers: z.array(z.string()).min(0)
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    // validate all developer IDs exist
    const devIds = parsed.data.developers

    if (devIds.length > 0) {
        const found = await prisma.developer.findMany({
            where:  { id: { in: devIds } },
            select: { id: true }
        })

        if (found.length !== devIds.length) {
            res.status(400).json({
                success: false,
                message: 'One or more developer IDs are invalid'
            })
            return
        }
    }

    await prisma.project.update({
        where: { id: projectId },
        data:  { developers: devIds }
    })

    // fetch full developer objects for response
    const developers = devIds.length > 0
        ? await prisma.developer.findMany({
            where:  { id: { in: devIds } },
            select: { id: true, name: true, role: true, experience: true, skills: true }
        })
        : []

    // refetch full project for response
    const updated = await prisma.project.findUnique({
        where:   { id: projectId },
        include: {
            customer: {
                select: {
                    id:                true,
                    fullName:          true,
                    phone:             true,
                    email:             true,
                    applicationNumber: true,
                    assignedTo:        true
                }
            }
        }
    })

    const costHistory      = (updated!.costHistory as any[]) || []
    const totalProjectCost = updated!.budget + costHistory.reduce(
        (sum, c) => sum + (parseFloat(c.amount) || 0), 0
    )

    res.status(200).json({
        success: true,
        message: 'Developers assigned successfully',
        data: {
            project: {
                id:               updated!.id,
                projectName:      updated!.projectName,
                serviceType:      updated!.serviceType,
                description:      updated!.description,
                status:           updated!.status,
                budget:           updated!.budget,
                contractNumber:   updated!.contractNumber,
                deadline:         updated!.deadline,
                webOverview:      updated!.webOverview,
                appOverview:      updated!.appOverview,
                adminOverview:    updated!.adminOverview,
                payments:         updated!.payments,
                timelines:        updated!.timelines,
                schedules:        updated!.schedules,
                featureItems:     updated!.featureItems,
                costHistory:      updated!.costHistory,
                totalProjectCost,
                developers,
                estimationPdfUrl: updated!.estimationPdfUrl,
                projectPdfUrl:    updated!.projectPdfUrl,
                createdAt:        updated!.createdAt,
                customerId:       updated!.customerId,
                clientName:       updated!.customer.fullName,
                phone:            updated!.customer.phone,
                email:            updated!.customer.email,
                applicationNumber: updated!.customer.applicationNumber
            }
        }
    })
}