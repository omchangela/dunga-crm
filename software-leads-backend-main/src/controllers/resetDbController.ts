import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { EXTRACTED_LEADS } from '../scripts/extracted_leads_data';

export async function executeResetDb() {
  // Truncate all tables in PostgreSQL with CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "Reminder", 
      "FinanceTransaction", 
      "Task", 
      "Subscription", 
      "Project", 
      "Customer", 
      "LeadFollowUp", 
      "Lead", 
      "EmployeeTarget", 
      "EmployeeRefreshToken", 
      "Employee", 
      "DeveloperRefreshToken", 
      "Developer", 
      "RefreshToken", 
      "User"
    RESTART IDENTITY CASCADE;
  `);

  // Seed default admin
  const name     = process.env.ADMIN_NAME     || 'Admin';
  const email    = process.env.ADMIN_EMAIL    || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const hash     = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      password: hash,
      role: 'ADMIN'
    }
  });

  // Seed extracted leads
  let importedLeadsCount = 0;
  try {
    const batchData = EXTRACTED_LEADS.map((item) => {
      let name = item.note ? item.note.replace(/[^\w\s]/gi, '').trim() : '';
      if (!name || name.length > 50) {
        name = `Lead ${item.phone}`;
      } else {
        name = `Lead ${item.phone} (${name.slice(0, 30)})`;
      }

      return {
        fullName: name,
        phone: item.phone,
        serviceType: 'WEB_DEVELOPMENT' as const,
        source: 'ADVERTISEMENT' as const,
        status: 'PENDING' as const,
      };
    });

    const res = await prisma.lead.createMany({
      data: batchData,
      skipDuplicates: true,
    });
    importedLeadsCount = res.count;
  } catch (e) {
    console.error('Error seeding leads in resetDb:', e);
  }

  return {
    success: true,
    message: `Database reset successfully! Cleared tables, created Admin user, and seeded ${importedLeadsCount} leads from document.`,
    importedLeadsCount,
    admin: {
      email: admin.email,
      name: admin.name,
      password,
    }
  };
}
