import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'

// ─── HELPERS ──────────────────────────────────────

const CATEGORIES = [
    'Domain',
    'Hosting',
    'SSL',
    'Maintenance',
    'Software Subscription'
] as const

const BILLING_CYCLES = ['Monthly', 'Quarterly', 'Yearly'] as const
const STATUSES       = ['Active', 'Expired', 'Cancelled'] as const

// advance renewal date by billing cycle
const advanceRenewalDate = (
    currentRenewal: Date,
    cycle:          string
): Date => {
    const next = new Date(currentRenewal)

    if (cycle === 'Monthly')   next.setMonth(next.getMonth() + 1)
    if (cycle === 'Quarterly') next.setMonth(next.getMonth() + 3)
    if (cycle === 'Yearly')    next.setFullYear(next.getFullYear() + 1)

    return next
}

const paySubscriptionSchema = z.object({
    amount:        z.union([z.string(), z.number()])
                   .transform(v => parseFloat(String(v)) || 0).optional(),
    paymentDate:   z.string().optional(),
    paymentMethod: z.enum(['UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER']).optional(),
    note:          z.string().optional()
})

// auto-flip to Expired if past renewal date
const computeStatus = (sub: any): string => {
    if (sub.status === 'Cancelled') return 'Cancelled'

    const today  = new Date()
    today.setHours(0, 0, 0, 0)

    const renew  = new Date(sub.renewalDate)
    renew.setHours(0, 0, 0, 0)

    if (renew < today) return 'Expired'
    return 'Active'
}

// normalize amount to monthly for analytics
const toMonthly = (amount: number, cycle: string): number => {
    if (cycle === 'Quarterly') return amount / 3
    if (cycle === 'Yearly')    return amount / 12
    return amount
}

// format subscription with project + customer data
const formatSubscription = (sub: any): any => {
    return {
        id:           sub.id,
        name:         sub.name,
        description:  sub.description,
        category:     sub.category,
        amount:       sub.amount,
        billingCycle: sub.billingCycle,
        renewalDate:  sub.renewalDate,
        status:       computeStatus(sub),
        lastPaidAt:   sub.lastPaidAt   || null,
        paidUntil:    sub.paidUntil    || null,
        createdAt:    sub.createdAt,
        updatedAt:    sub.updatedAt,
        projectId:    sub.projectId,
        projectName:  sub.project?.projectName  || null,
        customerId:   sub.project?.customer?.id || null,
        customerName: sub.project?.customer?.fullName || null
    }
}

// ─── SCHEMAS ──────────────────────────────────────

const createSchema = z.object({
    projectId:    z.string().uuid('Valid project id required'),
    name:         z.string().optional(),
    description:  z.string().optional(),
    category:     z.enum(CATEGORIES),
    amount:       z.union([z.string(), z.number()])
                  .transform(v => parseFloat(String(v)) || 0),
    billingCycle: z.enum(BILLING_CYCLES).default('Monthly'),
    renewalDate:  z.string().min(1, 'Renewal date required'),
    status:       z.enum(STATUSES).optional()
})

const updateSchema = z.object({
    projectId:    z.string().uuid().optional(),
    name:         z.string().optional(),
    description:  z.string().optional(),
    category:     z.enum(CATEGORIES).optional(),
    amount:       z.union([z.string(), z.number()])
                  .transform(v => parseFloat(String(v)) || 0).optional(),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    renewalDate:  z.string().optional(),
    status:       z.enum(STATUSES).optional()
})

// ─── CONTROLLERS ──────────────────────────────────

// ENUMS
export const getEnums = async (req: Request, res: Response) => {
    res.status(200).json({
        categories:    CATEGORIES,
        billingCycles: BILLING_CYCLES,
        statuses:      STATUSES
    })
}

// SUMMARY (per category)
export const getSummary = async (req: Request, res: Response) => {

    const subs = await prisma.subscription.findMany()

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const renewSoonCutoff = new Date(today)
    renewSoonCutoff.setDate(today.getDate() + 30)

    const summary: any = {}

    for (const category of CATEGORIES) {
        const items = subs.filter(s => s.category === category)

        const monthlyCost = items
            .filter(s => computeStatus(s) === 'Active')
            .reduce((sum, s) => sum + toMonthly(s.amount, s.billingCycle), 0)

        summary[category] = {
            total:         items.length,
            active:        items.filter(s => computeStatus(s) === 'Active').length,
            expired:       items.filter(s => computeStatus(s) === 'Expired').length,
            renewingSoon:  items.filter(s => {
                const renew = new Date(s.renewalDate)
                return computeStatus(s) === 'Active' &&
                       renew >= today &&
                       renew <= renewSoonCutoff
            }).length,
            monthlyCost
        }
    }

    res.status(200).json({ success: true, data: summary })
}

