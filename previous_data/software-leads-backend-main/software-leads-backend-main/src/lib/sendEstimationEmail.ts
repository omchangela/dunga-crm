import { transporter } from './config/mail'

interface SendEstimationEmailParams {
    email: string
    customerName: string
    projectName: string
    pdfBuffer: Buffer
    fileName: string
}

export const sendEstimationEmail = async ({
    email,
    customerName,
    projectName,
    pdfBuffer,
    fileName
}: SendEstimationEmailParams) => {

    const info = await transporter.sendMail({
        from: `"Dunga Technologies" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Project Estimation - ${projectName}`,
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Hello ${customerName},</h2>

                <p>
                    Please find the attached estimation document.
                </p>

                <p>
                    Thank you for choosing Dunga Technologies.
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

    console.log('MAIL SENT')
    console.log(info.messageId)

    return info
}