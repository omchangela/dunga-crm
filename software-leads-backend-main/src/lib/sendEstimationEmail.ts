import { transporter } from './config/mail'

interface SendEstimationEmailParams {
    email: string
    customerName: string
    projectName: string
    pdfBuffer: Buffer
    fileName: string
    amount?: number | string
    estimationNo?: string
    validUntil?: string
}

export const sendEstimationEmail = async ({
    email,
    customerName,
    projectName,
    pdfBuffer,
    fileName,
    amount,
    estimationNo,
    validUntil
}: SendEstimationEmailParams) => {
    const formattedAmount = typeof amount === 'number'
        ? amount.toLocaleString('en-IN')
        : (amount ? String(amount) : 'As per proposal')

    const estNo = estimationNo || `DT/EST/${new Date().getFullYear()}/${Date.now().toString().slice(-5)}`

    let validUntilStr = validUntil
    if (!validUntilStr) {
        const vDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        const day = String(vDate.getDate()).padStart(2, '0')
        const month = String(vDate.getMonth() + 1).padStart(2, '0')
        const year = vDate.getFullYear()
        validUntilStr = `${day}/${month}/${year}`
    }

    const info = await transporter.sendMail({
        from: `"Dunga Technologies" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Project Estimation - ${projectName}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.6; max-width: 600px;">
                <h2 style="color: #007a87; margin-bottom: 14px;">Hello ${customerName} 👋</h2>

                <p style="margin: 6px 0;">Greetings from <strong>Dunga Technologies</strong>.</p>

                <p style="margin: 6px 0;">We are pleased to share the project estimation for <strong>${projectName}</strong>.</p>

                <div style="background: #f8fafc; border-left: 4px solid #007a87; padding: 12px 18px; margin: 16px 0; border-radius: 6px;">
                    <p style="margin: 4px 0;">📄 <strong>Estimation No:</strong> ${estNo}</p>
                    <p style="margin: 4px 0;">💰 <strong>Estimated Investment:</strong> ₹${formattedAmount}</p>
                    <p style="margin: 4px 0;">📅 <strong>Valid Until:</strong> ${validUntilStr}</p>
                </div>

                <p style="margin: 8px 0;">
                    Please find the <strong>project estimation attached</strong> for your review. It includes the proposed project scope, deliverables, pricing, and applicable terms.
                </p>

                <p style="margin: 8px 0;">
                    If you have any questions or would like to discuss the <strong>project requirements, pricing, deliverables, or development timeline</strong>, our team will be happy to assist you.
                </p>

                <p style="margin: 8px 0;">We look forward to partnering with you.</p>

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

    console.log('ESTIMATION EMAIL SENT:', info.messageId)
    return info
}