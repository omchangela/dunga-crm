import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  const jsonPath = path.join(__dirname, 'extracted_leads.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('extracted_leads.json not found.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const leadsData: { phone: string; note: string }[] = JSON.parse(rawData);

  console.log(`Starting import of ${leadsData.length} leads into database...`);

  // Transform data for Prisma
  const batchData = leadsData.map((item, index) => {
    // Generate clean client name from note if available, else Lead #[number]
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

  // Batch insert into database using createMany with skipDuplicates
  const result = await prisma.lead.createMany({
    data: batchData,
    skipDuplicates: true,
  });

  console.log(`✓ Successfully imported ${result.count} new leads into the database!`);
}

main()
  .catch((e) => {
    console.error('Failed to import leads:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
