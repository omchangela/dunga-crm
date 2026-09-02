# dunga-crm

Full-stack CRM platform with Lead Management, Customer & Project Management, Employee Portal, Developer Portal, Finance & Subscriptions, and PDF generation workers.

## Project Structure

- `software-leads-backend-main/`: Express.js, TypeScript, Prisma ORM, PostgreSQL, Redis, BullMQ workers.
- `software-leads-main/`: Next.js 16, React 19, Tailwind CSS.

## Getting Started

### 1. Backend Setup
```bash
cd software-leads-backend-main
cp .env.example .env
npm install
npx prisma db push
npx ts-node src/scripts/seedAdmin.ts
npm run dev
```

### 2. Frontend Setup
```bash
cd software-leads-main
cp .env.example .env.local
npm install
npm run dev
```
