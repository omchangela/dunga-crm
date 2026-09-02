import { Response } from 'express'
import { parseDuration } from './jwt'

const ACCESS_EXPIRES  = process.env.JWT_ACCESS_EXPIRES_IN  || '15m'
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d'
const isProd          = process.env.NODE_ENV === 'production'

const baseCookieOptions = {
    httpOnly: true,
    secure:   isProd,
    sameSite: (isProd ? 'none' : 'lax') as any,
    path:     '/'
}

export const setAccessCookie = (res: Response, token: string) => {
    res.cookie('access_token', token, {
        ...baseCookieOptions,
        maxAge: parseDuration(ACCESS_EXPIRES)
    })
}

export const setRefreshCookie = (res: Response, token: string) => {
    res.cookie('refresh_token', token, {
        ...baseCookieOptions,
        maxAge: parseDuration(REFRESH_EXPIRES)
    })
}

export const clearAuthCookies = (res: Response) => {
    res.clearCookie('access_token',  baseCookieOptions)
    res.clearCookie('refresh_token', baseCookieOptions)
}