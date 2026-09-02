import { Queue } from 'bullmq'
import { redisConnection } from '../redis'

export interface ImportJobData {
    csvContent: string
    fileName:   string
}

export interface ImportJobResult {
    success:  boolean
    total:    number
    imported: number
    skipped:  number
    failed:   number
    errors:   { row: number; message: string }[]
    error?:   string
}

export const importQueue = new Queue<ImportJobData, ImportJobResult>('bulk-import', {
    ...redisConnection,
    defaultJobOptions: {
        attempts:         1,
        removeOnComplete: { age: 3600, count: 50 },
        removeOnFail:     { age: 86400 }
    }
})