import prisma from '../lib/prisma';
import { EXTRACTED_LEADS } from '../scripts/extracted_leads_data';

export async function executeSeedLeads() {
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

  return {
    success: true,
    message: `Successfully imported ${result.count} leads into the database!`,
    importedCount: result.count,
    totalInFile: EXTRACTED_LEADS.length,
  };
}
