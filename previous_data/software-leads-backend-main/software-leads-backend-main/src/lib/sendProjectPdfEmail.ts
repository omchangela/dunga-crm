import { transporter } from './config/mail'

interface SendProjectPdfEmailParams {
    email: string
    customerName: string
    projectName: string
    pdfBuffer: Buffer
    fileName: string
}

export const sendProjectPdfEmail = async ({
    email,
    customerName,
    projectName,
    pdfBuffer,
    fileName
}: SendProjectPdfEmailParams) => {

    const info = await transporter.sendMail({
        from: `"Dunga Technologies" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Project Document - ${projectName}`,
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Hello ${customerName},</h2>

                <p>
                    Please find the attached project document.
                </p>

                <p>
                    This document contains project scope, timeline,
                    cost summary, payment schedule and assigned team.
                </p>

                <br/>

                <p>
                    Regards,<br/>
                    Dunga Technologies
                </p>
            </div>
        `,
        attachments: [
            {
                filename: fileName,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    })

    console.log('PROJECT PDF MAIL SENT')
    console.log(info.messageId)

    return info
}