import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import { SERVICE_TYPES } from '../lib/enums'
import { generateEstimationPdf } from '../lib/generateEstimationPdf'
import supabase, { BUCKET } from '../lib/supabase'

import { generateProjectPdf } from '../lib/generateProjectPdf'
import { sendEstimationEmail } from '../lib/sendEstimationEmail'
import { sendProjectPdfEmail } from '../lib/sendProjectPdfEmail'


// ─── HELPERS ──────────────────────────────────────

// strip empty rows from arrays
const cleanRows = (rows: any[], fields: string[]): any[] => {
    return rows.filter(row =>
        fields.some(f => row[f] && String(row[f]).trim() !== '')
    )
}

// calculate budget from payments
const calculateBudget = (payments: any[]): number => {
    return payments.reduce((sum, p) => {
        const amount = parseFloat(p.amount) || 0
        return sum + amount
    }, 0)
}

// calculate total project cost (budget + cost history)
const calculateTotal = (budget: number, costHistory: any[]): number => {
    const additions = costHistory.reduce((sum, c) => {
        return sum + (parseFloat(c.amount) || 0)
    }, 0)
    return budget + additions
}

// generate unique id with prefix
const genId = (prefix: string): string => {
    return `${prefix}-${Math.random().toString(36).substring(2, 8)}`
}

// calculate calendar deadline from working days
// excludes weekends (2 days every 7) and holidays (2 days every 30 calendar)
const calculateDeadline = (
    timelines: any[],
    startDate: Date = new Date()
): Date | null => {

    if (!timelines || timelines.length === 0) return null

    // sum all working days
    const totalWorkingDays = timelines.reduce((sum, t) => {
        const days = parseInt(String(t.workingDays)) || 0
        return sum + days
    }, 0)

    if (totalWorkingDays === 0) return null

    // 5 working days = 7 calendar days
    let calendarDays = Math.ceil((totalWorkingDays * 7) / 5)

    // add 2 public holidays per 30 calendar days
    const holidayBuffer = Math.floor(calendarDays / 30) * 2
    calendarDays += holidayBuffer

    const deadline = new Date(startDate)
    deadline.setDate(deadline.getDate() + calendarDays)

    return deadline
}

// ─── SCHEMAS ──────────────────────────────────────

const paymentRowSchema = z.object({
    description: z.string().optional(),
    amount:      z.union([z.string(), z.number()]).optional()
})

const timelineRowSchema = z.object({
    description: z.string().optional(),
    workingDays: z.union([z.string(), z.number()]).optional()
})

const scheduleRowSchema = z.object({
    description: z.string().optional(),
    payment:     z.union([z.string(), z.number()]).optional()
})

const createProjectSchema = z.object({
    projectName:   z.string().min(2, 'Project name required'),
    description:   z.string().optional(),
    serviceType:   z.enum(SERVICE_TYPES),
    webOverview:   z.array(z.string()).optional(),
    appOverview:   z.array(z.string()).optional(),
    adminOverview: z.array(z.string()).optional(),
    payments:      z.array(paymentRowSchema).optional(),
    timelines:     z.array(timelineRowSchema).optional(),
    schedules:     z.array(scheduleRowSchema).optional()
})

const updateProjectSchema = z.object({
    projectName:   z.string().min(2).optional(),
    description:   z.string().optional(),
    serviceType:   z.enum(SERVICE_TYPES).optional(),
    status:        z.enum([
        'PENDING', 'CONVERTED', 'REJECTED',
        'ACTIVE',  'COMPLETED', 'ON_HOLD', 'CANCELLED'
    ]).optional(),
    webOverview:   z.array(z.string()).optional(),
    appOverview:   z.array(z.string()).optional(),
    adminOverview: z.array(z.string()).optional(),
    payments:      z.array(paymentRowSchema).optional(),
    timelines:     z.array(timelineRowSchema).optional(),
    schedules:     z.array(scheduleRowSchema).optional()
})

const updateDeadlineSchema = z.object({
    deadline: z.string().optional().nullable()
})

const assignDevelopersSchema = z.object({
    developers: z.array(z.string()),
    deadline:   z.string().optional().nullable()
})

const addFeatureSchema = z.object({
    name:  z.string().min(1, 'Feature name required'),
    price: z.union([z.string(), z.number()]).optional()
})

// ─── CONTROLLERS ──────────────────────────────────

