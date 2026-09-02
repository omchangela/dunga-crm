import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

import { renderBaseLayout } from './pdf/layouts/baseLayout'
import { renderCover } from './pdf/templates/cover'
import { renderProjectDetails } from './pdf/templates/client'
import { renderProjectTimeline } from './pdf/templates/timeline'
import { renderTerms } from './pdf/templates/terms'

export const generateEstimationPdf = async (
    project: any
): Promise<Buffer> => {

    const content = [
        renderCover(project),
        renderProjectDetails(project),
        renderProjectTimeline(project),
        renderTerms()
    ].join('')

    const html = renderBaseLayout(
        `Estimation - ${project.projectName}`,
        content
    )

    let browser: any

    try {

        const executablePath = await chromium.executablePath()

        console.log('==============================')
        console.log('PDF Generation Started')
        console.log('NODE_ENV:', process.env.NODE_ENV)
        console.log('RENDER:', process.env.RENDER)
        console.log('Chromium Path:', executablePath)
        console.log('==============================')

        browser = await puppeteer.launch({
            executablePath,
            args: chromium.args,
            headless: true
        })

        const page = await browser.newPage()

        await page.setContent(html, {
            waitUntil: 'load'
        })

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<div></div>`,
            footerTemplate: `
                <div style="
                    width:100%;
                    padding:0 50px;
                    font-size:9px;
                    font-family:Helvetica, Arial, sans-serif;
                    color:#6B7280;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    border-top:1px solid #E5E7EB;
                    padding-top:8px;
                ">
                    <div style="display:flex;gap:20px;">
                        <span>+91 8013902831</span>
                        <span>sales@dungatechnologies.com</span>
                        <span>www.dungatechnologies.com</span>
                    </div>

                    <div style="
                        background:#3B7A82;
                        color:white;
                        padding:4px 10px;
                        font-weight:bold;
                        font-size:10px;
                    ">
                        <span class="pageNumber"></span>
                    </div>
                </div>
            `,
            margin: {
                top: '20px',
                right: '0',
                bottom: '80px',
                left: '0'
            }
        })

        console.log('PDF Generated Successfully')

        return Buffer.from(pdfBuffer)

    } catch (error) {

        console.error('==============================')
        console.error('PDF GENERATION FAILED')
        console.error(error)
        console.error('==============================')

        throw error

    } finally {

        if (browser) {
            await browser.close()
        }
    }
}