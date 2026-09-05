import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'

// ─── HELPERS ──────────────────────────────────────

const PAYMENT_METHODS = [
    'UPI', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'OTHER'
] as const

const getProjectTotal = (budget: number, costHistory: any[]): number => {
    const additions = (costHistory || []).reduce((sum, c) => {
        return sum + (parseFloat(c.amount) || 0)
    }, 0)
    return budget + additions
}

const normalizeStatus = (status: string): string => {
    if (status === 'CONVERTED') return 'ACTIVE'
    return status
}

// generate unique id
const genId = (prefix: string): string => {
    return `${prefix}-${Math.random().toString(36).substring(2, 8)}`
}

// ensure schedules have id, paid, status fields
const normalizeSchedules = (schedules: any[]): any[] => {
    return (schedules || []).map(s => ({
        id:          s.id          || genId('sch'),
        description: s.description || '',
        payment:     String(parseFloat(s.payment) || 0),
        paid:        String(parseFloat(s.paid)    || 0),
        status:      s.status      || computeScheduleStatus(s)
    }))
}

// derive status from payment amounts
const computeScheduleStatus = (s: any): string => {
    const total = parseFloat(s.payment) || 0
    const paid  = parseFloat(s.paid)    || 0

    if (paid <= 0)        return 'pending'
    if (paid >= total)    return 'paid'
    return 'partial'
}

// allocate payment across schedules sequentially
const allocatePayment = (
    schedules: any[],
    amount:    number
): { schedules: any[]; allocations: any[]; remaining: number } => {

    const updated     = [...schedules]
    const allocations: any[] = []
    let   remaining   = amount

    for (const sch of updated) {
        if (remaining <= 0) break

        const total      = parseFloat(sch.payment) || 0
        const alreadyPaid = parseFloat(sch.paid)   || 0
        const due         = total - alreadyPaid

        if (due <= 0) continue   // already fully paid

        const applied = Math.min(remaining, due)

        sch.paid   = String(alreadyPaid + applied)
        sch.status = computeScheduleStatus(sch)

        allocations.push({
            scheduleId:  sch.id,
            description: sch.description,
            applied,
            scheduleNow: {
                payment: sch.payment,
                paid:    sch.paid,
                status:  sch.status
            }
        })

        remaining -= applied
    }

    return { schedules: updated, allocations, remaining }
}

// ─── SCHEMAS ──────────────────────────────────────

const collectSchema = z.object({
    projectId:     z.string().uuid('Invalid project id'),
    amount:        z.union([z.string(), z.number()])
                   .transform(v => parseFloat(String(v)))
                   .refine(v => v > 0, 'Amount must be greater than 0'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentDate:   z.string().min(1, 'Payment date required'),
    transactionId: z.string().optional(),
    note:          z.string().optional()
})

const updateTransactionSchema = z.object({
    amount:        z.union([z.string(), z.number()])
                   .transform(v => parseFloat(String(v)))
                   .refine(v => v > 0).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    paymentDate:   z.string().optional(),
    transactionId: z.string().optional(),
    note:          z.string().optional()
})

// ─── CONTROLLERS ──────────────────────────────────

// GLOBAL summary
export const getFinanceSummary = async (req: Request, res: Response) => {

    const projects = await prisma.project.findMany({
        where: {
            status: {
                in: ['CONVERTED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
            }
        },
        select: {
            id:          true,
            budget:      true,
            costHistory: true
        }
    })

    const totalPipelineBudget = projects.reduce((sum, p) => {
        return sum + getProjectTotal(p.budget, p.costHistory as any[])
    }, 0)

    const projectIds = projects.map(p => p.id)

    const result = await prisma.financeTransaction.aggregate({
        where:  { projectId: { in: projectIds } },
        _sum:   { amount: true }
    })

    const totalReceived      = result._sum.amount || 0
    const outstandingBalance = totalPipelineBudget - totalReceived

    res.status(200).json({
        summary: {
            totalPipelineBudget,
            totalReceived,
            outstandingBalance
        }
    })
}

// PROJECT ledger — includes schedule status + subscription payments
export const getProjectLedger = async (req: Request, res: Response) => {

    const projectId = req.params.projectId as string

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            customer: {
                select: { fullName: true, phone: true }
            },
            transactions: {
                orderBy: { paymentDate: 'desc' },
                include: {
                    subscription: {
                        select: {
                            id:       true,
                            category: true,
                            name:     true
                        }
                    }
                }
            }
        }
    })

    if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
    }

    const totalBudget = getProjectTotal(project.budget, project.costHistory as any[])

    // separate project payments from subscription payments
    const projectTxns      = project.transactions.filter(t => t.source !== 'SUBSCRIPTION')
    const subscriptionTxns = project.transactions.filter(t => t.source === 'SUBSCRIPTION')

    const totalPaid             = projectTxns.reduce((sum, t) => sum + t.amount, 0)
    const totalSubscriptionPaid = subscriptionTxns.reduce((sum, t) => sum + t.amount, 0)

    const remaining = totalBudget - totalPaid

    const schedules = normalizeSchedules(project.schedules as any[])

    res.status(200).json({
        project: {
            id:          project.id,
            projectName: project.projectName,
            status:      normalizeStatus(project.status),
            serviceType: project.serviceType,
            customer:    project.customer
        },
        summary: {
            totalBudget,
            totalPaid,                      // project payments only
            totalSubscriptionPaid,          // recurring subscription income
            remainingBalance: remaining     // based on project payments
        },
        schedules,
        history: project.transactions       // ALL transactions (both kinds)
    })
}

