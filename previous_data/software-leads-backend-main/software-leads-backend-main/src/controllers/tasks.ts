import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import { TASK_PRIORITIES, TASK_STATUSES } from '../lib/taskEnums'

// ─── SCHEMAS ──────────────────────────────────────

const createTaskSchema = z.object({
    title:       z.string().min(1, 'Title required'),
    description: z.string().optional(),
    projectId:   z.string().uuid('Invalid project id'),
    assignedTo:  z.string().uuid('Invalid developer id'),
    dueDate:     z.string().optional().nullable(),
    priority:    z.enum(TASK_PRIORITIES).optional(),
    status:      z.enum(TASK_STATUSES).optional()
})

const updateTaskSchema = z.object({
    title:       z.string().min(1).optional(),
    description: z.string().optional(),
    projectId:   z.string().uuid().optional(),
    assignedTo:  z.string().uuid().optional(),
    dueDate:     z.string().optional().nullable(),
    priority:    z.enum(TASK_PRIORITIES).optional(),
    status:      z.enum(TASK_STATUSES).optional()
})

const updateStatusSchema = z.object({
    status: z.enum(TASK_STATUSES)
})

// ─── HELPERS ──────────────────────────────────────

// validate developer is assigned to the project
const validateAssignment = async (
    projectId:  string,
    developerId: string
): Promise<{ valid: boolean; message?: string }> => {

    const project = await prisma.project.findUnique({
        where:  { id: projectId },
        select: { developers: true }
    })

    if (!project) {
        return { valid: false, message: 'Project not found' }
    }

    if (!project.developers.includes(developerId)) {
        return {
            valid:   false,
            message: 'Developer is not assigned to this project'
        }
    }

    return { valid: true }
}

// ─── CONTROLLERS ──────────────────────────────────

// GET all tasks
export const getAllTasks = async (req: Request, res: Response) => {

    const status     = req.query.status     as string
    const priority   = req.query.priority   as string
    const assignedTo = req.query.assignedTo as string
    const projectId  = req.query.projectId  as string

    const where: any = {}

    if (status)     where.status     = status
    if (priority)   where.priority   = priority
    if (assignedTo) where.assignedTo = assignedTo
    if (projectId)  where.projectId  = projectId

    const tasks = await prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            },
            developer: {
                select: {
                    id:   true,
                    name: true,
                    role: true
                }
            }
        }
    })

    res.status(200).json({
        success: true,
        data: { tasks }
    })
}

// GET single task
export const getTask = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const task = await prisma.task.findUnique({
        where: { id },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            },
            developer: {
                select: {
                    id:   true,
                    name: true,
                    role: true
                }
            }
        }
    })

    if (!task) {
        res.status(404).json({ success: false, message: 'Task not found' })
        return
    }

    res.status(200).json({ success: true, data: task })
}

// CREATE task
export const createTask = async (req: Request, res: Response) => {

    const parsed = createTaskSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data = parsed.data

    // validate developer is assigned to project
    const validation = await validateAssignment(data.projectId, data.assignedTo)

    if (!validation.valid) {
        res.status(400).json({
            success: false,
            errors:  { assignedTo: [validation.message] }
        })
        return
    }

    const task = await prisma.task.create({
        data: {
            title:       data.title,
            description: data.description || null,
            projectId:   data.projectId,
            assignedTo:  data.assignedTo,
            dueDate:     data.dueDate ? new Date(data.dueDate) : null,
            priority:    data.priority || 'Medium',
            status:      data.status   || 'Todo'
        },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            },
            developer: {
                select: {
                    id:   true,
                    name: true,
                    role: true
                }
            }
        }
    })

    res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data:    task
    })
}

// UPDATE task
export const updateTask = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.task.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Task not found' })
        return
    }

    const parsed = updateTaskSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // if project or assignee changed → validate
    const newProjectId  = data.projectId  || existing.projectId
    const newAssignedTo = data.assignedTo || existing.assignedTo

    if (data.projectId || data.assignedTo) {
        const validation = await validateAssignment(newProjectId, newAssignedTo)

        if (!validation.valid) {
            res.status(400).json({
                success: false,
                errors:  { assignedTo: [validation.message] }
            })
            return
        }
    }

    if (data.dueDate) {
        data.dueDate = new Date(data.dueDate)
    } else if (data.dueDate === null) {
        data.dueDate = null
    }

    if (data.description === '') data.description = null

    const updated = await prisma.task.update({
        where: { id },
        data,
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            },
            developer: {
                select: {
                    id:   true,
                    name: true,
                    role: true
                }
            }
        }
    })

    res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data:    updated
    })
}

// QUICK status change
export const updateTaskStatus = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.task.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Task not found' })
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

    const updated = await prisma.task.update({
        where: { id },
        data:  { status: parsed.data.status },
        include: {
            project: {
                select: {
                    id:          true,
                    projectName: true,
                    serviceType: true
                }
            },
            developer: {
                select: {
                    id:   true,
                    name: true,
                    role: true
                }
            }
        }
    })

    res.status(200).json({
        success: true,
        message: `Task status updated to ${parsed.data.status}`,
        data:    updated
    })
}

// DELETE task
export const deleteTask = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.task.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Task not found' })
        return
    }

    await prisma.task.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Task deleted successfully'
    })
}

// GET enums
export const getTaskEnums = async (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        data: {
            priorities: TASK_PRIORITIES,
            statuses:   TASK_STATUSES
        }
    })
}

// GET developers assigned to a project (for task assignment dropdown)
export const getProjectDevelopers = async (req: Request, res: Response) => {

    const projectId = req.params.projectId as string

    const project = await prisma.project.findUnique({
        where:  { id: projectId },
        select: { developers: true }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    if (project.developers.length === 0) {
        res.status(200).json({ success: true, data: [] })
        return
    }

    const developers = await prisma.developer.findMany({
        where: {
            id: { in: project.developers }
        },
        select: {
            id:   true,
            name: true,
            role: true
        }
    })

    res.status(200).json({ success: true, data: developers })
}