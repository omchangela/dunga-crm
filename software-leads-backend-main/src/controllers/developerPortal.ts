import { Request, Response }            from 'express'
import prisma                            from '../lib/prisma'
import bcrypt                            from 'bcryptjs'
import { z }                             from 'zod'
import {
    signDeveloperAccess,
    signDeveloperRefresh,
    verifyDeveloperRefresh,
    DEVELOPER_REFRESH_EXPIRES_MS
}                                        from '../lib/developerJwt'
import { DeveloperRequest }              from '../middleware/developerAuth'

// ─── HELPERS ──────────────────────────────────────

const setDeveloperCookies = (res: Response, access: string, refresh: string) => {
    const isProd = process.env.NODE_ENV === 'production'
    const base   = {
        httpOnly: true,
        secure:   isProd,
        sameSite: (isProd ? 'none' : 'lax') as any,
        path:     '/'
    }
    res.cookie('developer_access_token',  access,  { ...base, maxAge: 8 * 60 * 60 * 1000 })
    res.cookie('developer_refresh_token', refresh, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

const clearDeveloperCookies = (res: Response) => {
    const isProd = process.env.NODE_ENV === 'production'
    const base   = {
        httpOnly: true,
        secure:   isProd,
        sameSite: (isProd ? 'none' : 'lax') as any,
        path:     '/'
    }
    res.clearCookie('developer_access_token',  base)
    res.clearCookie('developer_refresh_token', base)
}

// ─── AUTH ─────────────────────────────────────────

// LOGIN
export const developerLogin = async (req: Request, res: Response) => {

    const schema = z.object({
        email:    z.string().email(),
        password: z.string().min(1)
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { email, password } = parsed.data

    const developer = await prisma.developer.findFirst({ where: { email } })

    if (!developer || !developer.password) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    if (developer.status !== 'Active') {
        res.status(403).json({
            success: false,
            message: 'Account is inactive. Contact admin.'
        })
        return
    }

    const valid = await bcrypt.compare(password, developer.password)

    if (!valid) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    const expiresAt    = new Date(Date.now() + DEVELOPER_REFRESH_EXPIRES_MS)
    const refreshRecord = await prisma.developerRefreshToken.create({
        data: {
            developerId: developer.id,
            userAgent:   req.headers['user-agent'] || null,
            ipAddress:   req.ip || null,
            expiresAt
        }
    })

    const accessToken  = signDeveloperAccess({ developerId: developer.id, role: developer.role })
    const refreshToken = signDeveloperRefresh({ developerId: developer.id, jti: refreshRecord.id })

    setDeveloperCookies(res, accessToken, refreshToken)

    // update last login
    await prisma.developer.update({
        where: { id: developer.id },
        data:  { lastLoginAt: new Date() }
    })

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            id:         developer.id,
            name:       developer.name,
            email:      developer.email,
            role:       developer.role,
            experience: developer.experience,
            skills:     developer.skills
        }
    })
}

// LOGOUT
export const developerLogout = async (req: Request, res: Response) => {

    const token = req.cookies.developer_refresh_token

    if (token) {
        try {
            const payload = verifyDeveloperRefresh(token)
            await prisma.developerRefreshToken.updateMany({
                where: { id: payload.jti, revokedAt: null },
                data:  { revokedAt: new Date() }
            })
        } catch { }
    }

    clearDeveloperCookies(res)
    res.status(200).json({ success: true, message: 'Logged out successfully' })
}

// GET ME
export const getDeveloperMe = async (req: DeveloperRequest, res: Response) => {

    const developerId = req.developer?.developerId!

    const developer = await prisma.developer.findUnique({
        where:  { id: developerId },
        select: {
            id:          true,
            name:        true,
            email:       true,
            phone:       true,
            role:        true,
            experience:  true,
            skills:      true,
            status:      true,
            joinedAt:    true,
            lastLoginAt: true
        }
    })

    if (!developer) {
        res.status(404).json({ success: false, message: 'Developer not found' })
        return
    }

    // task summary
const [pendingTasks, inProgressTasks, completedTasks] = await Promise.all([
    prisma.task.count({ where: { assignedTo: developerId, status: 'Todo' } }),
    prisma.task.count({ where: { assignedTo: developerId, status: { in: ['In Progress', 'In Review'] } } }),
    prisma.task.count({ where: { assignedTo: developerId, status: 'Done' } })
])

    res.status(200).json({
        success: true,
        data: {
            ...developer,
            tasks: {
                pending:    pendingTasks,
                inProgress: inProgressTasks,
                completed:  completedTasks
            }
        }
    })
}

// CHANGE PASSWORD
export const developerChangePassword = async (req: DeveloperRequest, res: Response) => {

    const developerId = req.developer?.developerId!

    const schema = z.object({
        currentPassword: z.string().min(1),
        newPassword:     z.string().min(8, 'Min 8 characters')
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const developer = await prisma.developer.findUnique({ where: { id: developerId } })

    if (!developer || !developer.password) {
        res.status(404).json({ success: false, message: 'Developer not found' })
        return
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, developer.password)

    if (!valid) {
        res.status(401).json({
            success: false,
            message: 'Current password is incorrect'
        })
        return
    }

    const hash = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.developer.update({
        where: { id: developerId },
        data:  { password: hash }
    })

    await prisma.developerRefreshToken.updateMany({
        where: { developerId, revokedAt: null },
        data:  { revokedAt: new Date() }
    })

    clearDeveloperCookies(res)

    res.status(200).json({
        success: true,
        message: 'Password changed. Please login again.'
    })
}

// ─── DASHBOARD ────────────────────────────────────

export const getDeveloperDashboard = async (req: DeveloperRequest, res: Response) => {

    const developerId = req.developer?.developerId!

    const [
        totalProjects,
        totalTasks,
        todoTasks,
        inProgressTasks,
        doneTasks,
        overdueTasks,
        recentTasks,
        myProjects
    ] = await Promise.all([
        // count projects where this developer is assigned
        prisma.project.count({
            where: { developers: { has: developerId } }
        }),
        prisma.task.count({ where: { assignedTo: developerId } }),
        prisma.task.count({ where: { assignedTo: developerId, status: 'Todo' } }),
        prisma.task.count({
    where: {
        assignedTo: developerId,
        status: { in: ['In Progress', 'In Review'] }
    }
}),
        prisma.task.count({ where: { assignedTo: developerId, status: 'Done' } }),
        prisma.task.count({
            where: {
                assignedTo: developerId,
                status:     { not: 'Done' },
                dueDate:    { lt: new Date() }
            }
        }),
        prisma.task.findMany({
            where:   { assignedTo: developerId, status: { not: 'Done' } },
            orderBy: { dueDate: 'asc' },
            take:    5,
            include: {
                project: {
                    select: { id: true, projectName: true }
                }
            }
        }),
        prisma.project.findMany({
            where:   { developers: { has: developerId } },
            orderBy: { createdAt: 'desc' },
            take:    5,
            select: {
                id:          true,
                projectName: true,
                status:      true,
                deadline:    true,
                customer: {
                    select: { fullName: true }
                }
            }
        })
    ])

    res.status(200).json({
        success: true,
        data: {
            stats: {
                totalProjects,
                totalTasks,
                todoTasks,
                inProgressTasks,
                doneTasks,
                overdueTasks
            },
            recentTasks,
            recentProjects: myProjects.map(p => ({
                id:          p.id,
                projectName: p.projectName,
                status:      p.status,
                deadline:    p.deadline,
                clientName:  p.customer.fullName
            }))
        }
    })
}

// ─── PROJECTS ─────────────────────────────────────

// GET assigned projects list
export const getDeveloperProjects = async (req: DeveloperRequest, res: Response) => {

    const developerId = req.developer?.developerId!
    const status      = String(req.query.status || '')

    const where: any = {
        developers: { has: developerId }
    }

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

    // get all developer IDs for team display
    const allDevIds = new Set<string>()
    projects.forEach(p =>
        (p.developers || []).forEach((id: string) => allDevIds.add(id))
    )

    const developers = allDevIds.size > 0
        ? await prisma.developer.findMany({
            where:  { id: { in: Array.from(allDevIds) } },
            select: { id: true, name: true, role: true }
        })
        : []

    const devMap = new Map(developers.map(d => [d.id, d]))

    const result = projects.map(p => ({
        id:          p.id,
        projectName: p.projectName,
        serviceType: p.serviceType,
        status:      p.status,
        deadline:    p.deadline,
        createdAt:   p.createdAt,
        clientName:  p.customer.fullName,
        phone:       p.customer.phone,
        customerId:  p.customerId,
        developers:  (p.developers || [])
                         .map((id: string) => devMap.get(id))
                         .filter(Boolean)
    }))

    res.status(200).json({ success: true, data: { projects: result } })
}

// GET single project — LIMITED VIEW (no payment amounts)
export const getDeveloperProject = async (req: DeveloperRequest, res: Response) => {

    const projectId   = req.params.id as string
    const developerId = req.developer?.developerId!

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            customer: {
                select: {
                    id:       true,
                    fullName: true,
                    phone:    true,
                    email:    true
                }
            },
            tasks: {
                where:   { assignedTo: developerId },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    // verify developer is assigned to this project
    if (!(project.developers || []).includes(developerId)) {
        res.status(403).json({
            success: false,
            message: 'You are not assigned to this project'
        })
        return
    }

    // resolve full team (other developers on same project)
    const devIds  = (project.developers || []) as string[]
    const allDevs = devIds.length > 0
        ? await prisma.developer.findMany({
            where:  { id: { in: devIds } },
            select: { id: true, name: true, role: true, experience: true }
        })
        : []

    res.status(200).json({
    success: true,
    data: {
        project: {
            id:            project.id,
            projectName:   project.projectName,
            serviceType:   project.serviceType,
            description:   project.description,
            status:        project.status,
            deadline:      project.deadline,
            createdAt:     project.createdAt,
            customerId:    project.customerId,
            clientName:    project.customer.fullName,
            phone:         project.customer.phone,
            email:         project.customer.email,
            overview: {
                web:   project.webOverview,
                app:   project.appOverview,
                admin: project.adminOverview
            },
            timelines:    project.timelines,
            featureItems: (project.featureItems as any[]).map((f: any) => ({
                id:   f.id,
                name: f.name
                // NO price
            })),
            developers:   allDevs,
            myTasks:      project.tasks
        }
    }
})
}

// ─── TASKS ────────────────────────────────────────

// GET my tasks
export const getDeveloperTasks = async (req: DeveloperRequest, res: Response) => {

    const developerId = req.developer?.developerId!
    const status      = String(req.query.status    || '')
    const priority    = String(req.query.priority  || '')
    const projectId   = String(req.query.projectId || '')

    const where: any = { assignedTo: developerId }

    if (status)    where.status   = status
    if (priority)  where.priority = priority
    if (projectId) where.projectId = projectId

    const tasks = await prisma.task.findMany({
        where,
        orderBy: [
            { status:   'asc' },
            { dueDate:  'asc' },
            { priority: 'desc' }
        ],
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            }
        }
    })

    res.status(200).json({ success: true, data: { tasks } })
}

// UPDATE task status (developer can update their own task status)
export const updateDeveloperTaskStatus = async (req: DeveloperRequest, res: Response) => {

    const taskId      = req.params.id as string
    const developerId = req.developer?.developerId!

    const task = await prisma.task.findUnique({ where: { id: taskId } })

    if (!task || task.assignedTo !== developerId) {
        res.status(404).json({ success: false, message: 'Task not found' })
        return
    }

    const schema = z.object({
        status: z.enum(['Todo', 'In Progress', 'In Review', 'Done'])
    })

    const parsed = schema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.task.update({
        where: { id: taskId },
        data:  { status: parsed.data.status },
        include: {
            project: {
                select: { id: true, projectName: true }
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Task status updated',
        data:    updated
    })
}

// GET single task
export const getDeveloperTask = async (req: DeveloperRequest, res: Response) => {

    const taskId      = req.params.id as string
    const developerId = req.developer?.developerId!

    const task = await prisma.task.findUnique({
        where:   { id: taskId },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            }
        }
    })

    if (!task || task.assignedTo !== developerId) {
        res.status(404).json({ success: false, message: 'Task not found' })
        return
    }

    res.status(200).json({ success: true, data: { task } })
}

export const developerRefresh = async (req: Request, res: Response) => {

    const token = req.cookies.developer_refresh_token

    if (!token) {
        res.status(401).json({ success: false, message: 'No refresh token' })
        return
    }

    try {
        const payload = verifyDeveloperRefresh(token)

        const record = await prisma.developerRefreshToken.findUnique({
            where: { id: payload.jti }
        })

        if (!record || record.revokedAt || record.expiresAt < new Date()) {
            clearDeveloperCookies(res)
            res.status(401).json({ success: false, message: 'Invalid refresh token' })
            return
        }

        const developer = await prisma.developer.findUnique({
            where: { id: record.developerId }
        })

        if (!developer || developer.status !== 'Active') {
            clearDeveloperCookies(res)
            res.status(403).json({ success: false, message: 'Account inactive' })
            return
        }

        // rotate
        const expiresAt  = new Date(Date.now() + DEVELOPER_REFRESH_EXPIRES_MS)
        const newRecord  = await prisma.developerRefreshToken.create({
            data: {
                developerId: developer.id,
                userAgent:   req.headers['user-agent'] || null,
                ipAddress:   req.ip || null,
                expiresAt
            }
        })

        await prisma.developerRefreshToken.update({
            where: { id: record.id },
            data:  { revokedAt: new Date(), replacedBy: newRecord.id }
        })

        const accessToken  = signDeveloperAccess({ developerId: developer.id, role: developer.role })
        const refreshToken = signDeveloperRefresh({ developerId: developer.id, jti: newRecord.id })

        setDeveloperCookies(res, accessToken, refreshToken)

        res.status(200).json({ success: true })

    } catch {
        clearDeveloperCookies(res)
        res.status(401).json({ success: false, message: 'Invalid refresh token' })
    }
}