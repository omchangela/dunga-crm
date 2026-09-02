import { Queue } from 'bullmq'
import { redisConnection } from '../redis'

export interface PdfJobData {
    projectId: string
    type:      'ESTIMATION' | 'PROJECT'
}

export interface PdfJobResult {
    success:    boolean
    pdfUrl?:    string
    signedUrl?: string
    fileName?:  string
    emailSent?: boolean
    error?:     string
}

export const pdfQueue = new Queue<PdfJobData, PdfJobResult>('pdf-generation', {
    ...redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type:  'exponential',
            delay: 2000
        },
        removeOnComplete: { age: 3600, count: 100 },
        removeOnFail:     { age: 86400 }
    }
})