// CREATE project for customer
export const createProject = async (req: Request, res: Response) => {

    const customerId = req.params.customerId as string

    const customer = await prisma.customer.findUnique({
        where: { id: customerId }
    })

    if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' })
        return
    }

    const parsed = createProjectSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const {
        projectName,
        description,
        serviceType,
        webOverview,
        appOverview,
        adminOverview,
        payments,
        timelines,
        schedules
    } = parsed.data

    // clean empty rows
    const cleanedPayments  = cleanRows(payments  || [], ['description', 'amount'])
    const cleanedTimelines = cleanRows(timelines || [], ['description', 'workingDays'])
    const cleanedSchedules = cleanRows(schedules || [], ['description', 'payment'])

    // calculate budget server-side
    const budget = calculateBudget(cleanedPayments)

    // auto-calculate deadline from working days
    const autoDeadline = calculateDeadline(cleanedTimelines)

    const project = await prisma.project.create({
        data: {
            customerId,
            projectName,
            description:   description || null,
            serviceType,
            status:        'PENDING',
            webOverview:   webOverview   || [],
            appOverview:   appOverview   || [],
            adminOverview: adminOverview || [],
            payments:      cleanedPayments  as any,
            timelines:     cleanedTimelines as any,
            schedules:     cleanedSchedules as any,
            budget,
            deadline:      autoDeadline
        }
    })

    res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data:    project
    })
}

// GET all projects for customer
export const getCustomerProjects = async (req: Request, res: Response) => {

    const customerId = req.params.customerId as string

    const customer = await prisma.customer.findUnique({
        where: { id: customerId }
    })

    if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found' })
        return
    }

    const projects = await prisma.project.findMany({
        where:   { customerId },
        orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({ success: true, data: projects })
}

// GET all projects with filters
export const getAllProjects = async (req: Request, res: Response) => {

    const status = String(req.query.status || '')
    const page   = parseInt(req.query.page  as string) || 1
    const limit  = parseInt(req.query.limit as string) || 10
    const skip   = (page - 1) * limit

    const where: any = {}

    if (status) {
        const statusList = status.split(',').map(s => s.trim().toUpperCase())
        where.status = { in: statusList }
    }

    const [projects, total] = await Promise.all([
        prisma.project.findMany({
            where,
            skip,
            take:    limit,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: {
                    select: {
                        id:       true,
                        fullName: true,
                        phone:    true
                    }
                }
            }
        }),
        prisma.project.count({ where })
    ])

    res.status(200).json({
        success: true,
        data: {
            projects,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext:    page < Math.ceil(total / limit),
                hasPrev:    page > 1
            }
        }
    })
}

// GET single project
export const getProject = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id },
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

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const costHistory      = (project.costHistory as any[]) || []
    const totalProjectCost = calculateTotal(project.budget, costHistory)

    res.status(200).json({
        success: true,
        data: {
            ...project,
            totalProjectCost
        }
    })
}

// UPDATE project
export const updateProject = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const parsed = updateProjectSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { ...parsed.data }

    // recompute budget if payments changed
    if (data.payments) {
        data.payments = cleanRows(data.payments, ['description', 'amount'])
        data.budget   = calculateBudget(data.payments)
    }

    // recalculate deadline if timelines changed
    if (data.timelines) {
        data.timelines = cleanRows(data.timelines, ['description', 'workingDays'])

        const newDeadline = calculateDeadline(
            data.timelines,
            existing.createdAt
        )

        if (newDeadline) {
            data.deadline = newDeadline
        }
    }

    if (data.schedules) {
        data.schedules = cleanRows(data.schedules, ['description', 'payment'])
    }

    const updated = await prisma.project.update({
        where: { id },
        data
    })

    res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data:    updated
    })
}

// DELETE project
export const deleteProject = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    await prisma.project.delete({ where: { id } })

    res.status(200).json({
        success: true,
        message: 'Project deleted successfully'
    })
}

// SET deadline manually
export const setDeadline = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const parsed = updateDeadlineSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const updated = await prisma.project.update({
        where: { id },
        data: {
            deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null
        }
    })

    res.status(200).json({
        success: true,
        message: parsed.data.deadline
            ? 'Deadline set successfully'
            : 'Deadline cleared',
        data:    updated
    })
}

