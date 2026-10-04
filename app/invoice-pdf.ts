type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  passengerName: string;
  pickup: string;
  dropoff: string;
  journeyDate: string;
  vehicleCategory: string;
  fare: string;
};

const pdfText = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1');

export function createInvoicePdf(data: InvoicePdfData) {
  const commands = [
    '0.84 0.67 0.18 rg', '0 780 595 62 re f',
    '1 1 1 rg', 'BT /F2 25 Tf 48 812 Td (APX RIDE) Tj ET',
    '0.16 0.16 0.16 rg', 'BT /F2 18 Tf 48 736 Td (TRIP INVOICE) Tj ET',
    '0.45 0.45 0.45 rg', 'BT /F1 9 Tf 48 712 Td (ELEVATE EVERY MILE) Tj ET',
    '0.82 0.82 0.82 RG', '48 688 m 547 688 l S',
    '0.16 0.16 0.16 rg',
    `BT /F1 10 Tf 48 660 Td (Passenger) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.passengerName)}) Tj ET`,
    `BT /F1 10 Tf 310 660 Td (Invoice number) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.invoiceNumber)}) Tj ET`,
    `BT /F1 10 Tf 48 605 Td (Invoice date) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.invoiceDate)}) Tj ET`,
    `BT /F1 10 Tf 310 605 Td (Journey date) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.journeyDate)}) Tj ET`,
    '0.82 0.82 0.82 RG', '48 552 m 547 552 l S',
    `BT /F1 10 Tf 48 526 Td (Pickup) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.pickup)}) Tj ET`,
    `BT /F1 10 Tf 48 466 Td (Drop-off) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.dropoff)}) Tj ET`,
    `BT /F1 10 Tf 48 406 Td (Vehicle category) Tj /F2 11 Tf 0 -18 Td (${pdfText(data.vehicleCategory)}) Tj ET`,
    '0.84 0.67 0.18 RG', '2 w', '48 332 m 547 332 l S', '48 274 m 547 274 l S',
    '0.16 0.16 0.16 rg', 'BT /F2 14 Tf 48 300 Td (Completed journey charges) Tj ET',
    `BT /F2 19 Tf 430 296 Td (GBP ${pdfText(data.fare)}) Tj ET`,
    `BT /F1 9 Tf 48 228 Td (Invoice reference ${pdfText(data.invoiceNumber)}) Tj ET`,
    'BT /F1 9 Tf 48 205 Td (Please reply to the accompanying email if any details require correction.) Tj ET',
  ].join('\n');
  const objects: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  objects[6] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) { offsets[id] = pdf.length; pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`; }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}
