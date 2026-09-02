import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import {
    SERVICE_TYPES,
    LEAD_SOURCES,
    LEAD_STATUSES
} from '../lib/enums'

// ─── SCHEMAS ──────────────────────────────────────

const createLeadSchema = z.object({
    fullName:           z.string().min(2, 'Full name required'),
    phone:              z.string().length(10, 'Phone must be 10 digits'),
    email:              z.string().email().optional().or(z.literal('')),
    state:              z.string().optional(),
    city:               z.string().optional(),
    serviceType:        z.enum(SERVICE_TYPES),
    source:             z.enum(LEAD_SOURCES),
})

const updateLeadSchema = z.object({
    fullName:           z.string().min(2).optional(),
    phone:              z.string().length(10).optional(),
    email:              z.string().email().optional().or(z.literal('')),
    state:              z.string().optional(),
    city:               z.string().optional(),
    serviceType:        z.enum(SERVICE_TYPES).optional(),
    source:             z.enum(LEAD_SOURCES).optional(),
    status:             z.enum(LEAD_STATUSES).optional()
})

const updateStatusSchema = z.object({
    status: z.enum(LEAD_STATUSES)
})

const bulkFollowUpSchema = z.object({
    ids:      z.array(z.string().uuid()).min(1),
    followUp: z.boolean()
})

// ─── CONTROLLERS ──────────────────────────────────

export const createLead = async (req: Request, res: Response) => {
    const parsed = createLeadSchema.safeParse(req.body)
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
            email:              email || null,
            state:              state || null,
            city:               city  || null,
            serviceType,
            source,
            status:             'PENDING',
            followUp:           false
        }
    })

    res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        data:    lead
    })
}

export const getAllLeads = async (req: Request, res: Response) => {
    const page     = parseInt(req.query.page     as string) || 1
    const limit    = parseInt(req.query.limit    as string) || 10
    const skip     = (page - 1) * limit
    const followUp = String(req.query.followUp || '')
    const status   = req.query.status   as string

    const where: any = {}

    if (followUp === 'true')  where.followUp = true
    if (followUp === 'false') where.followUp = false

    if (status && status !== 'ALL') {
        where.status = status
    } else if (!status) {
        where.status = { in: ['PENDING', 'REJECTED'] }
    }

    const [leads, total, followUpCount, noFollowUpCount] =
        await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take:    limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.lead.count({ where }),
            prisma.lead.count({ where: { followUp: true  } }),
            prisma.lead.count({ where: { followUp: false } })
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
            },
            tabs: {
                all:        total,
                followUp:   followUpCount,
                noFollowUp: noFollowUpCount
            }
        }
    })
}

export const getLead = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const lead = await prisma.lead.findUnique({
        where:   { id },
        include: { reminders: true }
    })

    if (!lead) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    res.status(200).json({ success: true, data: lead })
}

export const updateLead = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const parsed = updateLeadSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data = parsed.data

    if (data.phone && data.phone !== existing.phone) {
        const phoneTaken = await prisma.lead.findUnique({
            where: { phone: data.phone }
        })
        if (phoneTaken) {
            res.status(409).json({
                success: false,
                message: 'Phone already used by another lead'
            })
            return
        }
    }

    const updated = await prisma.lead.update({
        where: { id },
        data:  { ...data, email: data.email || null }
    })

    res.status(200).json({
        success: true,
        message: 'Lead updated successfully',
        data:    updated
    })
}

export const deleteLead = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    await prisma.lead.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Lead deleted successfully'
    })
}

export const updateStatus = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.lead.update({
        where: { id },
        data:  { status: parsed.data.status }
    })

    res.status(200).json({
        success: true,
        message: `Lead status updated to ${parsed.data.status}`,
        data:    updated
    })
}

export const toggleFollowUp = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
        res.status(404).json({ success: false, message: 'Lead not found' })
        return
    }

    const updated = await prisma.lead.update({
        where: { id },
        data:  { followUp: !existing.followUp }
    })

    res.status(200).json({
        success: true,
        message: `Lead marked as ${updated.followUp ? 'Follow Up' : 'Un-Follow Up'}`,
        data:    updated
    })
}

export const bulkFollowUp = async (req: Request, res: Response) => {
    const parsed = bulkFollowUpSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { ids, followUp } = parsed.data

    const result = await prisma.lead.updateMany({
        where: { id: { in: ids } },
        data:  { followUp }
    })

    res.status(200).json({
        success: true,
        message: `${result.count} lead(s) marked as ${followUp ? 'Follow Up' : 'Un-Follow Up'}`,
        data:    { updatedCount: result.count }
    })
}

import { importQueue } from '../lib/queues/importQueue'

export const bulkImport = async (req: Request, res: Response) => {

    if (!req.file) {
        res.status(400).json({ success: false, message: 'CSV file required' })
        return
    }

    const csvContent = req.file.buffer.toString('utf-8')
    const fileName   = req.file.originalname || 'import.csv'

    // add to queue
    const job = await importQueue.add(
        `import-${Date.now()}`,
        { csvContent, fileName },
        { jobId: `import-${Date.now()}` }
    )

    res.status(202).json({
        success: true,
        message: 'Import queued. Processing in background.',
        data: {
            jobId:    job.id,
            fileName,
            status:   'queued',
            pollUrl:  `/api/leads/import/status/${job.id}`
        }
    })
}

// GET import job status
export const getImportStatus = async (req: Request, res: Response) => {

    const jobId = req.params.jobId as string

    const job = await importQueue.getJob(jobId)

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
        'waiting':   'Job queued, waiting to start...',
        'active':    getProgressMessage(progress),
        'completed': `Done: ${result?.imported || 0} imported`,
        'failed':    `Failed: ${failErr}`,
        'delayed':   'Waiting to retry...',
        'unknown':   'Unknown status'
    }

    res.status(200).json({
        success: true,
        data: {
            jobId,
            state,
            progress,
            message:  messages[state] || 'Processing...',
            result:   state === 'completed' ? result : null,
            error:    state === 'failed'    ? failErr : null
        }
    })
}

const getProgressMessage = (progress: number): string => {
    if (progress < 20)  return 'Parsing CSV...'
    if (progress < 40)  return 'Validating rows...'
    if (progress < 55)  return 'Checking duplicates...'
    if (progress < 70)  return 'Checking database...'
    if (progress < 100) return 'Inserting leads...'
    return 'Almost done...'
}