import { transporter } from './config/mail'

interface SendProjectPdfEmailParams {
    email: string
    customerName: string
    projectName: string
    pdfBuffer: Buffer
    fileName: string
    contractNumber?: string
    amount?: number | string
    deadline?: string
}

export const sendProjectPdfEmail = async ({
    email,
    customerName,
    projectName,
    pdfBuffer,
    fileName,
    contractNumber,
    amount,
    deadline
}: SendProjectPdfEmailParams) => {
    const formattedAmount = typeof amount === 'number'
        ? amount.toLocaleString('en-IN')
        : (amount ? String(amount) : 'As per agreement')

    const docNo = contractNumber || `DT/PRJ/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`

    const info = await transporter.sendMail({
        from: `"Dunga Technologies" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Project Agreement & Specifications - ${projectName}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;">
                <h2 style="color: #007a87; margin-bottom: 14px;">Hello ${customerName} 👋</h2>

                <p style="margin: 6px 0;">Greetings from <strong>Dunga Technologies</strong>.</p>

                <p style="margin: 6px 0;">We are pleased to share the project contract and specifications document for <strong>${projectName}</strong>.</p>

                <div style="background: #f8fafc; border-left: 4px solid #007a87; padding: 12px 18px; margin: 16px 0; border-radius: 6px;">
                    <p style="margin: 4px 0;">📄 <strong>Project Code:</strong> ${docNo}</p>
                    <p style="margin: 4px 0;">💰 <strong>Total Investment:</strong> ₹${formattedAmount}</p>
                    ${deadline ? `<p style="margin: 4px 0;">📅 <strong>Target Delivery:</strong> ${deadline}</p>` : ''}
                </div>

                <p style="margin: 8px 0;">
                    Please find the <strong>project document attached</strong> for your review. It contains detailed project scope, timeline, milestones, cost summary, and terms of service.
                </p>

                <p style="margin: 8px 0;">
                    If you have any questions or require any adjustments, our engineering team is available to assist you.
                </p>

                <p style="margin: 8px 0;">We look forward to building a successful platform together.</p>

                <br/>

                <p style="margin-bottom: 2px;">Best Regards,</p>
                <p style="margin: 0; font-weight: bold; color: #007a87; font-size: 15px;">Dunga Technologies</p>
                <p style="margin: 0; color: #64748b; font-size: 13px;">Technology Solutions & Developer Services</p>
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

    console.log('PROJECT PDF MAIL SENT:', info.messageId)
    return info
}