import { Request, Response, NextFunction } from 'express'
import { verifyEmployeeAccess }            from '../lib/employeeJwt'

export interface EmployeeRequest extends Request {
    employee?: {
        employeeId: string
        role:       string
    }
}

export const requireEmployee = (
    req:  EmployeeRequest,
    res:  Response,
    next: NextFunction
) => {
    let token = req.cookies.employee_access_token
    const authHeader = req.headers.authorization || (req.headers as any)['Authorization']
    if (!token && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim()
    }

    if (!token) {
        res.status(401).json({
            success: false,
            message: 'Employee authentication required'
        })
        return
    }

    try {
        const payload = verifyEmployeeAccess(token)

        if (payload.type !== 'employee') {
            res.status(401).json({
                success: false,
                message: 'Invalid token type'
            })
            return
        }

        req.employee = {
            employeeId: payload.employeeId,
            role:       payload.role
        }
        next()

    } catch {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        })
    }
}