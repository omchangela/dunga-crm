import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import {
    ROLES,
    EXPERIENCE_LEVELS,
    SKILLS,
    DEV_STATUSES
} from '../lib/developerEnums'
import { sendDeveloperWelcomeEmail } from '../lib/config/developerMail'
import bcrypt                         from 'bcryptjs'

// ─── SCHEMAS ──────────────────────────────────────

const createDeveloperSchema = z.object({
    name:       z.string().min(2, 'Name required'),
    phone:      z.string().length(10, 'Phone must be 10 digits'),
    email:      z.string().email('Valid email required'),
    role:       z.enum(ROLES),
    experience: z.enum(EXPERIENCE_LEVELS),
    skills:     z.array(z.enum(SKILLS)).min(1, 'At least one skill required'),
    status:     z.enum(DEV_STATUSES).optional(),
    joinedAt:   z.string().optional()
})

const updateDeveloperSchema = z.object({
    name:       z.string().min(2).optional(),
    phone:      z.string().length(10).optional(),
    email:      z.string().email().optional().or(z.literal('')),
    role:       z.enum(ROLES).optional(),
    experience: z.enum(EXPERIENCE_LEVELS).optional(),
    skills:     z.array(z.enum(SKILLS)).min(1).optional(),
    status:     z.enum(DEV_STATUSES).optional(),
    joinedAt:   z.string().optional()
})

// ─── CONTROLLERS ──────────────────────────────────

// GET all developers
export const getAllDevelopers = async (req: Request, res: Response) => {

    const status = String(req.query.status || '')
    const skill  = req.query.skill  as string
    const search = req.query.search as string

    const where: any = {}

    if (status) where.status = status

    if (skill)  where.skills = { has: skill }

    if (search) {
        where.OR = [
            { name:  { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
            { role:  { contains: search, mode: 'insensitive' } }
        ]
    }

    const developers = await prisma.developer.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({
        success: true,
        data: { developers }
    })
}

// GET single developer with assignment counts
export const getDeveloper = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const developer = await prisma.developer.findUnique({ where: { id } })

    if (!developer) {
        res.status(404).json({ success: false, message: 'Developer not found' })
        return
    }

    // count assigned projects (developer id is in Project.developers array)
    const assignedProjects = await prisma.project.count({
        where: { developers: { has: id } }
    })

    res.status(200).json({
        success: true,
        data: {
            ...developer,
            assignedProjects
        }
    })
}



// UPDATE developer
export const updateDeveloper = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.developer.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Developer not found' })
        return
    }

    const parsed = updateDeveloperSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // check phone uniqueness if changed
    if (data.phone && data.phone !== existing.phone) {
        const phoneTaken = await prisma.developer.findUnique({
            where: { phone: data.phone }
        })
        if (phoneTaken) {
            res.status(409).json({
                success: false,
                message: 'Phone already used by another developer'
            })
            return
        }
    }

    if (data.email === '') data.email = null
    if (data.joinedAt)     data.joinedAt = new Date(data.joinedAt)

    const updated = await prisma.developer.update({
        where: { id },
        data
    })

    res.status(200).json({
        success: true,
        message: 'Developer updated successfully',
        data:    updated
    })
}

// DELETE developer
export const deleteDeveloper = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.developer.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Developer not found' })
        return
    }

    // check if assigned to any project
    const assignedProjects = await prisma.project.findMany({
        where:  { developers: { has: id } },
        select: { id: true, projectName: true }
    })

    if (assignedProjects.length > 0) {
        // remove developer id from all projects' developers arrays
        await Promise.all(
            assignedProjects.map(p =>
                prisma.project.update({
                    where: { id: p.id },
                    data: {
                        developers: {
                            set: (existing.id ? [] : []).filter(() => false)
                        }
                    }
                })
            )
        )

        // proper way — fetch each, filter, update
        for (const project of assignedProjects) {
            const proj = await prisma.project.findUnique({
                where: { id: project.id }
            })
            if (proj) {
                await prisma.project.update({
                    where: { id: project.id },
                    data: {
                        developers: proj.developers.filter(d => d !== id)
                    }
                })
            }
        }
    }

    await prisma.developer.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Developer deleted successfully'
    })
}

// GET enums
export const getDeveloperEnums = async (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        data: {
            roles:             ROLES,
            experienceLevels:  EXPERIENCE_LEVELS,
            skills:            SKILLS,
            statuses:          DEV_STATUSES
        }
    })
}


// generate random password
const generatePassword = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefghjkmnpqrstwxyz23456789@#$'
    let pass = ''
    for (let i = 0; i < 10; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)]
    }
    return pass
}

export const createDeveloper = async (req: Request, res: Response) => {

    const parsed = createDeveloperSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { name, phone, email, role, experience, skills, status, joinedAt } = parsed.data

    const existing = await prisma.developer.findUnique({ where: { phone } })

    if (existing) {
        res.status(409).json({
            success: false,
            message: 'Developer with this phone already exists'
        })
        return
    }

    const plainPassword = generatePassword()
    const hash          = await bcrypt.hash(plainPassword, 12)

    const developer = await prisma.developer.create({
    data: {
        name,
        phone,
        email:      email,   // ← change null to undefined
        role,
        experience,
        skills,
        status:     status     || 'Active',
        joinedAt:   joinedAt ? new Date(joinedAt) : new Date(),
        password:   hash
    }
})

    let emailSent = false

    if (developer.email) {
        try {
            await sendDeveloperWelcomeEmail({
                email:    developer.email,
                name:     developer.name,
                password: plainPassword,
                role:     developer.role
            })
            emailSent = true
        } catch (err: any) {
            console.error('Developer welcome email failed:', err.message)
        }
    }

    res.status(201).json({
        success: true,
        message: emailSent
            ? 'Developer created and welcome email sent'
            : 'Developer created (no email sent)',
        data: {
            id:         developer.id,
            name:       developer.name,
            email:      developer.email  ?? null,
            phone:      developer.phone,
            role:       developer.role,
            experience: developer.experience,
            skills:     developer.skills,
            status:     developer.status,
            emailSent
        }
    })
}