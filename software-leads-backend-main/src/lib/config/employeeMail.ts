import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
})

export const sendWelcomeEmail = async (opts: {
    email:    string
    name:     string
    password: string
    role:     string
}) => {
    const { email, name, password, role } = opts

    await transporter.sendMail({
        from:    `"Dunga Technologies" <${process.env.SMTP_USER}>`,
        to:      email,
        subject: `Welcome to Dunga Technologies — Your Account Details`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

                <div style="background: #D2692B; padding: 20px 30px;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">DUNGA</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0;
                               font-size: 12px; letter-spacing: 3px;">TECHNOLOGIES</p>
                </div>

                <div style="padding: 30px; background: #ffffff;
                            border: 1px solid #e5e7eb;">
                    <h2 style="color: #1F2937;">Welcome, ${name}!</h2>

                    <p style="color: #374151;">Your account has been created.
                    Here are your login credentials:</p>

                    <div style="background: #f9fafb; border-left: 4px solid #3B7A82;
                                padding: 20px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0 0 8px;">
                            <strong>Role:</strong> ${role}
                        </p>
                        <p style="margin: 0 0 8px;">
                            <strong>Email:</strong> ${email}
                        </p>
                        <p style="margin: 0;">
                            <strong>Password:</strong>
                            <span style="font-family: monospace; background: #e5e7eb;
                                         padding: 2px 8px; border-radius: 4px;">
                                ${password}
                            </span>
                        </p>
                    </div>

                    <p style="color: #6B7280; font-size: 13px;">
                        Please change your password after first login.
                    </p>

                    <p style="color: #374151; margin-top: 24px;">
                        Best regards,<br>
                        <strong>Admin Team — Dunga Technologies</strong>
                    </p>
                </div>

            </div>
        `
    })
}