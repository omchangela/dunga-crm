import jwt from 'jsonwebtoken'

const ACCESS_SECRET   = process.env.JWT_ACCESS_SECRET!
const REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET!
const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface AccessTokenPayload {
    userId: string
    role:   string
}

export interface RefreshTokenPayload {
    userId: string
    jti:    string
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
    return jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRES
    } as jwt.SignOptions)
}

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRES
    } as jwt.SignOptions)
}

export const verifyAccessToken = (token: string): AccessTokenPayload => {
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload
}

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
    return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload
}

export const parseDuration = (duration: string): number => {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) return 0

    const value = parseInt(match[1])
    const unit  = match[2]

    const ms = {
        s: 1000,
        m: 1000 * 60,
        h: 1000 * 60 * 60,
        d: 1000 * 60 * 60 * 24
    }[unit] || 0

    return value * ms
}