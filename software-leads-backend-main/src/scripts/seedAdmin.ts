import 'dotenv/config'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

const seedAdmin = async () => {

    const name     = process.env.ADMIN_NAME     || 'Admin'
    const email    = process.env.ADMIN_EMAIL    || 'admin@example.com'
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!'

    const existing = await prisma.user.findUnique({ where: { email } })

    if (existing) {
        console.log(`Admin already exists: ${email}`)
        process.exit(0)
    }

    const hash = await bcrypt.hash(password, 12)

    const admin = await prisma.user.create({
        data: {
            name,
            email,
            password: hash,
            role:     'ADMIN'
        }
    })

    console.log('─────────────────────────────────────')
    console.log('✓ Admin created successfully')
    console.log('─────────────────────────────────────')
    console.log(`Name:     ${admin.name}`)
    console.log(`Email:    ${admin.email}`)
    console.log(`Role:     ${admin.role}`)
    console.log(`Password: ${password}`)
    console.log('─────────────────────────────────────')
    console.log('⚠  Change password after first login')
    console.log('─────────────────────────────────────')

    process.exit(0)
}

seedAdmin().catch(err => {
    console.error('Failed to seed admin:', err)
    process.exit(1)
})