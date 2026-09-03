import prisma from '../lib/prisma';
import { EXTRACTED_LEADS } from './extracted_leads_data';

async function main() {
  console.log(`Starting import of ${EXTRACTED_LEADS.length} leads into database...`);

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
