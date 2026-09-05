export const renderProjectDetails = (project: any): string => {
    const serviceType = (project.serviceType || '').replace(/_/g, ' ')
    const status      = project.status || 'PENDING'
    const customer    = project.customer || {}

    const renderModuleList = (title: string, items: string[]): string => {
        if (!items || items.length === 0) return ''
        const cleanItems = items.filter(i => i && i.trim())
        if (cleanItems.length === 0) return ''

        return `
        <div class="subgroup">
            <div class="subgroup-title">${title}</div>
            <ul>
                ${cleanItems.map(item => `<li>${item}</li>`).join('')}
            </ul>
        </div>
        `
    }

    const hasOverview = project.webOverview?.length || project.appOverview?.length || project.adminOverview?.length

    return `
    <div class="page">
        <div class="header">
            <div class="header-left">
                <span class="page-num">01</span>
                <h2>PROJECT DETAILS</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        <div class="project-banner">
            <div class="label">PROJECT NAME</div>
            <h3>${project.projectName || '—'}</h3>
        </div>

        <div class="info-grid">
            <div class="info-cell"><div class="label">Service Type</div><div class="value">${serviceType || '—'}</div></div>
            <div class="info-cell"><div class="label">Status</div><div class="value">${status}</div></div>
            <div class="info-cell"><div class="label">Client Name</div><div class="value">${customer.fullName || '—'}</div></div>
            <div class="info-cell"><div class="label">Phone</div><div class="value">${customer.phone || '—'}</div></div>
            <div class="info-cell"><div class="label">Email</div><div class="value">${customer.email || '—'}</div></div>
            <div class="info-cell"><div class="label">Application Reference</div><div class="value">${customer.applicationNumber || '—'}</div></div>
        </div>

        ${project.description ? `
        <div class="description-block">
            <div class="label">PROJECT DESCRIPTION</div>
            <div class="content">${project.description}</div>
        </div>
        ` : ''}

        ${hasOverview ? `
        <div class="modules-block">
            <div class="label">PROJECT MODULES</div>
            <div class="modules-container">
                ${renderModuleList('Web Platform Features', project.webOverview)}
                ${renderModuleList('Mobile Application Layer', project.appOverview)}
                ${renderModuleList('Admin Infrastructure Subsystem', project.adminOverview)}
            </div>
        </div>
        ` : ''}
    </div>
    `
}