// COLLECT payment with allocation
export const collectPayment = async (req: Request, res: Response) => {

    const parsed = collectSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            message: 'Validation failed',
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data = parsed.data

    const project = await prisma.project.findUnique({
        where: { id: data.projectId }
    })

    if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
    }

    // normalize current schedules
    const currentSchedules = normalizeSchedules(project.schedules as any[])

    // allocate payment across schedules
    const { schedules: updatedSchedules, allocations, remaining }
        = allocatePayment(currentSchedules, data.amount)

    // transaction — update project schedules + create finance txn
    const [transaction] = await prisma.$transaction([

        prisma.financeTransaction.create({
            data: {
                projectId:     data.projectId,
                amount:        data.amount,
                paymentMethod: data.paymentMethod,
                paymentDate:   new Date(data.paymentDate),
                transactionId: data.transactionId || null,
                note:          data.note          || null,
                allocations:   allocations as any
            }
        }),

        prisma.project.update({
            where: { id: data.projectId },
            data:  { schedules: updatedSchedules as any }
        })
    ])

    res.status(201).json({
        transaction,
        allocations,
        remaining,
        schedules: updatedSchedules,
        message: remaining > 0
            ? `Payment allocated. ₹${remaining} excess beyond all schedules.`
            : 'Payment allocated successfully'
    })
}

// UPDATE transaction
// Note: does NOT re-allocate. Schedules remain as they were.
// For simplicity edits only change transaction metadata.
export const updateTransaction = async (req: Request, res: Response) => {

    const id = req.params.transactionId as string

    const existing = await prisma.financeTransaction.findUnique({
        where: { id }
    })

    if (!existing) {
        res.status(404).json({ message: 'Transaction not found' })
        return
    }

    const parsed = updateTransactionSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            message: 'Validation failed',
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // amount changes would break allocations — block it
    if (data.amount && data.amount !== existing.amount) {
        res.status(400).json({
            message: 'Cannot edit amount. Delete this transaction and create a new one.'
        })
        return
    }

    if (data.paymentDate) {
        data.paymentDate = new Date(data.paymentDate)
    }

    const updated = await prisma.financeTransaction.update({
        where: { id },
        data
    })

    res.status(200).json(updated)
}

// DELETE transaction — reverse allocations
export const deleteTransaction = async (req: Request, res: Response) => {

    const id = req.params.transactionId as string

    const existing = await prisma.financeTransaction.findUnique({
        where: { id }
    })

    if (!existing) {
        res.status(404).json({ message: 'Transaction not found' })
        return
    }

    const project = await prisma.project.findUnique({
        where: { id: existing.projectId }
    })

    if (!project) {
        res.status(404).json({ message: 'Project not found' })
        return
    }

    // reverse allocations from schedules
    const schedules    = normalizeSchedules(project.schedules as any[])
    const allocations  = (existing.allocations as any[]) || []

    for (const alloc of allocations) {
        const sch = schedules.find(s => s.id === alloc.scheduleId)
        if (sch) {
            const currentPaid = parseFloat(sch.paid) || 0
            sch.paid   = String(Math.max(0, currentPaid - alloc.applied))
            sch.status = computeScheduleStatus(sch)
        }
    }

    await prisma.$transaction([
        prisma.financeTransaction.delete({ where: { id } }),
        prisma.project.update({
            where: { id: existing.projectId },
            data:  { schedules: schedules as any }
        })
    ])

    res.status(200).json({
        message: 'Transaction deleted and schedules reverted'
    })
}

// PROJECTS list for finance landing page
export const getFinanceProjects = async (req: Request, res: Response) => {

    const projects = await prisma.project.findMany({
        where: {
            status: {
                in: ['CONVERTED', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
            }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            customer: {
                select: { id: true, fullName: true, phone: true }
            },
            transactions: {
                select: { amount: true, source: true }
            }
        }
    })

    const result = projects.map(p => {
        const totalBudget = getProjectTotal(p.budget, p.costHistory as any[])

        // only count PROJECT source for "paid"
        const projectTxns = p.transactions.filter(t => t.source !== 'SUBSCRIPTION')
        const totalPaid   = projectTxns.reduce((sum, t) => sum + t.amount, 0)

        const subscriptionTxns      = p.transactions.filter(t => t.source === 'SUBSCRIPTION')
        const totalSubscriptionPaid = subscriptionTxns.reduce((sum, t) => sum + t.amount, 0)

        return {
            id:                    p.id,
            projectName:           p.projectName,
            serviceType:           p.serviceType,
            status:                normalizeStatus(p.status),
            totalBudget,
            totalPaid,
            totalSubscriptionPaid,
            remainingBalance:      totalBudget - totalPaid,
            customer:              p.customer,
            createdAt:             p.createdAt
        }
    })

    res.status(200).json(result)
}