import jwt        from 'jsonwebtoken'
import { parseDuration } from './jwt'

const SECRET          = process.env.DEVELOPER_JWT_SECRET || process.env.JWT_ACCESS_SECRET!
const REFRESH         = process.env.DEVELOPER_JWT_REFRESH || process.env.JWT_REFRESH_SECRET!
const ACCESS_EXPIRES  = '8h'
const REFRESH_EXPIRES = '7d'

export interface DeveloperTokenPayload {
    developerId: string
    role:        string
    type:        'developer'
}

export interface DeveloperRefreshPayload {
    developerId: string
    jti:         string
    type:        'developer'
}

export const signDeveloperAccess = (p: Omit<DeveloperTokenPayload, 'type'>): string =>
    jwt.sign({ ...p, type: 'developer' }, SECRET, {
        expiresIn: ACCESS_EXPIRES
    } as jwt.SignOptions)

export const signDeveloperRefresh = (p: Omit<DeveloperRefreshPayload, 'type'>): string =>
    jwt.sign({ ...p, type: 'developer' }, REFRESH, {
        expiresIn: REFRESH_EXPIRES
    } as jwt.SignOptions)

export const verifyDeveloperAccess = (token: string): DeveloperTokenPayload =>
    jwt.verify(token, SECRET) as DeveloperTokenPayload

export const verifyDeveloperRefresh = (token: string): DeveloperRefreshPayload =>
    jwt.verify(token, REFRESH) as DeveloperRefreshPayload

export const DEVELOPER_REFRESH_EXPIRES_MS = parseDuration(REFRESH_EXPIRES)