import 'dotenv/config'
import prisma from '../lib/prisma'
import {
    sendSubscriptionRenewalReminder,
    sendProjectDeadlineReminder
} from '../lib/whatsapp'

/**
 * DAILY AUTOMATED REMINDER PROCESSOR
 * 1. 15-Day Subscription Expiry Reminder
 * 2. 7-Day Subscription Expiry Reminder
 * 3. Approaching Project Deadline Alerts (7 days & 3 days)
 */
export async function runDailyReminders(options: { dryRun?: boolean } = {}) {
    console.log(`\n======================================================`)
    console.log(`⏰ [Daily Reminders] Starting reminder scan... (DryRun: ${options.dryRun ?? false})`)
    console.log(`   Time: ${new Date().toISOString()}`)
    console.log(`======================================================\n`)

    const now = new Date()
    const stats = {
        subscriptions15d: 0,
        subscriptions7d: 0,
        projectDeadlines: 0,
        errors: 0
    }

    // ─── 1. SUBSCRIPTIONS: 15-DAY & 7-DAY REMINDERS ────────────────

    const activeSubscriptions = await prisma.subscription.findMany({
        where: {
            status: { in: ['Active', 'ACTIVE'] }
        },
        include: {
            project: {
                include: {
                    customer: true
                }
            }
        }
    })

    console.log(`Found ${activeSubscriptions.length} active subscriptions to evaluate.`)

    for (const sub of activeSubscriptions) {
        if (!sub.renewalDate) continue

        const renewalDate = new Date(sub.renewalDate)
        const diffMs = renewalDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        // Resolve client contact details
        const customer = sub.project?.customer
        const phone = customer?.phone
        const clientName = customer?.fullName || 'Valued Client'

        if (!phone) {
            console.log(`[Subscription: ${sub.name}] No client phone number linked, skipping.`)
            continue
        }

        // --- 15-DAY REMINDER TRIGGER ---
        // Eligible if between 14 and 16 days remaining and 15d reminder not sent recently
        if (diffDays >= 14 && diffDays <= 16) {
            const alreadySent = sub.last15dReminderSentAt && (now.getTime() - new Date(sub.last15dReminderSentAt).getTime()) < (10 * 24 * 60 * 60 * 1000)

            if (!alreadySent) {
                console.log(`👉 Sending 15-Day Renewal Reminder for '${sub.name}' to ${phone} (${clientName})`)
                if (!options.dryRun) {
                    try {
                        await sendSubscriptionRenewalReminder({
                            clientPhone: phone,
                            clientName,
                            subscriptionName: sub.name,
                            amount: sub.amount,
                            renewalDate: sub.renewalDate,
                            daysRemaining: diffDays,
                            category: sub.category,
                            subscriptionId: sub.id
                        })

                        await prisma.subscription.update({
                            where: { id: sub.id },
                            data: { last15dReminderSentAt: now }
                        })
                        stats.subscriptions15d++
                    } catch (e) {
                        console.error(`Error sending 15d reminder for sub ${sub.id}:`, e)
                        stats.errors++
                    }
                } else {
                    stats.subscriptions15d++
                }
            } else {
                console.log(`[Subscription: ${sub.name}] 15-Day reminder already sent on ${sub.last15dReminderSentAt}`)
            }
        }

        // --- 7-DAY REMINDER TRIGGER ---
        // Eligible if between 6 and 8 days remaining and 7d reminder not sent recently
        if (diffDays >= 6 && diffDays <= 8) {
            const alreadySent = sub.last7dReminderSentAt && (now.getTime() - new Date(sub.last7dReminderSentAt).getTime()) < (10 * 24 * 60 * 60 * 1000)

            if (!alreadySent) {
                console.log(`🚨 Sending 7-Day Renewal Reminder for '${sub.name}' to ${phone} (${clientName})`)
                if (!options.dryRun) {
                    try {
                        await sendSubscriptionRenewalReminder({
                            clientPhone: phone,
                            clientName,
                            subscriptionName: sub.name,
                            amount: sub.amount,
                            renewalDate: sub.renewalDate,
                            daysRemaining: diffDays,
                            category: sub.category,
                            subscriptionId: sub.id
                        })

                        await prisma.subscription.update({
                            where: { id: sub.id },
                            data: { last7dReminderSentAt: now }
                        })
                        stats.subscriptions7d++
                    } catch (e) {
                        console.error(`Error sending 7d reminder for sub ${sub.id}:`, e)
                        stats.errors++
                    }
                } else {
                    stats.subscriptions7d++
                }
            } else {
                console.log(`[Subscription: ${sub.name}] 7-Day reminder already sent on ${sub.last7dReminderSentAt}`)
            }
        }
    }

    // ─── 2. PROJECTS: DEADLINE REMINDERS ────────────────────────────

    const activeProjects = await prisma.project.findMany({
        where: {
            status: { in: ['ACTIVE', 'CONVERTED', 'PENDING'] },
            deadline: { not: null }
        },
        include: {
            customer: true
        }
    })

    console.log(`Found ${activeProjects.length} active projects with deadlines to evaluate.`)

    for (const project of activeProjects) {
        if (!project.deadline) continue

        const deadlineDate = new Date(project.deadline)
        const diffMs = deadlineDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        const phone = project.customer?.phone
        const clientName = project.customer?.fullName || 'Valued Client'

        if (!phone) continue

        // Alert if deadline is in 7 days or 3 days and not sent in the last 3 days
        if ((diffDays === 7 || diffDays === 3) && diffDays > 0) {
            const alreadySent = project.lastDeadlineReminderSentAt && (now.getTime() - new Date(project.lastDeadlineReminderSentAt).getTime()) < (2 * 24 * 60 * 60 * 1000)

            if (!alreadySent) {
                console.log(`⏳ Sending Deadline Alert (${diffDays}d) for '${project.projectName}' to ${phone}`)
                if (!options.dryRun) {
                    try {
                        await sendProjectDeadlineReminder({
                            clientPhone: phone,
                            clientName,
                            projectName: project.projectName,
                            deadlineDate,
                            daysRemaining: diffDays,
                            projectId: project.id
                        })

                        await prisma.project.update({
                            where: { id: project.id },
                            data: { lastDeadlineReminderSentAt: now }
                        })
                        stats.projectDeadlines++
                    } catch (e) {
                        console.error(`Error sending deadline alert for project ${project.id}:`, e)
                        stats.errors++
                    }
                } else {
                    stats.projectDeadlines++
                }
            }
        }
    }

    console.log(`\n======================================================`)
    console.log(`✅ [Daily Reminders Completed]`)
    console.log(`   - 15-Day Subscription Alerts Dispatched : ${stats.subscriptions15d}`)
    console.log(`   - 7-Day Subscription Alerts Dispatched  : ${stats.subscriptions7d}`)
    console.log(`   - Project Deadline Alerts Dispatched    : ${stats.projectDeadlines}`)
    console.log(`   - Errors Encountered                    : ${stats.errors}`)
    console.log(`======================================================\n`)

    return stats
}

// Allow direct CLI execution
if (require.main === module) {
    const isDryRun = process.argv.includes('--dry-run')
    runDailyReminders({ dryRun: isDryRun })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Fatal error in daily reminders:', err)
            process.exit(1)
        })
}
