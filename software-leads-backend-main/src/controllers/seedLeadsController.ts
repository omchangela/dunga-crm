import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';

export async function executeSeedLeads() {
  const jsonPath = path.join(__dirname, '../scripts/extracted_leads.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('extracted_leads.json data file not found.');
  }

  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const leadsData: { phone: string; note: string }[] = JSON.parse(rawData);

  const batchData = leadsData.map((item) => {
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
    totalInFile: leadsData.length,
  };
}
