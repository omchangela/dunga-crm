import { Request, Response } from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import prisma from '../lib/prisma'
import { buildEstimationPdfBuffer, buildPaymentReceiptPdfBuffer } from '../lib/pdfGenerator'

const PDF_CACHE_DIR = path.join('/tmp', 'crm_pdfs')
if (!fs.existsSync(PDF_CACHE_DIR)) {
    try {
        fs.mkdirSync(PDF_CACHE_DIR, { recursive: true })
    } catch (e) {
        console.warn('[PublicPDF] Could not create cache dir:', e)
    }
}

// In-memory cache for ultra-fast serving (with 24hr expiration)
interface CacheItem {
    buffer: Buffer
    fileName: string
    createdAt: number
}

const memoryPdfCache = new Map<string, CacheItem>()

// Evict items older than 24 hours every hour
setInterval(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    for (const [key, item] of memoryPdfCache.entries()) {
        if (item.createdAt < oneDayAgo) {
            memoryPdfCache.delete(key)
        }
    }
}, 60 * 60 * 1000)

export function storePublicPdf(buffer: Buffer, fileName: string): { fileId: string; url: string } {
    const fileId = crypto.randomBytes(12).toString('hex')
    const safeName = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')

    memoryPdfCache.set(fileId, {
        buffer,
        fileName: safeName,
        createdAt: Date.now()
    })

    try {
        fs.writeFileSync(path.join(PDF_CACHE_DIR, `${fileId}.pdf`), buffer)
    } catch (e) {
        console.warn('[PublicPDF] Disk write notice:', e)
    }

    const baseUrl = process.env.PUBLIC_API_URL || 'https://dunga-crm-api.onrender.com'
    return {
        fileId,
        url: `${baseUrl}/api/public/pdf/download/${fileId}/${encodeURIComponent(safeName)}`
    }
}

export function getPublicPdf(fileId: string): { buffer: Buffer; fileName: string } | null {
    const mem = memoryPdfCache.get(fileId)
    if (mem) return { buffer: mem.buffer, fileName: mem.fileName }

    const filePath = path.join(PDF_CACHE_DIR, `${fileId}.pdf`)
    if (fs.existsSync(filePath)) {
        try {
            const buffer = fs.readFileSync(filePath)
            return { buffer, fileName: `${fileId}.pdf` }
        } catch (e) {
            console.warn('[PublicPDF] Disk read error:', e)
        }
    }
    return null
}

// Handler for uploading PDF buffer (called by backend/scripts to obtain a live public URL for WhatsApp Cloud API)
export const handlePublicPdfUpload = async (req: Request, res: Response) => {
    try {
        const { fileName, base64 } = req.body
        if (!base64) {
            res.status(400).json({ success: false, message: 'Base64 PDF content is required' })
            return
        }

        const buffer = Buffer.from(base64, 'base64')
        const stored = storePublicPdf(buffer, fileName || 'document.pdf')

        res.status(200).json({
            success: true,
            fileId: stored.fileId,
            url: stored.url
        })
    } catch (err: any) {
        console.error('[PublicPDF Upload Error]:', err)
        res.status(500).json({ success: false, message: 'Failed to store PDF', error: err?.message })
    }
}

// Handler for downloading/viewing cached PDF
export const handlePublicPdfDownload = async (req: Request, res: Response) => {
    const fileId = req.params.fileId as string
    const item = getPublicPdf(fileId)

    if (!item) {
        res.status(404).send('PDF document not found or link has expired.')
        return
    }

    const fileName = (req.params.fileName as string) || item.fileName || 'document.pdf'
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(item.buffer)
}

// Handler for dynamically generating & serving estimation PDF on the fly
export const handleDynamicEstimationPdf = async (req: Request, res: Response) => {
    const projectId = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { customer: true }
    })

    if (!project) {
        res.status(404).send('Project not found')
        return
    }

    try {
        const buffer = await buildEstimationPdfBuffer(project)
        const safeName = `Estimation_${(project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
        res.send(buffer)
    } catch (err: any) {
        console.error('[Dynamic Estimation PDF Error]:', err)
        res.status(500).send('Failed to generate estimation PDF')
    }
}

// Handler for dynamically generating & serving payment receipt PDF on the fly
export const handleDynamicReceiptPdf = async (req: Request, res: Response) => {
    const projectId = req.params.id as string
    const payIndex = parseInt(String(req.query.payIndex || '0'))

    const project: any = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            customer: true,
            transactions: {
                where: { source: { not: 'SUBSCRIPTION' } },
                orderBy: { paymentDate: 'asc' }
            }
        }
    })

    if (!project) {
        res.status(404).send('Project not found')
        return
    }

    try {
        const payments = (project.payments as any[]) || []
        const safeIndex = Math.min(Math.max(0, payIndex), Math.max(0, payments.length - 1))
        const selectedPay = payments[safeIndex]
        const itemAmount = parseFloat(selectedPay?.amount) || 0

        const costHistory = (project.costHistory as any[]) || []
        const totalBudget = project.budget + costHistory.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0)
        const transactions = (project as any).transactions || []
        const totalPaid = transactions.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
        const remainingBalance = Math.max(0, totalBudget - totalPaid)

        const latestTxn = transactions.length > 0 ? transactions[transactions.length - 1] : null
        const receiptNo = latestTxn?.id
            ? 'REC-' + latestTxn.id.split('-')[0].toUpperCase()
            : `REC-${Date.now().toString().slice(-6)}`

        const buffer = await buildPaymentReceiptPdfBuffer({
            receiptNo,
            date: latestTxn?.paymentDate || new Date(),
            customerName: project.customer?.fullName || 'Valued Customer',
            customerPhone: project.customer?.phone || undefined,
            customerEmail: project.customer?.email || undefined,
            applicationNumber: project.customer?.applicationNumber || undefined,
            projectName: project.projectName,
            paymentDescription: selectedPay?.description || 'Milestone Payment Receipt',
            amountPaid: latestTxn?.amount || itemAmount || totalPaid,
            totalBudget,
            totalPaid,
            remainingBalance,
            paymentMethod: latestTxn?.paymentMethod || 'Bank Transfer',
            transactionId: latestTxn?.transactionId || undefined,
            note: latestTxn?.note || undefined,
            schedules: project.schedules as any[]
        })

        const safeName = `Receipt_${receiptNo}.pdf`
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`)
        res.send(buffer)
    } catch (err: any) {
        console.error('[Dynamic Receipt PDF Error]:', err)
        res.status(500).send('Failed to generate receipt PDF')
    }
}