// ASSIGN developers
export const assignDevelopers = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const parsed = assignDevelopersSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const data: any = { developers: parsed.data.developers }

    if (parsed.data.deadline) {
        data.deadline = new Date(parsed.data.deadline)
    }

    const updated = await prisma.project.update({
        where: { id },
        data
    })

    res.status(200).json({
        success: true,
        message: 'Developers assigned successfully',
        data:    updated
    })
}

// ADD feature
export const addFeature = async (req: Request, res: Response) => {

    const id = req.params.id as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const parsed = addFeatureSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            errors:  parsed.error.flatten().fieldErrors
        })
        return
    }

    const { name, price } = parsed.data
    const amount = parseFloat(String(price)) || 0

    const featureItems = (existing.featureItems as any[]) || []
    const costHistory  = (existing.costHistory  as any[]) || []

    const featureId = genId('feat')
    const newFeature = {
        id:    featureId,
        name,
        price: String(amount)
    }

    featureItems.push(newFeature)

    if (amount > 0) {
        costHistory.push({
            id:      genId('ch'),
            label:   name,
            amount,
            addedAt: new Date().toISOString()
        })
    }

    const updated = await prisma.project.update({
        where: { id },
        data: {
            featureItems: featureItems as any,
            costHistory:  costHistory  as any
        }
    })

    res.status(201).json({
        success: true,
        message: 'Feature added successfully',
        data: {
            ...updated,
            totalProjectCost: calculateTotal(updated.budget, costHistory)
        }
    })
}

// REMOVE feature
export const removeFeature = async (req: Request, res: Response) => {

    const id        = req.params.id        as string
    const featureId = req.params.featureId as string

    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const featureItems = (existing.featureItems as any[]) || []
    const costHistory  = (existing.costHistory  as any[]) || []

    const feature = featureItems.find(f => f.id === featureId)

    if (!feature) {
        res.status(404).json({ success: false, message: 'Feature not found' })
        return
    }

    const newFeatures = featureItems.filter(f => f.id !== featureId)

    const newCostHistory = costHistory.filter(c =>
        !(c.label === feature.name &&
          parseFloat(c.amount) === parseFloat(feature.price))
    )

    const updated = await prisma.project.update({
        where: { id },
        data: {
            featureItems: newFeatures    as any,
            costHistory:  newCostHistory as any
        }
    })

    res.status(200).json({
        success: true,
        message: 'Feature removed successfully',
        data: {
            ...updated,
            totalProjectCost: calculateTotal(updated.budget, newCostHistory)
        }
    })
}

import {
  buildEstimationPdfBuffer,
  buildProjectContractPdfBuffer,
  buildPaymentReceiptPdfBuffer
} from '../lib/pdfGenerator'

// GENERATE estimation PDF (Instant / Synchronous)
export const generatePdf = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            customer: {
                select: {
                    id: true, fullName: true, phone: true, email: true, applicationNumber: true
                }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    try {
        const pdfBuffer = await buildEstimationPdfBuffer(project)
        const base64Data = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64Data}`

        const sanitizedName = (project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
        const fileName = `${sanitizedName}_estimation_${Date.now()}.pdf`
        const filePath = `estimation/${project.id}/${fileName}`

        let publicUrl = dataUrl
        try {
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
                if (urlData?.publicUrl) publicUrl = urlData.publicUrl
            }
        } catch (e) {
            console.log('Supabase upload skipped, using base64 data URL')
        }

        const updated = await prisma.project.update({
            where: { id },
            data: {
                estimationPdfUrl: publicUrl,
                estimationPdfAt: new Date()
            }
        })

        if (project.customer?.email) {
            sendEstimationEmail({
                email: project.customer.email,
                customerName: project.customer.fullName,
                projectName: project.projectName,
                pdfBuffer,
                fileName
            }).catch(console.error)
        }

        res.status(200).json({
            success: true,
            message: 'PDF generated successfully',
            data: {
                pdfUrl: publicUrl,
                downloadUrl: dataUrl,
                signedUrl: dataUrl,
                fileName,
                generatedAt: updated.estimationPdfAt
            }
        })
    } catch (err: any) {
        console.error('PDF Generation Error:', err)
        res.status(500).json({ success: false, message: 'Failed to generate PDF', error: err?.message })
    }
}

// GENERATE project contract PDF (Instant / Synchronous)
export const generateProjectPdfController = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            customer: {
                select: {
                    id: true, fullName: true, phone: true, email: true, applicationNumber: true
                }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    let developers: any[] = []
    if (project.developers && project.developers.length > 0) {
        developers = await prisma.developer.findMany({
            where: { id: { in: project.developers } }
        })
    }

    try {
        const pdfBuffer = await buildProjectContractPdfBuffer(project, developers)
        const base64Data = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64Data}`

        const sanitizedName = (project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
        const fileName = `${sanitizedName}_contract_${Date.now()}.pdf`
        const filePath = `project/${project.id}/${fileName}`

        let publicUrl = dataUrl
        try {
            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

            if (!uploadError) {
                const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
                if (urlData?.publicUrl) publicUrl = urlData.publicUrl
            }
        } catch (e) {
            console.log('Supabase upload skipped, using base64 data URL')
        }

        const updated = await prisma.project.update({
            where: { id },
            data: {
                projectPdfUrl: publicUrl,
                projectPdfAt: new Date()
            }
        })

        if (project.customer?.email) {
            sendProjectPdfEmail({
                email: project.customer.email,
                customerName: project.customer.fullName,
                projectName: project.projectName,
                pdfBuffer,
                fileName
            }).catch(console.error)
        }

        res.status(200).json({
            success: true,
            message: 'Project Contract PDF generated successfully',
            data: {
                pdfUrl: publicUrl,
                downloadUrl: dataUrl,
                signedUrl: dataUrl,
                fileName,
                generatedAt: updated.projectPdfAt
            }
        })
    } catch (err: any) {
        console.error('Project PDF Generation Error:', err)
        res.status(500).json({ success: false, message: 'Failed to generate project PDF', error: err?.message })
    }
}

