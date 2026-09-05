import jwt from 'jsonwebtoken'
import { parseDuration } from './jwt'

const ACCESS_SECRET   = process.env.JWT_ACCESS_SECRET!
const REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET!
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface EmployeeTokenPayload {
    employeeId: string
    role:       string
    type:       'employee'
}

export interface EmployeeRefreshPayload {
    employeeId: string
    jti:        string
    type:       'employee'
}

export const signEmployeeAccess = (p: Omit<EmployeeTokenPayload, 'type'>): string =>
    jwt.sign({ ...p, type: 'employee' }, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRES
    } as jwt.SignOptions)

export const signEmployeeRefresh = (p: Omit<EmployeeRefreshPayload, 'type'>): string =>
    jwt.sign({ ...p, type: 'employee' }, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRES
    } as jwt.SignOptions)

export const verifyEmployeeAccess = (token: string): EmployeeTokenPayload =>
    jwt.verify(token, ACCESS_SECRET) as EmployeeTokenPayload

export const verifyEmployeeRefresh = (token: string): EmployeeRefreshPayload =>
    jwt.verify(token, REFRESH_SECRET    ) as EmployeeRefreshPayload

export const EMPLOYEE_REFRESH_EXPIRES_MS = parseDuration(REFRESH_EXPIRES)