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

  const centred = (value: string, y: number, size: number, strong = false, color = ink) => {
    const font = strong ? bold : regular;
    text(value, (width - font.widthOfTextAtSize(value, size)) / 2, y, size, strong, color);
  };

  centred('A P X   R I D E', 775, 23, true);
  centred('E L E V A T E   E V E R Y   M I L E', 755, 8, false, grey);
  line(730, gold, 1.5);
  text('TRIP INVOICE', left, 690, 17, true);
  page.drawRectangle({ x: left, y: 602, width: right - left, height: 66, borderColor: rule, borderWidth: 0.8 });
  labelled('Passenger name', data.passengerName, 62, 648, 145);
  labelled('Invoice #', data.invoiceNumber, 220, 648, 145);
  labelled('Invoice date', data.invoiceDate, 382, 648, 120);
  line(580);
  labelled('Pickup', data.pickup, left, 560, right - left);
  labelled('Drop-off', data.dropoff, left, 516, right - left);
  labelled('Journey', `${data.journeyDate} · ${data.vehicleCategory}`, left, 472, right - left);
  line(430);
  const charges = [
    ['Base fare', data.baseFare],
    ...(Number(data.airportFee) > 0 ? [['Airport fee', data.airportFee]] : []),
    ...(Number(data.tollFee) > 0 ? [['Toll fee', data.tollFee]] : []),
  ];
  const chargeTop = 398;
  text('Completed journey charges', 54, chargeTop, 11, true);
  const amountHeading = 'Amount';
  text(amountHeading, right - bold.widthOfTextAtSize(amountHeading, 11), chargeTop, 11, true);
  line(chargeTop - 14);
  charges.forEach(([label, amount], index) => {
    const y = chargeTop - 42 - index * 34;
    text(label, 54, y, 11);
    const price = `£${amount}`;
    text(price, right - bold.widthOfTextAtSize(price, 11), y, 11);
    line(y - 14);
  });
  const totalTop = chargeTop - 42 - charges.length * 34 - 2;
  line(totalTop, gold, 2);
  text('Sub Total', 54, totalTop - 32, 15, true);
  const total = `£${data.fare}`;
  text(total, right - bold.widthOfTextAtSize(total, 17), totalTop - 34, 17, true);
  line(totalTop - 54, gold, 2);
  text(`Invoice reference ${data.invoiceNumber} · Booking ${data.bookingReference}`, left, totalTop - 88, 8, false, grey);
  document.setTitle(`APX RIDE invoice ${data.invoiceNumber}`);
  document.setAuthor('APX RIDE');
  document.setSubject('Completed journey invoice');
  document.setCreationDate(new Date());
  return document.save();
}
