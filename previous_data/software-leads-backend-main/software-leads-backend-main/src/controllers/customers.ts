import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import { SERVICE_TYPES } from '../lib/enums'

// ─── HELPERS ──────────────────────────────────────

const generateAppNumber = async (): Promise<string> => {
    const now    = new Date()
    const year   = now.getFullYear()
    const month  = String(now.getMonth() + 1).padStart(2, '0')
    const count  = await prisma.customer.count()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `APP-${year}${month}-${random}`
}

// ─── SCHEMAS ──────────────────────────────────────

const updateCustomerSchema = z.object({
    state:  z.string().optional(),
    city:   z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})
// ─── CONTROLLERS ──────────────────────────────────

// CONVERT lead to customer
export const convertLead = async (req: Request, res: Response) => {

    const leadId = req.params.leadId as string

    const lead = await prisma.lead.findUnique({
        where: { id: leadId }
    })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const alreadyConverted = await prisma.customer.findUnique({
        where: { leadId }
    })

    if (alreadyConverted) {
        res.status(409).json({
            success: false,
            message: 'Lead already converted to customer'
        })
        return
    }

    const appNumber = await generateAppNumber()

    const [customer] = await prisma.$transaction([

prisma.customer.create({
    data: {
        fullName:          lead.fullName,
        phone:             lead.phone,
        email:             lead.email,
        state:             lead.state,
        city:              lead.city,
        serviceType:       lead.serviceType,
        applicationNumber: appNumber,
        status:            'ACTIVE',
        leadId:            lead.id,
        assignedTo:        lead.assignedTo || null 
    }
}),

        prisma.lead.update({
            where: { id: leadId },
            data:  { status: 'CONVERTED' }
        })
    ])

    res.status(201).json({
        success: true,
        message: 'Lead converted to customer successfully',
        data:    customer
    })
}

// GET all customers
export const getAllCustomers = async (req: Request, res: Response) => {

    const page  = parseInt(req.query.page  as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const skip  = (page - 1) * limit

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
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
        prisma.customer.count()
    ])

    // calculate project pipeline
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

// GET single customer
// GET single customer (enriched with project data)
export const getCustomer = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const customer = await prisma.customer.findUnique({
        where: { id },
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

    if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' })
        return
    }

    // collect all developer IDs across projects
    const allDevIds = new Set<string>()
    customer.projects.forEach(p => {
        (p.developers || []).forEach(devId => allDevIds.add(devId))
    })

    // fetch all developers in one query
    const developers = allDevIds.size > 0
        ? await prisma.developer.findMany({
            where: {
                id: { in: Array.from(allDevIds) }
            },
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

    // helper to compute schedule status
    const computeSubStatus = (sub: any): string => {
        if (sub.status === 'Cancelled') return 'Cancelled'

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const renew = new Date(sub.renewalDate)
        renew.setHours(0, 0, 0, 0)

        if (renew < today) return 'Expired'
        return 'Active'
    }

    // calculate total project cost (budget + cost history)
    const getProjectTotal = (budget: number, costHistory: any[]): number => {
        const additions = (costHistory || []).reduce(
            (sum, c) => sum + (parseFloat(c.amount) || 0), 0
        )
        return budget + additions
    }

    // enrich projects
    const enrichedProjects = customer.projects.map(p => {

        // resolve developers
        const projectDevs = (p.developers || [])
            .map(devId => developerMap.get(devId))
            .filter(Boolean)

        // finance summary
        const totalBudget = getProjectTotal(p.budget, p.costHistory as any[])
        const totalPaid   = p.transactions.reduce((sum, t) => sum + t.amount, 0)
        const remaining   = totalBudget - totalPaid

        // subscriptions with auto-status
        const subscriptions = p.subscriptions.map(s => ({
            id:           s.id,
            name:         s.name,
            description:  s.description,
            category:     s.category,
            amount:       s.amount,
            billingCycle: s.billingCycle,
            renewalDate:  s.renewalDate,
            lastPaidAt:   s.lastPaidAt,    // ← added
            paidUntil:    s.paidUntil,     // ← added
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
            // remove raw transactions from response
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

// UPDATE customer
export const updateCustomer = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.customer.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Customer not found' })
        return
    }

    const parsed = updateCustomerSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.customer.update({
        where: { id },
        data:  parsed.data as any
    })

    res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data:    updated
    })
}

// DELETE customer
export const deleteCustomer = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.customer.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Customer not found' })
        return
    }

    await prisma.customer.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Customer deleted successfully'
    })
}