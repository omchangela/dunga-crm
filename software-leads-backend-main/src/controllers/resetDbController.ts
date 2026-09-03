import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

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

  return {
    success: true,
    message: 'Database reset successfully! All tables cleared and initial Admin account created.',
    admin: {
      email: admin.email,
      name: admin.name,
      password,
    }
  };
}
