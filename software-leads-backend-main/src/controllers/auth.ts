import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import {
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
    parseDuration
} from '../lib/jwt'
import {
    setAccessCookie,
    setRefreshCookie,
    clearAuthCookies
} from '../lib/cookies'

// ─── SCHEMAS ──────────────────────────────────────

const loginSchema = z.object({
    email:    z.string().email('Invalid email'),
    password: z.string().min(1, 'Password required')
})

const createUserSchema = z.object({
    name:     z.string().min(2, 'Name required'),
    email:    z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role:     z.enum(['ADMIN', 'USER']).optional()
})

const updateUserSchema = z.object({
    name:     z.string().min(2).optional(),
    email:    z.string().email().optional(),
    password: z.string().min(8).optional(),
    role:     z.enum(['ADMIN', 'USER']).optional()
})

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password required'),
    newPassword:     z.string().min(8, 'New password must be at least 8 characters')
})

// ─── HELPERS ──────────────────────────────────────

const issueTokens = async (
    req:    Request,
    res:    Response,
    userId: string,
    role:   string
) => {
    const expiresAt = new Date(
        Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    )

    const refreshRecord = await prisma.refreshToken.create({
        data: {
            userId,
            userAgent: req.headers['user-agent'] || null,
            ipAddress: req.ip                    || null,
            expiresAt
        }
    })

    const accessToken = signAccessToken({ userId, role })

    const refreshToken = signRefreshToken({
        userId,
        jti: refreshRecord.id
    })

    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)

    return accessToken
}

// ─── CONTROLLERS ──────────────────────────────────

// LOGIN
export const login = async (req: Request, res: Response) => {

    const parsed = loginSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
        res.status(401).json({ success: false, message: 'Invalid credentials' })
        return
    }

    const accessToken = await issueTokens(req, res, user.id, user.role)

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role,
            token: accessToken
        }
    })
}

// REFRESH — rotate tokens with reuse detection
export const refresh = async (req: Request, res: Response) => {

    const token = req.cookies.refresh_token

    if (!token) {
        res.status(401).json({ success: false, message: 'No refresh token' })
        return
    }

    let payload
    try {
        payload = verifyRefreshToken(token)
    } catch {
        clearAuthCookies(res)
        res.status(401).json({ success: false, message: 'Invalid refresh token' })
        return
    }

    const record = await prisma.refreshToken.findUnique({
        where: { id: payload.jti }
    })

    if (!record) {
        clearAuthCookies(res)
        res.status(401).json({ success: false, message: 'Refresh token not found' })
        return
    }

    // REUSE DETECTED — revoke entire chain
    if (record.revokedAt) {
        await prisma.refreshToken.updateMany({
            where: {
                userId:    record.userId,
                revokedAt: null
            },
            data: { revokedAt: new Date() }
        })

        clearAuthCookies(res)
        res.status(401).json({
            success: false,
            message: 'Refresh token reuse detected. All sessions revoked.'
        })
        return
    }

    // check expiry
    if (record.expiresAt < new Date()) {
        clearAuthCookies(res)
        res.status(401).json({ success: false, message: 'Refresh token expired' })
        return
    }

    // validate device
    const currentUA = req.headers['user-agent'] || null
    if (record.userAgent && record.userAgent !== currentUA) {
        await prisma.refreshToken.update({
            where: { id: record.id },
            data:  { revokedAt: new Date() }
        })
        clearAuthCookies(res)
        res.status(401).json({
            success: false,
            message: 'Device mismatch. Please login again.'
        })
        return
    }

    const user = await prisma.user.findUnique({ where: { id: record.userId } })

    if (!user) {
        clearAuthCookies(res)
        res.status(401).json({ success: false, message: 'User not found' })
        return
    }

    // ROTATION — create new token, revoke old
    const expiresAt = new Date(
        Date.now() + parseDuration(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    )

    const newRecord = await prisma.refreshToken.create({
        data: {
            userId:    user.id,
            userAgent: currentUA,
            ipAddress: req.ip || null,
            expiresAt
        }
    })

    await prisma.refreshToken.update({
        where: { id: record.id },
        data: {
            revokedAt:  new Date(),
            replacedBy: newRecord.id
        }
    })

    const accessToken  = signAccessToken({ userId: user.id, role: user.role })
    const refreshToken = signRefreshToken({
        userId: user.id,
        jti:    newRecord.id
    })

    setAccessCookie(res, accessToken)
    setRefreshCookie(res, refreshToken)

    res.status(200).json({
        success: true,
        data: {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role
        }
    })
}

// LOGOUT
export const logout = async (req: Request, res: Response) => {

    const token = req.cookies.refresh_token

    if (token) {
        try {
            const payload = verifyRefreshToken(token)

            await prisma.refreshToken.updateMany({
                where: {
                    id:        payload.jti,
                    revokedAt: null
                },
                data: { revokedAt: new Date() }
            })
        } catch {
            // ignore
        }
    }

    clearAuthCookies(res)

    res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    })
}

