import { Request, Response, NextFunction } from 'express'
import { verifyDeveloperAccess }            from '../lib/developerJwt'

export interface DeveloperRequest extends Request {
    developer?: {
        developerId: string
        role:        string
    }
}

export const requireDeveloper = (
    req:  DeveloperRequest,
    res:  Response,
    next: NextFunction
) => {
    const token = req.cookies.developer_access_token

    if (!token) {
        res.status(401).json({
            success: false,
            message: 'Developer authentication required'
        })
        return
    }

    try {
        const payload = verifyDeveloperAccess(token)

        if (payload.type !== 'developer') {
            res.status(401).json({
                success: false,
                message: 'Invalid token type'
            })
            return
        }

        req.developer = {
            developerId: payload.developerId,
            role:        payload.role
        }
        next()

    } catch {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        })
    }
}