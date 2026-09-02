import fs from 'fs'
import path from 'path'
import { formatDate } from '../../formatters'

const getLogoBase64 = (): string => {
    try {
        const logoPath = path.join(__dirname, '..', 'assets', 'dunga-logo.png')
        const buffer   = fs.readFileSync(logoPath)
        return `data:image/png;base64,${buffer.toString('base64')}`
    } catch {
        return ''
    }
}

export const renderCover = (project: any): string => {
    const logo        = getLogoBase64()
    const serviceType = (project.serviceType || '').replace(/_/g, ' ')

    return `
    <div class="page cover">
        <div class="cover-accent-bar">
            <div class="accent-orange"></div>
            <div class="accent-teal"></div>
        </div>

        <div class="cover-body">
            <div class="cover-logo-wrap">
                ${logo
                    ? `<img src="${logo}" alt="Dunga Technologies" class="cover-logo-img" />`
                    : `<div class="cover-logo-text">
                           <h1>DUNGA</h1>
                           <span>TECHNOLOGIES</span>
                       </div>`
                }
            </div>

            <div class="cover-card">
                <div class="cover-card-label">
                    <span class="dash"></span>
                    <span>PROJECT ESTIMATION</span>
                    <span class="dash"></span>
                </div>
                <h2 class="cover-card-title">${project.projectName || 'Project Name'}</h2>
                <div class="meta-pill">${serviceType || 'Software Development'}</div>
            </div>

            <div class="cover-client-wrap">
                <div class="client-divider"></div>
                <div class="client-label">PREPARED FOR</div>
                <div class="client-name">${project.customer?.fullName || '—'}</div>
                ${project.customer?.email ? `<div class="client-email">${project.customer.email}</div>` : ''}
            </div>
        </div>


        <div class="cover-accent-bar">
            <div class="accent-teal"></div>
            <div class="accent-orange"></div>
        </div>
    </div>
    `
}