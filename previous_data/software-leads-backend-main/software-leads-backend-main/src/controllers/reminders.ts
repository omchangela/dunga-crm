import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'

const createReminderSchema = z.object({
    reminderAt: z.string().datetime('Invalid date format'),
    note: z.string().optional()
})

const updateReminderSchema = z.object({
    reminderAt: z.string().datetime().optional(),
    note: z.string().optional()
})

const leadSelect = {
    id: true,
    fullName: true,
    phone: true,
    serviceType: true,
    followUp: true
}

// CREATE REMINDER
export const createReminder = async (req: Request, res: Response) => {
    const leadId = req.params.leadId as string

    const lead = await prisma.lead.findUnique({
        where: { id: leadId }
    })

    if (!lead) {
        res.status(404).json({
            success: false,
            message: 'Lead not found'
        })
        return
    }

    const parsed = createReminderSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors
        })
        return
    }

    const reminder = await prisma.reminder.create({
        data: {
            leadId,
            reminderAt: new Date(parsed.data.reminderAt),
            note: parsed.data.note || null,
            status: 'PENDING'
        },
        include: {
            lead: {
                select: leadSelect
            }
        }
    })

    res.status(201).json({
        success: true,
        message: 'Reminder created successfully',
        data: reminder
    })
}

// CREATE RE-REMINDER
// CREATE RE-REMINDER
export const createReReminder = async (req: Request, res: Response) => {
    const parentReminderId = req.params.id as string

    const parsed = createReminderSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors
        })
        return
    }

    const parentReminder = await prisma.reminder.findUnique({
        where: { id: parentReminderId }
    })

    if (!parentReminder) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    const reminder = await prisma.reminder.create({
        data: {
            leadId: parentReminder.leadId,
            reminderAt: new Date(parsed.data.reminderAt),
            note: parsed.data.note || null,
            status: 'PENDING',
            parentReminderId
        },
        include: {
            lead: {
                select: leadSelect
            },
            parentReminder: true
        }
    })

    res.status(201).json({
        success: true,
        message: 'Re-reminder created successfully',
        data: reminder
    })
}

// GET ALL REMINDERS
export const getAllReminders = async (req: Request, res: Response) => {
    const status = String(req.query.status || '')

    const where: any = {}

    if (status === 'ALL') {
    } else if (status === 'DONE') {
        where.status = 'DONE'
    } else {
        where.status = 'PENDING'
    }

    const [reminders, pendingCount] = await Promise.all([
        prisma.reminder.findMany({
            where,
            orderBy: {
                reminderAt: 'asc'
            },
            include: {
                lead: {
                    select: leadSelect
                },
                parentReminder: {
                    select: {
                        id: true,
                        reminderAt: true
                    }
                }
            }
        }),
        prisma.reminder.count({
            where: {
                status: 'PENDING'
            }
        })
    ])

    const formatted = reminders.map(reminder => ({
        ...reminder,
        isReReminder: !!reminder.parentReminderId
    }))

    res.status(200).json({
        success: true,
        data: {
            reminders: formatted,
            pendingCount
        }
    })
}

// GET LEAD REMINDERS
export const getLeadReminders = async (req: Request, res: Response) => {
    const leadId = req.params.leadId as string

    const lead = await prisma.lead.findUnique({
        where: {
            id: leadId
        }
    })

    if (!lead) {
        res.status(404).json({
            success: false,
            message: 'Lead not found'
        })
        return
    }

    const reminders = await prisma.reminder.findMany({
        where: {
            leadId
        },
        orderBy: {
            reminderAt: 'asc'
        },
        include: {
            lead: {
                select: leadSelect
            },
            parentReminder: {
                select: {
                    id: true,
                    reminderAt: true,
                    note: true
                }
            },
            reReminders: {
                select: {
                    id: true,
                    reminderAt: true,
                    note: true,
                    status: true
                }
            }
        }
    })

    const formatted = reminders.map(reminder => ({
        ...reminder,
        isReReminder: !!reminder.parentReminderId
    }))

    res.status(200).json({
        success: true,
        data: formatted
    })
}

// MARK AS DONE
export const markAsDone = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.reminder.findUnique({
        where: { id }
    })

    if (!existing) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    const updated = await prisma.reminder.update({
        where: {
            id
        },
        data: {
            status: 'DONE'
        },
        include: {
            lead: {
                select: leadSelect
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Reminder marked as done',
        data: updated
    })
}

// UPDATE REMINDER
export const updateReminder = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.reminder.findUnique({
        where: { id }
    })

    if (!existing) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    const parsed = updateReminderSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors: parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.reminder.update({
        where: {
            id
        },
        data: {
            ...(parsed.data.reminderAt && {
                reminderAt: new Date(parsed.data.reminderAt)
            }),
            ...(parsed.data.note !== undefined && {
                note: parsed.data.note
            })
        },
        include: {
            lead: {
                select: leadSelect
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Reminder updated successfully',
        data: updated
    })
}

// DELETE REMINDER
export const deleteReminder = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const existing = await prisma.reminder.findUnique({
        where: { id }
    })

    if (!existing) {
        res.status(404).json({
            success: false,
            message: 'Reminder not found'
        })
        return
    }

    await prisma.reminder.delete({
        where: { id }
    })

    res.status(200).json({
        success: true,
        message: 'Reminder deleted successfully'
    })
}