// GET PDF job status (instant completion compatibility)
export const getPdfJobStatus = async (req: Request, res: Response) => {
    const id = req.params.id || req.params.jobId

    res.status(200).json({
        success: true,
        data: {
            jobId: req.params.jobId,
            state: 'completed',
            progress: 100,
            message: 'PDF ready',
            result: { downloadUrl: `/api/projects/${id}/pdf` }
        }
    })
}

// progress → human message
const getProgressMessage = (progress: number): string => {
    if (progress < 25)  return 'Fetching project data...'
    if (progress < 60)  return 'Generating PDF...'
    if (progress < 75)  return 'Uploading to storage...'
    if (progress < 90)  return 'Saving...'
    if (progress < 100) return 'Sending email...'
    return 'Almost done...'
}

// export const generatePdf = async (req: Request, res: Response) => {

//     const id = req.params.id as string

//     const project = await prisma.project.findUnique({
//         where: { id },
//         include: {
//             customer: {
//                 select: {
//                     id: true,
//                     fullName: true,
//                     phone: true,
//                     email: true,
//                     applicationNumber: true
//                 }
//             }
//         }
//     })

//     if (!project) {
//         res.status(404).json({
//             success: false,
//             message: 'Project not found'
//         })
//         return
//     }

//     const sanitizedName = project.projectName
//         .replace(/[^a-zA-Z0-9]/g, '_')
//         .substring(0, 40)

//     const timestamp = Date.now()
//     const fileName = `${sanitizedName}_${timestamp}.pdf`
//     const filePath = `estimation/${project.id}/${fileName}`

//     try {

//         // Generate PDF
//         const pdfBuffer = await generateEstimationPdf(project)

//         // Upload PDF to Supabase
//         const { error: uploadError } = await supabase.storage
//             .from(BUCKET)
//             .upload(filePath, pdfBuffer, {
//                 contentType: 'application/pdf',
//                 upsert: false
//             })

//         if (uploadError) {
//             console.error('Upload error:', uploadError)

//             res.status(500).json({
//                 success: false,
//                 message: 'Failed to upload PDF',
//                 error: uploadError.message
//             })
//             return
//         }

//         // Public URL
//         const { data: urlData } = supabase.storage
//             .from(BUCKET)
//             .getPublicUrl(filePath)

//         // Signed URL
//         const { data: signedData, error: signedError } =
//             await supabase.storage
//                 .from(BUCKET)
//                 .createSignedUrl(filePath, 3600)

//         if (signedError) {
//             console.error('Signed URL error:', signedError)
//         }

//         // Save URL in DB
//         const updated = await prisma.project.update({
//             where: { id },
//             data: {
//                 estimationPdfUrl: urlData.publicUrl,
//                 estimationPdfAt: new Date()
//             }
//         })

