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
    const token = req.cookies.employee_access_token

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