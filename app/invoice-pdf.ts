import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type InvoicePdfData = {
  invoiceNumber: string;
  invoiceDate: string;
  passengerName: string;
  pickup: string;
  dropoff: string;
  journeyDate: string;
  vehicleCategory: string;
  bookingReference: string;
  baseFare: string;
  airportFee: string;
  tollFee: string;
  fare: string;
};

const gold = rgb(0.74, 0.57, 0.15);
const ink = rgb(0.13, 0.13, 0.13);
const grey = rgb(0.42, 0.42, 0.42);
const rule = rgb(0.84, 0.84, 0.84);

export async function createInvoicePdf(data: InvoicePdfData) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const left = 48;
  const right = width - 48;
  const text = (value: string, x: number, y: number, size = 10, strong = false, color = ink) => page.drawText(value || '-', { x, y, size, font: strong ? bold : regular, color });
  const line = (y: number, color = rule, thickness = 1) => page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness, color });
  const wrap = (value: string, maxWidth: number, size = 11) => {
    const words = (value || '-').split(/\s+/); const lines: string[] = []; let current = '';
    for (const word of words) { const next = current ? `${current} ${word}` : word; if (regular.widthOfTextAtSize(next, size) <= maxWidth) current = next; else { if (current) lines.push(current); current = word; } }
    if (current) lines.push(current); return lines.slice(0, 3);
  };
  const labelled = (label: string, value: string, x: number, y: number, maxWidth = 220) => {
    text(label.toUpperCase(), x, y, 8, false, grey);
    wrap(value, maxWidth).forEach((entry, index) => text(entry, x, y - 18 - index * 14, 11, true));
  };

  page.drawRectangle({ x: 0, y: 768, width, height: 74, color: ink });
  text('APX RIDE', left, 801, 27, true, rgb(1, 1, 1));
  text('ELEVATE EVERY MILE', left, 782, 9, false, gold);
  text('TRIP INVOICE', left, 724, 20, true);
  page.drawRectangle({ x: left, y: 610, width: right - left, height: 86, borderColor: rule, borderWidth: 1 });
  labelled('Passenger name', data.passengerName, 64, 672, 145);
  labelled('Invoice #', data.invoiceNumber, 228, 672, 140);
  labelled('Invoice date', data.invoiceDate, 405, 672, 120);
  labelled('Pickup', data.pickup, left, 570, right - left);
  line(510);
  labelled('Drop-off', data.dropoff, left, 486, right - left);
  line(426);
  labelled('Journey', `${data.journeyDate} · ${data.vehicleCategory}`, left, 402, right - left);
  const charges = [
    ['Base fare', data.baseFare],
    ...(Number(data.airportFee) > 0 ? [['Airport fee', data.airportFee]] : []),
    ...(Number(data.tollFee) > 0 ? [['Toll fee', data.tollFee]] : []),
  ];
  const chargeTop = 350;
  const chargeHeight = 46 + charges.length * 30;
  page.drawRectangle({ x: left, y: chargeTop - chargeHeight, width: right - left, height: chargeHeight, color: rgb(0.97, 0.97, 0.96) });
  text('COMPLETED JOURNEY CHARGES', 62, chargeTop - 24, 9, true, grey);
  text('Amount', 445, chargeTop - 24, 9, true, grey);
  charges.forEach(([label, amount], index) => {
    const y = chargeTop - 54 - index * 30;
    text(label, 62, y, 11);
    const price = `£${amount}`;
    text(price, right - 16 - bold.widthOfTextAtSize(price, 12), y, 12, true);
  });
  const totalTop = chargeTop - chargeHeight - 26;
  line(totalTop, gold, 2);
  text('SUB TOTAL', 62, totalTop - 34, 15, true);
  const total = `£${data.fare}`;
  text(total, right - bold.widthOfTextAtSize(total, 21), totalTop - 38, 21, true);
  line(totalTop - 54, gold, 2);
  text(`Invoice reference ${data.invoiceNumber} · Booking ${data.bookingReference}`, left, 122, 9, false, grey);
  text('Please reply to the accompanying email if any details require correction.', left, 102, 9, false, grey);
  text('APX RIDE · Formal journey invoice', left, 58, 8, false, grey);
  document.setTitle(`APX RIDE invoice ${data.invoiceNumber}`);
  document.setAuthor('APX RIDE');
  document.setSubject('Completed journey invoice');
  document.setCreationDate(new Date());
  return document.save();
}
