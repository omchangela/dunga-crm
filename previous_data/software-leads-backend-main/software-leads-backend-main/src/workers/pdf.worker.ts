// import 'dotenv/config'
// import { Worker, Job } from 'bullmq'
// import prisma from '../lib/prisma'
// import supabase, { BUCKET }          from '../lib/supabase'
// import { generateEstimationPdf }     from '../lib/generateEstimationPdf'
// import { generateProjectPdf }        from '../lib/generateProjectPdf'
// import { sendEstimationEmail }       from '../lib/sendEstimationEmail'
// import { redisConnection }           from '../lib/redis'
// import { PdfJobData, PdfJobResult }  from '../lib/queues/pdfQueue'

// const processPdfJob = async (
//     job: Job<PdfJobData, PdfJobResult>
// ): Promise<PdfJobResult> => {

//     const { projectId, type } = job.data

//     // ─── Step 1: Fetch project ──────────────────────
//     await job.updateProgress(10)
//     await job.log(`Fetching project ${projectId}`)

//     const project = await prisma.project.findUnique({
//         where: { id: projectId },
//         include: {
//             customer: {
//                 select: {
//                     id:                true,
//                     fullName:          true,
//                     phone:             true,
//                     email:             true,
//                     applicationNumber: true
//                 }
//             }
//         }
//     })

//     if (!project) {
//         throw new Error(`Project ${projectId} not found`)
//     }

//     // ─── Step 2: Fetch developers (project PDF only) ─
//     let developers: any[] = []

//     if (type === 'PROJECT' && project.developers?.length > 0) {
//         developers = await prisma.developer.findMany({
//             where: { id: { in: project.developers } }
//         })
//     }

//     // ─── Step 3: Generate PDF ───────────────────────
//     await job.updateProgress(25)
//     await job.log(`Generating ${type} PDF...`)

//     const sanitizedName = project.projectName
//         .replace(/[^a-zA-Z0-9]/g, '_')
//         .substring(0, 40)

//     const timestamp = Date.now()
//     const suffix    = type === 'PROJECT' ? '_project' : ''
//     const fileName  = `${sanitizedName}${suffix}_${timestamp}.pdf`
//     const folder    = type === 'PROJECT' ? 'project' : 'estimation'
//     const filePath  = `${folder}/${project.id}/${fileName}`

//     const pdfBuffer = type === 'PROJECT'
//         ? await generateProjectPdf(project, developers)
//         : await generateEstimationPdf(project)

//     // ─── Step 4: Upload to Supabase ─────────────────
//     await job.updateProgress(60)
//     await job.log(`Uploading PDF to storage...`)

//     const { error: uploadError } = await supabase.storage
//         .from(BUCKET)
//         .upload(filePath, pdfBuffer, {
//             contentType: 'application/pdf',
//             upsert:      false
//         })

//     if (uploadError) {
//         throw new Error(`Upload failed: ${uploadError.message}`)
//     }

//     // ─── Step 5: Get URLs ───────────────────────────
//     await job.updateProgress(75)

//     const { data: urlData } = supabase.storage
//         .from(BUCKET)
//         .getPublicUrl(filePath)

//     const { data: signedData } = await supabase.storage
//         .from(BUCKET)
//         .createSignedUrl(filePath, 3600)

//     // ─── Step 6: Save URL to DB ─────────────────────
//     await job.updateProgress(85)
//     await job.log(`Saving PDF URL to database...`)

//     if (type === 'PROJECT') {
//         await prisma.project.update({
//             where: { id: projectId },
//             data: {
//                 projectPdfUrl: urlData.publicUrl,
//                 projectPdfAt:  new Date()
//             }
//         })
//     } else {
//         await prisma.project.update({
//             where: { id: projectId },
//             data: {
//                 estimationPdfUrl: urlData.publicUrl,
//                 estimationPdfAt:  new Date()
//             }
//         })
//     }

//     // ─── Step 7: Send Email ─────────────────────────
//     await job.updateProgress(90)

//     let emailSent = false

//     if (type === 'ESTIMATION' && project.customer?.email) {
//         await job.log(`Sending email to ${project.customer.email}...`)

//         try {
//             await sendEstimationEmail({
//                 email:        project.customer.email,
//                 customerName: project.customer.fullName,
//                 projectName:  project.projectName,
//                 pdfBuffer,
//                 fileName
//             })

//             emailSent = true
//             await job.log('Email sent successfully')

//         } catch (emailErr: any) {
//             await job.log(`Email failed (non-fatal): ${emailErr.message}`)
//         }
//     }

//     // ─── Step 8: Done ───────────────────────────────
//     await job.updateProgress(100)
//     await job.log('PDF job complete')

//     return {
//         success:   true,
//         pdfUrl:    urlData.publicUrl,
//         signedUrl: signedData?.signedUrl,
//         fileName,
//         emailSent
//     }
// }

// // ─── Start Worker ──────────────────────────────────

// const worker = new Worker<PdfJobData, PdfJobResult>(
//     'pdf-generation',
//     processPdfJob,
//     {
//         ...redisConnection,
//         concurrency: 2    // process 2 PDF jobs simultaneously
//     }
// )

// worker.on('completed', (job, result) => {
//     console.log(`✓ PDF job ${job.id} completed:`, result.fileName)
// })

// worker.on('failed', (job, err) => {
//     console.error(`✗ PDF job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message)
// })

// worker.on('progress', (job, progress) => {
//     console.log(`PDF job ${job.id} progress: ${progress}%`)
// })

// console.log('PDF worker started, waiting for jobs...')

import 'dotenv/config'
import { Worker }                   from 'bullmq'
import { redisConnection }          from '../lib/redis'
import { processPdfJob }            from './pdf.processor'
import { PdfJobData, PdfJobResult } from '../lib/queues/pdfQueue'

const worker = new Worker<PdfJobData, PdfJobResult>(
    'pdf-generation',
    processPdfJob,
    {
        ...redisConnection,
        concurrency: 1
    }
)

worker.on('completed', (job, result) =>
    console.log(`✓ PDF job ${job.id} done:`, result?.fileName)
)
worker.on('failed', (job, err) =>
    console.error(`✗ PDF job ${job?.id} failed:`, err.message)
)

console.log('PDF worker started...')