// LOGOUT all devices
export const logoutAll = async (req: Request, res: Response) => {

    const userId = (req as any).user?.userId

    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
    }

    await prisma.refreshToken.updateMany({
        where: {
            userId,
            revokedAt: null
        },
        data: { revokedAt: new Date() }
    })

    clearAuthCookies(res)

    res.status(200).json({
        success: true,
        message: 'Logged out from all devices'
    })
}

// GET ME
export const getMe = async (req: Request, res: Response) => {

    const userId = (req as any).user?.userId

    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
    }

    const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: {
            id:    true,
            name:  true,
            email: true,
            role:  true
        }
    })

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' })
        return
    }

    res.status(200).json({ success: true, data: user })
}

// CHANGE PASSWORD (own)
export const changePassword = async (req: Request, res: Response) => {

    const userId = (req as any).user?.userId

    if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized' })
        return
    }

    const parsed = changePasswordSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { currentPassword, newPassword } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' })
        return
    }

    const valid = await bcrypt.compare(currentPassword, user.password)

    if (!valid) {
        res.status(401).json({ success: false, message: 'Current password is incorrect' })
        return
    }

    const hash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
        where: { id: userId },
        data:  { password: hash }
    })

    // revoke all refresh tokens — force re-login on other devices
    await prisma.refreshToken.updateMany({
        where: {
            userId,
            revokedAt: null
        },
        data: { revokedAt: new Date() }
    })

    clearAuthCookies(res)

    res.status(200).json({
        success: true,
        message: 'Password changed. Please login again.'
    })
}

// ─── USER MANAGEMENT (Admin only) ──────────────────

// GET all users
export const getAllUsers = async (req: Request, res: Response) => {

    const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
            id:        true,
            name:      true,
            email:     true,
            role:      true,
            createdAt: true,
            updatedAt: true
        }
    })

    res.status(200).json({
        success: true,
        data: { users }
    })
}

// CREATE user (admin only)
export const createUser = async (req: Request, res: Response) => {

    const parsed = createUserSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { name, email, password, role } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
        res.status(409).json({
            success: false,
            message: 'User with this email already exists'
        })
        return
    }

    const hash = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hash,
            role:     role || 'USER'
        },
        select: {
            id:        true,
            name:      true,
            email:     true,
            role:      true,
            createdAt: true
        }
    })

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        data:    user
    })
}

// UPDATE user (admin only)
export const updateUser = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.user.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'User not found' })
        return
    }

    const parsed = updateUserSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    if (data.email && data.email !== existing.email) {
        const emailTaken = await prisma.user.findUnique({ where: { email: data.email } })
        if (emailTaken) {
            res.status(409).json({
                success: false,
                message: 'Email already used by another user'
            })
            return
        }
    }

    if (data.password) {
        data.password = await bcrypt.hash(data.password, 12)
    }

    const updated = await prisma.user.update({
        where: { id },
        data,
        select: {
            id:        true,
            name:      true,
            email:     true,
            role:      true,
            updatedAt: true
        }
    })

    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data:    updated
    })
}

// DELETE user (admin only)
export const deleteUser = async (req: Request, res: Response) => {

    const id        = req.params.id            as string
    const currentId = (req as any).user?.userId

    if (id === currentId) {
        res.status(400).json({
            success: false,
            message: 'You cannot delete your own account'
        })
        return
    }

    const existing = await prisma.user.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'User not found' })
        return
    }

    await prisma.user.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    })
}