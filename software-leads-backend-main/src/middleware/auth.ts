import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt'

export interface AuthRequest extends Request {
    user?: {
        userId: string
        role:   string
    }
}

export const requireAuth = (
    req:  AuthRequest,
    res:  Response,
    next: NextFunction
) => {
    const token = req.cookies.access_token

    if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required' })
        return
    }

    try {
        const payload = verifyAccessToken(token)
        req.user = payload
        next()
    } catch {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired access token'
        })
    }
}

export const requireAdmin = (
    req:  AuthRequest,
    res:  Response,
    next: NextFunction
) => {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Admin access required' })
        return
    }
    next()
}