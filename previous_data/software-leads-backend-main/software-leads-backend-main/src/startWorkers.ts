import { Worker }                        from 'bullmq'
import { redisConnection }               from './lib/redis'
import { processPdfJob }                 from './workers/pdf.processor'
import { processImportJob }              from './workers/import.processor'
import { PdfJobData, PdfJobResult }      from './lib/queues/pdfQueue'
import { ImportJobData, ImportJobResult } from './lib/queues/importQueue'

export const startWorkers = () => {

    const pdfWorker = new Worker<PdfJobData, PdfJobResult>(
        'pdf-generation',
        processPdfJob,
        {
            ...redisConnection,
            concurrency: 1
        }
    )

    const importWorker = new Worker<ImportJobData, ImportJobResult>(
        'bulk-import',
        processImportJob,
        {
            ...redisConnection,
            concurrency: 1
        }
    )

    pdfWorker.on('completed',  (job, result) =>
        console.log(`✓ PDF ${job.id} done`)
    )
    pdfWorker.on('failed', (job, err) =>
        console.error(`✗ PDF ${job?.id} failed:`, err.message)
    )

    importWorker.on('completed', (job, result) =>
        console.log(`✓ Import ${job.id}: ${result.imported} imported`)
    )
    importWorker.on('failed', (job, err) =>
        console.error(`✗ Import ${job?.id} failed:`, err.message)
    )

    console.log('✓ BullMQ workers running')
}