// LIST with filters
export const getAllSubscriptions = async (req: Request, res: Response) => {

    const projectId  = String(req.query.projectId  || '')
    const customerId = String(req.query.customerId || '')
    const category   = String(req.query.category   || '')
    const status     = String(req.query.status     || '')

    const where: any = {}

    if (projectId) {
        where.projectId = projectId
    }

    if (customerId) {
        where.project = { customerId }
    }

    if (category) {
        where.category = category
    }

    const subs = await prisma.subscription.findMany({
        where,
        orderBy: { renewalDate: 'asc' },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: {
                            id:       true,
                            fullName: true
                        }
                    }
                }
            }
        }
    })

    let formatted = subs.map(formatSubscription)

    // apply status filter AFTER formatting (since it's computed)
    if (status) {
        formatted = formatted.filter(s => s.status === status)
    }

    res.status(200).json({ success: true, data: formatted })
}

// GET single
export const getSubscription = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const sub = await prisma.subscription.findUnique({
        where: { id },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: {
                            id:       true,
                            fullName: true
                        }
                    }
                }
            }
        }
    })

    if (!sub) {
        res.status(404).json({ success: false, message: 'Subscription not found' })
        return
    }

    res.status(200).json({
        success: true,
        data:    formatSubscription(sub)
    })
}

// CREATE
export const createSubscription = async (req: Request, res: Response) => {

    const parsed = createSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data = parsed.data

    // validate project
    const project = await prisma.project.findUnique({
        where: { id: data.projectId }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    // default name to project name if not provided
    const name = data.name?.trim() || project.projectName

    const sub = await prisma.subscription.create({
        data: {
            projectId:    data.projectId,
            name,
            description:  data.description  || null,
            category:     data.category,
            amount:       data.amount,
            billingCycle: data.billingCycle,
            renewalDate:  new Date(data.renewalDate),
            status:       data.status || 'Active'
        },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: {
                            id:       true,
                            fullName: true
                        }
                    }
                }
            }
        }
    })

    res.status(201).json({
        success: true,
        message: 'Subscription created successfully',
        data:    formatSubscription(sub)
    })
}

// UPDATE
export const updateSubscription = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.subscription.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Subscription not found' })
        return
    }

    const parsed = updateSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // validate new project if reassigning
    if (data.projectId) {
        const project = await prisma.project.findUnique({
            where: { id: data.projectId }
        })

        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' })
            return
        }
    }

    if (data.renewalDate) {
        data.renewalDate = new Date(data.renewalDate)
    }

    const updated = await prisma.subscription.update({
        where: { id },
        data,
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    customer: {
                        select: {
                            id:       true,
                            fullName: true
                        }
                    }
                }
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Subscription updated successfully',
        data:    formatSubscription(updated)
    })
}

// DELETE
export const deleteSubscription = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.subscription.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Subscription not found' })
        return
    }

    await prisma.subscription.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Subscription deleted successfully'
    })
}


// MARK subscription as paid
export const paySubscription = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const subscription = await prisma.subscription.findUnique({
        where: { id },
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

    if (!subscription) {
        res.status(404).json({ success: false, message: 'Subscription not found' })
        return
    }

    if (!subscription.projectId || !subscription.project) {
        res.status(400).json({
            success: false,
            message: 'Subscription must be linked to a project before payment'
        })
        return
    }

    const parsed = paySubscriptionSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data = parsed.data

    const amount        = data.amount        || subscription.amount
    const paymentDate   = data.paymentDate ? new Date(data.paymentDate) : new Date()
    const paymentMethod = data.paymentMethod || 'OTHER'
    const note          = data.note          || null

    // calculate new renewal date
    const newRenewalDate = advanceRenewalDate(
        subscription.renewalDate,
        subscription.billingCycle
    )

    // transaction — update sub + create finance txn
    const [updatedSub, financeTxn] = await prisma.$transaction([

        prisma.subscription.update({
            where: { id },
            data: {
                renewalDate: newRenewalDate,
                lastPaidAt:  paymentDate,
                paidUntil:   newRenewalDate,
                status:      'Active'
            },
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
        }),

        prisma.financeTransaction.create({
            data: {
                projectId:      subscription.projectId,
                subscriptionId: subscription.id,
                amount,
                paymentMethod:  paymentMethod as any,
                paymentDate,
                note:           note || `${subscription.category} subscription renewal`,
                source:         'SUBSCRIPTION',
                allocations:    []
            }
        })
    ])

    res.status(200).json({
        success: true,
        message: 'Subscription payment recorded',
        data: {
            subscription: formatSubscription(updatedSub),
            transaction:  financeTxn
        }
    })
}