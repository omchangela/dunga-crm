import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
    console.log('Seeding demo accounts...')

    const passwordHash = await bcrypt.hash('ChangeMe123!', 12)

    // 1. Employee / Telecaller
    const employee = await prisma.employee.upsert({
        where: { email: 'caller@example.com' },
        update: {
            password: passwordHash,
            isActive: true,
            role: 'Sales Executive'
        },
        create: {
            name: 'Rahul Sharma (Telecaller)',
            email: 'caller@example.com',
            password: passwordHash,
            phone: '9876543210',
            role: 'Sales Executive',
            isActive: true
        }
    })
    console.log('✓ Telecaller/Employee created:', employee.email)

    // Set employee target
    const now = new Date()
    await prisma.employeeTarget.upsert({
        where: {
            employeeId_month_year: {
                employeeId: employee.id,
                month: now.getMonth() + 1,
                year: now.getFullYear()
            }
        },
        update: { target: 100000 },
        create: {
            employeeId: employee.id,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            target: 100000
        }
    })
    console.log('✓ Telecaller target set')

    // 2. Developer
    const developer = await prisma.developer.upsert({
        where: { email: 'dev@example.com' },
        update: {
            password: passwordHash,
            status: 'Active',
            role: 'Full Stack Developer'
        },
        create: {
            name: 'Dev Patel (Developer)',
            email: 'dev@example.com',
            phone: '9876543211',
            role: 'Full Stack Developer',
            experience: '3 Years',
            skills: ['React', 'Node.js', 'PostgreSQL', 'Next.js'],
            status: 'Active',
            password: passwordHash
        }
    })
    console.log('✓ Developer created:', developer.email)

    console.log('\n--- ALL 3 ACCOUNTS READY ---')
    console.log('1. Admin:      admin@example.com   / ChangeMe123!')
    console.log('2. Telecaller: caller@example.com  / ChangeMe123!')
    console.log('3. Developer:  dev@example.com     / ChangeMe123!')
}

main()
    .catch((e) => {
        console.error('Error seeding:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
