import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import { renderBaseLayout }      from './pdf/layouts/baseLayout'
import { renderCover }           from './pdf/templates/cover'
import { renderProjectDetails }  from './pdf/templates/client'
import { renderProjectTimeline } from './pdf/templates/timeline'
import { renderCostSummary }     from './pdf/templates/costSummary'
import { renderPaymentSchedule } from './pdf/templates/paymentSchedule'
import { renderDevelopers }      from './pdf/templates/developers'
import { renderTerms }           from './pdf/templates/terms'

export const generateProjectPdf = async (
    project:    any,
    developers: any[] = []
): Promise<Buffer> => {

    // build HTML content
    const content = [
        renderCover(project),
        renderProjectDetails(project),
        renderProjectTimeline(project),
        renderCostSummary(project),
        renderPaymentSchedule(project),
        renderDevelopers(project, developers),
        renderTerms()
    ].filter(Boolean).join('')

    const html = renderBaseLayout(
        `Project - ${project.projectName}`,
        content
    )

    const isProduction = process.env.NODE_ENV === 'production'

    const browser = isProduction
        ? await puppeteer.launch({
            args:           chromium.args,
            executablePath: await chromium.executablePath(),
            headless:       true
        })
        : await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            executablePath: process.env.CHROME_PATH ||
                            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        })

    try {
        const page = await browser.newPage()

        await page.setContent(html, {
            waitUntil: 'load'
        })

        const footerTemplate = `
            <div style="
                width: 100%;
                padding: 0 50px;
                font-size: 9px;
                font-family: Helvetica, Arial, sans-serif;
                color: #6B7280;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top: 1px solid #E5E7EB;
                padding-top: 8px;
            ">
                <div style="display: flex; gap: 20px;">
                    <span>+91 8013902831</span>
                    <span>sales@dungatechnologies.com</span>
                    <span>www.dungatechnologies.com</span>
                </div>
                <div style="
                    background: #3B7A82;
                    color: white;
                    padding: 4px 10px;
                    font-weight: bold;
                    font-size: 10px;
                ">
                    <span class="pageNumber"></span>
                </div>
            </div>
        `

        const headerTemplate = `<div></div>`

        const pdfBuffer = await page.pdf({
            format:              'A4',
            printBackground:     true,
            displayHeaderFooter: true,
            headerTemplate,
            footerTemplate,
            margin: {
                top:    '20px',
                right:  '0',
                bottom: '80px',
                left:   '0'
            }
        })

        return Buffer.from(pdfBuffer)

    } finally {
        await browser.close()
    }
}