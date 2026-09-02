import { formatDate, calculateDeadline } from '../../formatters'

export const renderProjectTimeline = (project: any): string => {
    if (!project.timelines || project.timelines.length === 0) {
        return `
        <div class="page">
            <div class="header">
                <div class="header-left"><span class="page-num">02</span><h2>PROJECT TIMELINE</h2></div>
                <div class="header-right"><div class="brand">DUNGA</div><div class="sub">TECHNOLOGIES</div></div>
            </div>
            <div class="empty-state">No explicit timeline parameters defined.</div>
        </div>`
    }

    const startDate = project.createdAt ? new Date(project.createdAt) : new Date()
    const calc = calculateDeadline(project.timelines, startDate)

    const rows = project.timelines.map((t: any, idx: number) => {
        const days = parseInt(t.workingDays) || 0
        return `
        <tr>
            <td class="phase-num">${String(idx + 1).padStart(2, '0')}</td>
            <td class="desc-cell">
                ${t.description || '—'}
                <div class="sub">Phase deliverable validation matrix</div>
            </td>
            <td class="duration">${days} Working Days</td>
        </tr>
        `
    }).join('')

    return `
    <div class="page">
        <div class="header">
            <div class="header-left">
                <span class="page-num">02</span>
                <h2>PROJECT TIMELINE</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        <table class="timeline-table">
            <thead>
                <tr>
                    <th>PHASE</th>
                    <th>DESCRIPTION SPECIFICATION</th>
                    <th style="text-align: right;">DURATION</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="delivery-banner">
            <div class="label">TOTAL METRIC CALCULATION</div>
            <div class="days">${calc.totalWorkingDays} SPRINT WORKING DAYS</div>
            <div class="breakdown">
                Requires approximately ${calc.calendarDays} continuous calendar days (accounting for weekend offsets & standard holidays).
            </div>
            ${calc.deadline ? `<div class="date">Expected Production Wrap Date: ${formatDate(calc.deadline)}</div>` : ''}
        </div>
    </div>
    `
}