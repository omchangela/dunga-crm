const formatINR = (n: number): string => {
    return '₹' + Number(n || 0).toLocaleString('en-IN')
}

export const renderCostSummary = (project: any): string => {

    const payments    = project.payments || []
    const costHistory = project.costHistory || []
    const base        = Number(project.budget) || 0
    const featTotal   = costHistory.reduce(
        (s: number, c: any) => s + Number(c.amount || 0), 0
    )
    const total = base + featTotal

    // payments breakdown
    const paymentRows = payments.length > 0
        ? payments.map((p: any) => `
            <div class="cost-row">
                <span class="cost-label">${p.description || 'Payment'}</span>
                <span class="cost-amount">${formatINR(Number(p.amount))}</span>
            </div>
        `).join('')
        : ''

    // feature additions
    const featureRows = costHistory.length > 0
        ? costHistory.map((c: any) => `
            <div class="cost-row feature-row">
                <span class="cost-label">${c.label || '—'}</span>
                <span class="cost-amount feature-amount">+${formatINR(Number(c.amount))}</span>
            </div>
        `).join('')
        : ''

    return `
    <div class="page">

        <div class="header">
            <div class="header-left">
                <span class="page-num">03</span>
                <h2>COST SUMMARY</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        ${payments.length > 0 ? `
        <div class="cost-section">
            <div class="cost-section-title">PAYMENT BREAKDOWN</div>
            <div class="cost-list">
                ${paymentRows}
            </div>
        </div>
        ` : ''}

        <div class="cost-base">
            <div class="cost-base-row">
                <span class="cost-base-label">Base Project Cost</span>
                <span class="cost-base-value">${formatINR(base)}</span>
            </div>
        </div>

        ${costHistory.length > 0 ? `
        <div class="cost-section">
            <div class="cost-section-title">FEATURE ADDITIONS</div>
            <div class="cost-list">
                ${featureRows}
            </div>
        </div>
        ` : ''}

        <div class="cost-total">
            <div class="cost-total-row">
                <span class="cost-total-label">TOTAL PROJECT COST</span>
                <span class="cost-total-value">${formatINR(total)}</span>
            </div>
            <div class="cost-total-sub">
                Inclusive of all features and additions mentioned above
            </div>
        </div>

    </div>
    `
}