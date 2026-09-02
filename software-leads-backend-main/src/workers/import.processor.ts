import { Job }                           from 'bullmq'
import { parse }                         from 'csv-parse/sync'
import { z }                             from 'zod'
import prisma                            from '../lib/prisma'
import { SERVICE_TYPES, LEAD_SOURCES }   from '../lib/enums'
import { ImportJobData, ImportJobResult } from '../lib/queues/importQueue'

const rowSchema = z.object({
    fullName:    z.string().min(2,  'Full name required'),
    phone:       z.string().length(10, 'Phone must be 10 digits'),
    email:       z.string().email().optional().or(z.literal('')),
    state:       z.string().optional(),
    city:        z.string().optional(),
    serviceType: z.enum(SERVICE_TYPES),
    source:      z.enum(LEAD_SOURCES)
})

const norm = (v: unknown) => (typeof v === 'string' ? v.trim() : v)

const normalizeRow = (raw: Record<string, unknown>) => ({
    fullName:    norm(raw.fullName),
    phone:       norm(raw.phone),
    email:       norm(raw.email),
    state:       norm(raw.state),
    city:        norm(raw.city),
    serviceType: norm(raw.serviceType),
    source:      norm(raw.source)
})

export const processImportJob = async (
    job: Job<ImportJobData, ImportJobResult>
): Promise<ImportJobResult> => {

    const { csvContent, fileName } = job.data

    await job.updateProgress(5)
    await job.log(`Processing: ${fileName}`)

    const records: Record<string, unknown>[] = parse(csvContent, {
        columns:          true,
        skip_empty_lines: true,
        trim:             true
    })

    await job.updateProgress(20)
    await job.log(`Parsed ${records.length} rows`)

    const result: ImportJobResult = {
        success:  true,
        total:    records.length,
        imported: 0,
        skipped:  0,
        failed:   0,
        errors:   []
    }

    const valid: z.infer<typeof rowSchema>[] = []
    const seenPhones = new Set<string>()

    records.forEach((raw, i) => {
        const rowNum = i + 2
        const parsed = rowSchema.safeParse(normalizeRow(raw))

        if (!parsed.success) {
            result.failed++
            const issue = parsed.error.issues[0]
            result.errors.push({
                row:     rowNum,
                message: `${issue.path.join('.') || 'row'}: ${issue.message}`
            })
            return
        }

        if (seenPhones.has(parsed.data.phone)) {
            result.skipped++
            result.errors.push({
                row:     rowNum,
                message: `phone: duplicate within file (${parsed.data.phone})`
            })
            return
        }

        seenPhones.add(parsed.data.phone)
        valid.push(parsed.data)
    })

    await job.updateProgress(40)
    await job.log(`Valid: ${valid.length}, Failed: ${result.failed}, Skipped: ${result.skipped}`)

    if (valid.length === 0) return result

    await job.updateProgress(55)
    await job.log('Checking existing phones...')

    const existing = await prisma.lead.findMany({
        where:  { phone: { in: Array.from(seenPhones) } },
        select: { phone: true }
    })

    const existingPhones = new Set(existing.map(l => l.phone))

    const toInsert = valid
        .filter(row => {
            if (existingPhones.has(row.phone)) {
                result.skipped++
                return false
            }
            return true
        })
        .map(row => ({
            fullName:    row.fullName,
            phone:       row.phone,
            email:       row.email || null,
            state:       row.state || null,
            city:        row.city  || null,
            serviceType: row.serviceType,
            source:      row.source,
            status:      'PENDING' as const,
            followUp:    false
        }))

    await job.updateProgress(70)
    await job.log(`Inserting ${toInsert.length} leads...`)

    if (toInsert.length > 0) {
        const created = await prisma.lead.createMany({
            data:           toInsert,
            skipDuplicates: true
        })
        result.imported  = created.count
        result.skipped  += toInsert.length - created.count
    }

    await job.updateProgress(100)
    await job.log(`Done: ${result.imported} imported`)

    return result
}