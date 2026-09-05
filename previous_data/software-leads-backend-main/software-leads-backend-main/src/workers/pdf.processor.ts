import { Job }                       from 'bullmq'
import prisma                        from '../lib/prisma'
import supabase, { BUCKET }          from '../lib/supabase'
import { generateEstimationPdf }     from '../lib/generateEstimationPdf'
import { generateProjectPdf }        from '../lib/generateProjectPdf'
import { sendEstimationEmail }       from '../lib/sendEstimationEmail'
import { PdfJobData, PdfJobResult }  from '../lib/queues/pdfQueue'

export const processPdfJob = async (
    job: Job<PdfJobData, PdfJobResult>
): Promise<PdfJobResult> => {

    const { projectId, type } = job.data

    await job.updateProgress(10)
    await job.log(`Fetching project ${projectId}`)

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            customer: {
                select: {
                    id:                true,
                    fullName:          true,
                    phone:             true,
                    email:             true,
                    applicationNumber: true
                }
            }
        }
    })

    if (!project) throw new Error(`Project ${projectId} not found`)

    let developers: any[] = []

    if (type === 'PROJECT' && project.developers?.length > 0) {
        developers = await prisma.developer.findMany({
            where: { id: { in: project.developers } }
        })
    }

    await job.updateProgress(25)
    await job.log(`Generating ${type} PDF...`)

    const sanitizedName = project.projectName
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 40)

    const timestamp = Date.now()
    const suffix    = type === 'PROJECT' ? '_project' : ''
    const fileName  = `${sanitizedName}${suffix}_${timestamp}.pdf`
    const folder    = type === 'PROJECT' ? 'project' : 'estimation'
    const filePath  = `${folder}/${project.id}/${fileName}`

    const pdfBuffer = type === 'PROJECT'
        ? await generateProjectPdf(project, developers)
        : await generateEstimationPdf(project)

    await job.updateProgress(60)
    await job.log('Uploading to Supabase...')

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert:      false
        })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    await job.updateProgress(75)

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath)

    const { data: signedData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 3600)

    await job.updateProgress(85)
    await job.log('Saving URL to database...')

    if (type === 'PROJECT') {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                projectPdfUrl: urlData.publicUrl,
                projectPdfAt:  new Date()
            }
        })
    } else {
        await prisma.project.update({
            where: { id: projectId },
            data: {
                estimationPdfUrl: urlData.publicUrl,
                estimationPdfAt:  new Date()
            }
        })
    }

    await job.updateProgress(90)

    let emailSent = false

    if (type === 'ESTIMATION' && project.customer?.email) {
        await job.log(`Sending email to ${project.customer.email}...`)
        try {
            await sendEstimationEmail({
                email:        project.customer.email,
                customerName: project.customer.fullName,
                projectName:  project.projectName,
                pdfBuffer,
                fileName
            })
            emailSent = true
            await job.log('Email sent successfully')
        } catch (emailErr: any) {
            await job.log(`Email failed (non-fatal): ${emailErr.message}`)
        }
    }

    await job.updateProgress(100)
    await job.log('PDF job complete')

    return {
        success:   true,
        pdfUrl:    urlData.publicUrl,
        signedUrl: signedData?.signedUrl,
        fileName,
        emailSent
    }
}