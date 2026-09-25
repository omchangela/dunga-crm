import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { z } from 'zod'
import { SERVICE_TYPES } from '../lib/enums'
import { generateEstimationPdf } from '../lib/generateEstimationPdf'
import supabase, { BUCKET } from '../lib/supabase'

import { generateProjectPdf } from '../lib/generateProjectPdf'
import { sendEstimationEmail } from '../lib/sendEstimationEmail'
import { sendProjectPdfEmail } from '../lib/sendProjectPdfEmail'
import {
    sendQuotationAlert,
    sendProjectDiscussionSummary,
    sendWorkStartAlert,
    sendProjectCompleted,
    sendAdvancePaymentRequest,
    sendFinalPaymentRequest,
    sendPaymentReminder,
    sendDailyUpdate,
    sendFinalEstimation
} from '../lib/whatsapp'


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
        'ACTIVE',  'COMPLETED', 'ON_HOLD', 'CANCELLED',
        'DISCUSSION_COMPLETED'
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
            },
            transactions: {
                where: { source: { not: 'SUBSCRIPTION' } },
                orderBy: { paymentDate: 'asc' }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const costHistory      = (project.costHistory as any[]) || []
    const totalProjectCost = calculateTotal(project.budget, costHistory)
    const transactions     = (project as any).transactions || []
    const totalPaid        = transactions.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
    const remainingBalance = Math.max(0, totalProjectCost - totalPaid)

    res.status(200).json({
        success: true,
        data: {
            ...project,
            totalProjectCost,
            totalPaid,
            remainingBalance
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

    // ─── WhatsApp Automated Status Notifications ───────────────────────
    if (data.status) {
        try {
            const project = await prisma.project.findUnique({
                where: { id },
                include: { customer: { select: { fullName: true, phone: true } } }
            })

            if (project?.customer?.phone) {
                if (data.status === 'DISCUSSION_COMPLETED') {
                    const summary = data.description || project.description || 'Project requirements discussed with client.'
                    await sendProjectDiscussionSummary({
                        clientPhone:    project.customer.phone,
                        clientName:     project.customer.fullName,
                        projectSummary: summary,
                        projectId:      id
                    })
                } else if (data.status === 'ACTIVE' || data.status === 'CONVERTED') {
                    await sendWorkStartAlert({
                        clientPhone: project.customer.phone,
                        clientName:  project.customer.fullName,
                        projectName: project.projectName,
                        projectId:   id
                    })
                } else if (data.status === 'COMPLETED') {
                    await sendProjectCompleted({
                        clientPhone: project.customer.phone,
                        clientName:  project.customer.fullName,
                        projectName: project.projectName,
                        projectId:   id
                    })
                }
            }
        } catch (waErr) {
            console.error('[WhatsApp Status Trigger Notice]:', waErr)
        }
    }

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

        if (project.customer?.phone) {
            sendQuotationAlert({
                clientPhone: project.customer.phone,
                clientName: project.customer.fullName,
                projectName: project.projectName,
                budget: project.budget,
                serviceType: project.serviceType,
                pdfUrl: publicUrl.startsWith('data:') ? null : publicUrl,
                projectId: project.id
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

// SEND ESTIMATION WHATSAPP (Template: estimation, ID: 969016959557925)
export const sendEstimationWhatsApp = async (req: Request, res: Response) => {
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

    if (!project.customer?.phone) {
        res.status(400).json({ success: false, message: 'Customer phone number is not available' })
        return
    }

    try {
        // Use existing PDF URL if available, otherwise generate a fresh one
        let pdfUrl = project.estimationPdfUrl && !project.estimationPdfUrl.startsWith('data:')
            ? project.estimationPdfUrl
            : null

        if (!pdfUrl) {
            // Generate a fresh PDF and upload to Supabase
            const pdfBuffer = await buildEstimationPdfBuffer(project)
            const sanitizedName = (project.projectName || 'project').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
            const fileName = `${sanitizedName}_estimation_${Date.now()}.pdf`
            const filePath = `estimation/${project.id}/${fileName}`

            try {
                const { error: uploadError } = await supabase.storage
                    .from(BUCKET)
                    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
                    if (urlData?.publicUrl) {
                        pdfUrl = urlData.publicUrl
                        await prisma.project.update({
                            where: { id },
                            data: { estimationPdfUrl: pdfUrl, estimationPdfAt: new Date() }
                        })
                    }
                }
            } catch (uploadErr) {
                console.warn('[EstimationWA] Could not upload PDF to Supabase, sending without attachment')
            }
        }

        await sendQuotationAlert({
            clientPhone: project.customer.phone,
            clientName:  project.customer.fullName,
            projectName: project.projectName,
            budget:      project.budget,
            serviceType: project.serviceType,
            pdfUrl:      pdfUrl,
            projectId:   project.id
        })

        res.status(200).json({
            success: true,
            message: 'Estimation WhatsApp sent successfully',
            data: { phone: project.customer.phone, pdfUrl }
        })
    } catch (err: any) {
        console.error('[EstimationWA] Error:', err)
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
    }
}

// SEND ADVANCE PAYMENT REQUEST (Template: advancepaymentrequest, ID: 1790635345737589)
export const sendAdvancePaymentRequestController = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const project = await prisma.project.findUnique({
        where: { id },
        include: { customer: { select: { fullName: true, phone: true } } }
    })

    if (!project || !project.customer?.phone) {
        res.status(404).json({ success: false, message: 'Project or customer phone not found' })
        return
    }

    try {
        const amount = req.body.amount || Math.round(Number(project.budget || 50000) * 0.5)
        const paymentLink = req.body.paymentLink || 'https://rzp.io/l/dunga-advance'

        const result = await sendAdvancePaymentRequest({
            clientPhone: project.customer.phone,
            clientName:  project.customer.fullName,
            amount,
            paymentLink,
            projectName: project.projectName,
            projectId:   project.id
        })

        res.status(200).json({ success: result.success, message: 'Advance payment request WhatsApp sent', result })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
    }
}

// SEND FINAL PAYMENT REQUEST (Template: finalpayment, ID: 1609866433967195)
export const sendFinalPaymentRequestController = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const project = await prisma.project.findUnique({
        where: { id },
        include: { customer: { select: { fullName: true, phone: true } } }
    })

    if (!project || !project.customer?.phone) {
        res.status(404).json({ success: false, message: 'Project or customer phone not found' })
        return
    }

    try {
        const finalDueAmount = req.body.finalDueAmount || req.body.amount || Math.round(Number(project.budget || 50000) * 0.25)
        const paymentLink = req.body.paymentLink || 'https://rzp.io/l/dunga-final'

        const result = await sendFinalPaymentRequest({
            clientPhone: project.customer.phone,
            clientName:  project.customer.fullName,
            finalDueAmount,
            paymentLink,
            projectId:   project.id
        })

        res.status(200).json({ success: result.success, message: 'Final payment request WhatsApp sent', result })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
    }
}

// SEND PAYMENT REMINDER (Template: paymentreminder, ID: 2367183174020523)
export const sendPaymentReminderController = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const project = await prisma.project.findUnique({
        where: { id },
        include: { customer: { select: { fullName: true, phone: true } } }
    })

    if (!project || !project.customer?.phone) {
        res.status(404).json({ success: false, message: 'Project or customer phone not found' })
        return
    }

    try {
        const pendingAmount = req.body.pendingAmount || req.body.amount || Math.round(Number(project.budget || 50000) * 0.5)
        const paymentLink = req.body.paymentLink || 'https://rzp.io/l/dunga-pending'

        const result = await sendPaymentReminder({
            clientPhone: project.customer.phone,
            clientName:  project.customer.fullName,
            pendingAmount,
            paymentLink,
            projectId:   project.id
        })

        res.status(200).json({ success: result.success, message: 'Payment reminder WhatsApp sent', result })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
    }
}

// SEND DAILY PROGRESS UPDATE (Template: dailyupdate, ID: 1435173415154144)
export const sendDailyUpdateController = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const project = await prisma.project.findUnique({
        where: { id },
        include: { customer: { select: { fullName: true, phone: true } } }
    })

    if (!project || !project.customer?.phone) {
        res.status(404).json({ success: false, message: 'Project or customer phone not found' })
        return
    }

    try {
        const activity1 = req.body.activity1 || 'Architecture & API Endpoints Development'
        const activity2 = req.body.activity2 || 'UI/UX Implementation & Responsive Design'
        const activity3 = req.body.activity3 || 'Database Optimization & Testing'
        const currentStatus = req.body.currentStatus || 'In Progress (Active Development)'

        const result = await sendDailyUpdate({
            clientPhone: project.customer.phone,
            clientName:  project.customer.fullName,
            projectName: project.projectName,
            activity1,
            activity2,
            activity3,
            currentStatus,
            projectId:   project.id
        })

        res.status(200).json({ success: result.success, message: 'Daily update WhatsApp sent', result })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
    }
}

// SEND FINAL ESTIMATION WHATSAPP (Template: final_estimation, ID: 1810100450167250)
export const sendFinalEstimationWhatsApp = async (req: Request, res: Response) => {
    const id = req.params.id as string
    const project = await prisma.project.findUnique({
        where: { id },
        include: { customer: { select: { fullName: true, phone: true, applicationNumber: true } } }
    })

    if (!project || !project.customer?.phone) {
        res.status(404).json({ success: false, message: 'Project or customer phone not found' })
        return
    }

    try {
        let pdfUrl = project.estimationPdfUrl && !project.estimationPdfUrl.startsWith('data:')
            ? project.estimationPdfUrl
            : null

        const estNo = project.customer?.applicationNumber || `EST-${Date.now().toString().slice(-6)}`
        const deliveryDate = project.deadline ? new Date(project.deadline).toLocaleDateString('en-IN') : '45 Working Days'

        const result = await sendFinalEstimation({
            clientPhone:  project.customer.phone,
            clientName:   project.customer.fullName,
            projectName:  project.projectName,
            estimationNo: estNo,
            finalAmount:  project.budget || 50000,
            deliveryDate,
            pdfUrl,
            projectId:    project.id
        })

        res.status(200).json({ success: result.success, message: 'Final estimation WhatsApp sent', result })
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to send WhatsApp', error: err?.message })
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
            customer: true,
            transactions: {
                where: { source: { not: 'SUBSCRIPTION' } },
                orderBy: { paymentDate: 'asc' }
            }
        }
    })

    if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' })
        return
    }

    const payments = (project.payments as any[]) || []
    if (payments.length === 0) {
        res.status(400).json({ success: false, message: 'No payments configured for this project' })
        return
    }

    const safeIndex = Math.min(Math.max(0, payIndex), payments.length - 1)
    const selectedPay = payments[safeIndex]
    const itemAmount = parseFloat(selectedPay?.amount) || 0

    // Compute cumulative amount required to have paid for this item
    let cumulativeNeeded = 0
    for (let i = 0; i <= safeIndex; i++) {
        cumulativeNeeded += (parseFloat(payments[i]?.amount) || 0)
    }

    const costHistory = (project.costHistory as any[]) || []
    const totalBudget = calculateTotal(project.budget, costHistory)

    // Real total paid from transactions
    const transactions = (project as any).transactions || []
    const totalPaid = transactions.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0)
    const remainingBalance = Math.max(0, totalBudget - totalPaid)

    // If item has amount > 0 and totalPaid is less than the cumulative required, it's not paid yet!
    if (itemAmount > 0 && totalPaid < cumulativeNeeded) {
        res.status(400).json({
            success: false,
            message: `Receipt is only available after payment is completed. (Received: ₹${totalPaid.toLocaleString('en-IN')} / Needed: ₹${cumulativeNeeded.toLocaleString('en-IN')})`
        })
        return
    }

    const latestTxn = transactions.length > 0 ? transactions[transactions.length - 1] : null
    const receiptNo = latestTxn?.id
        ? 'REC-' + latestTxn.id.split('-')[0].toUpperCase()
        : `REC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${(project.id || '').substring(0,4).toUpperCase()}-${safeIndex + 1}`

    try {
        const pdfBuffer = await buildPaymentReceiptPdfBuffer({
            receiptNo,
            date: latestTxn?.paymentDate || project.updatedAt || project.createdAt,
            customerName: project.customer?.fullName || 'Customer',
            customerPhone: project.customer?.phone || undefined,
            customerEmail: project.customer?.email || undefined,
            applicationNumber: project.customer?.applicationNumber,
            projectName: project.projectName,
            paymentDescription: selectedPay?.description || `Payment Item #${safeIndex + 1}`,
            amountPaid: itemAmount || totalPaid,
            totalBudget,
            totalPaid,
            remainingBalance,
            paymentMethod: latestTxn?.paymentMethod || 'Bank Transfer',
            transactionId: latestTxn?.transactionId || undefined,
            note: latestTxn?.note || undefined,
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