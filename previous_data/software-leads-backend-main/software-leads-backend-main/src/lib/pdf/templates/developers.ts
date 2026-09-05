export const renderDevelopers = (project: any, developers: any[]): string => {

    if (!developers || developers.length === 0) {
        return ''
    }

    const cards = developers.map(dev => `
        <div class="dev-card">
            <div class="dev-avatar">${getInitials(dev.name)}</div>
            <div class="dev-info">
                <div class="dev-name">${dev.name}</div>
                <div class="dev-role">${dev.role || '—'}</div>
                <div class="dev-meta">
                    <span class="dev-meta-item">${dev.experience || '—'}</span>
                </div>
                ${dev.skills && dev.skills.length > 0 ? `
                <div class="dev-skills">
                    ${dev.skills.slice(0, 4).map((s: string) =>
                        `<span class="dev-skill">${s}</span>`
                    ).join('')}
                </div>
                ` : ''}
            </div>
        </div>
    `).join('')

    return `
    <div class="page">

        <div class="header">
            <div class="header-left">
                <span class="page-num">05</span>
                <h2>PROJECT TEAM</h2>
            </div>
            <div class="header-right">
                <div class="brand">DUNGA</div>
                <div class="sub">TECHNOLOGIES</div>
            </div>
        </div>

        <div class="team-intro">
            <div class="team-count">${developers.length}</div>
            <div class="team-label">
                Developer${developers.length > 1 ? 's' : ''} assigned to this project
            </div>
        </div>

        <div class="dev-grid">
            ${cards}
        </div>

    </div>
    `
}

const getInitials = (name: string): string => {
    if (!name) return '?'
    return name
        .split(' ')
        .slice(0, 2)
        .map(w => w[0])
        .join('')
        .toUpperCase()
}