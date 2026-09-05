const formatINR = (n: number): string => {
    return '₹' + Number(n || 0).toLocaleString('en-IN')
}

export const renderPaymentSchedule = (project: any): string => {

    const schedules = project.schedules || []

    if (schedules.length === 0) {
        return ''
    }

    const total = schedules.reduce(
        (s: number, sch: any) => s + Number(sch.payment || 0), 0
    )

    const rows = schedules.map((s: any, idx: number) => `
        <tr>
            <td class="sch-num">${idx + 1}</td>
            <td class="sch-desc">${s.description || '—'}</td>
            <td class="sch-amount">${formatINR(Number(s.payment))}</td>
        </tr>
    `).join('')

    return `
    <div class="page">

        <div class="header">
            <div class="header-left">
                <span class="page-num">04</span>
                <h2>PAYMENT SCHEDULE</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        <div class="schedule-intro">
            Payment milestones for project delivery
        </div>

        <table class="schedule-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>MILESTONE</th>
                    <th>AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" class="sch-total-label">TOTAL</td>
                    <td class="sch-total-amount">${formatINR(total)}</td>
                </tr>
            </tfoot>
        </table>

        <div class="schedule-note">
            <strong>Note:</strong> Payments are due as per the milestones above.
            The project commencement and continuity depend on timely payments.
        </div>

    </div>
    `
}