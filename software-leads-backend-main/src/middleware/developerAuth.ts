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
    let token = req.cookies.developer_access_token
    const authHeader = req.headers.authorization || (req.headers as any)['Authorization']
    if (!token && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim()
    }

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