//         // Send Email To Customer
// let emailSent = false

// console.log('Customer:', project.customer)

// if (project.customer?.email) {

//     console.log('Sending estimation email...')

//     try {

//         await sendEstimationEmail({
//             email: project.customer.email,
//             customerName: project.customer.fullName,
//             projectName: project.projectName,
//             pdfBuffer,
//             fileName
//         })

//         emailSent = true

//         console.log('Email sent successfully')

//     } catch (mailError) {

//         console.error('Email send failed:')
//         console.error(mailError)
//     }

// } else {

//     console.log('Customer email not found')
// }

//         res.status(200).json({
//             success: true,
//             message: emailSent
//                 ? 'PDF generated and emailed successfully'
//                 : 'PDF generated successfully',
//             data: {
//                 pdfUrl: urlData.publicUrl,
//                 signedUrl: signedData?.signedUrl,
//                 fileName,
//                 generatedAt: updated.estimationPdfAt,
//                 emailSent
//             }
//         })

//     } catch (err: any) {

//         console.error('PDF generation error:', err)

//         res.status(500).json({
//             success: false,
//             message: 'Failed to generate PDF',
//             error: err.message
//         })
//     }
// }

// DOWNLOAD Estimation PDF
export const downloadPdf = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            customer: {
                select: {
                    id: true, fullName: true, phone: true, email: true, applicationNumber: true
                }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    try {
        const pdfBuffer = await buildEstimationPdfBuffer(project)
        const base64Data = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64Data}`

        res.status(200).json({
            success: true,
            data: {
                downloadUrl: dataUrl,
                signedUrl: dataUrl,
                fileName: `${(project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_')}_estimation.pdf`,
                expiresIn: '1 hour'
            }
        })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to generate download URL', error: err?.message })
    }
}

// DOWNLOAD Project PDF
export const downloadProjectPdf = async (req: Request, res: Response) => {
    const id = req.params.id as string

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            customer: {
                select: {
                    id: true, fullName: true, phone: true, email: true, applicationNumber: true
                }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    let developers: any[] = []
    if (project.developers && project.developers.length > 0) {
        developers = await prisma.developer.findMany({
            where: { id: { in: project.developers } }
        })
    }

    try {
        const pdfBuffer = await buildProjectContractPdfBuffer(project, developers)
        const base64Data = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64Data}`

        res.status(200).json({
            success: true,
            data: {
                downloadUrl: dataUrl,
                signedUrl: dataUrl,
                fileName: `${(project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_')}_contract.pdf`,
                expiresIn: '1 hour'
            }
        })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to generate download URL', error: err?.message })
    }
}

// GENERATE & DOWNLOAD PAYMENT RECEIPT PDF
export const getPaymentReceiptPdf = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const payIndex = parseInt(String(req.query.payIndex || '0'))

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            customer: true
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const payments = (project.payments as any[]) || []
    const selectedPay = payments[payIndex] || payments[0] || { description: 'Project Payment', amount: project.budget }

    const costHistory = (project.costHistory as any[]) || []
    const totalBudget = calculateTotal(project.budget, costHistory)

    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
    const remainingBalance = Math.max(0, totalBudget - totalPaid)

    const receiptNo = `REC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${(project.id || '').substring(0,4).toUpperCase()}-${payIndex + 1}`

    try {
        const pdfBuffer = await buildPaymentReceiptPdfBuffer({
            receiptNo,
            date: project.updatedAt || project.createdAt,
            customerName: project.customer?.fullName || 'Customer',
            customerPhone: project.customer?.phone || undefined,
            customerEmail: project.customer?.email || undefined,
            applicationNumber: project.customer?.applicationNumber,
            projectName: project.projectName,
            paymentDescription: selectedPay.description || `Payment Item #${payIndex + 1}`,
            amountPaid: parseFloat(selectedPay.amount) || totalPaid || project.budget,
            totalBudget,
            totalPaid,
            remainingBalance
        })

        const base64Data = pdfBuffer.toString('base64')
        const dataUrl = `data:application/pdf;base64,${base64Data}`

        res.status(200).json({
            success: true,
            data: {
                downloadUrl: dataUrl,
                signedUrl: dataUrl,
                fileName: `receipt_${receiptNo}.pdf`,
                receiptNo
            }
        })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to generate receipt PDF', error: err?.message })
    }
}