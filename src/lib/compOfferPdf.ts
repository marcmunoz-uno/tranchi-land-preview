import { jsPDF } from 'jspdf';
import type { CompSettings, LandComp, LandRecord } from '../types';
import { addressLabel, analyzeLand, dateLabel, money, number } from './analysis';

export type CompOfferPdfInput = {
  subject: LandRecord;
  comps: LandComp[];
  settings: CompSettings;
  assignmentFee: number;
  closingCosts: number;
  datasetGeneratedAt: string;
  now?: Date;
};

const INK = [27, 39, 55] as const;
const MUTED = [91, 105, 123] as const;
const GOLD = [155, 120, 38] as const;
const LINE = [216, 221, 228] as const;

function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function fileToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'parcel';
}

export function downloadCompOfferPdf(input: CompOfferPdfInput) {
  const { subject, comps, settings } = input;
  const assignmentFee = safeAmount(input.assignmentFee);
  const closingCosts = safeAmount(input.closingCosts);
  const analysis = analyzeLand(subject, comps);
  const maxOffer = analysis.estimatedValue === null ? null : analysis.estimatedValue - assignmentFee - closingCosts;
  const now = input.now ?? new Date();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const newPage = () => { doc.addPage(); y = margin; };
  const ensure = (height: number) => { if (y + height > pageHeight - 48) newPage(); };
  const text = (value: string, options: { size?: number; color?: readonly [number, number, number]; style?: 'normal' | 'bold'; width?: number; lineHeight?: number } = {}) => {
    const size = options.size ?? 9;
    const lineHeight = options.lineHeight ?? size * 1.4;
    const lines = doc.splitTextToSize(value, options.width ?? contentWidth) as string[];
    doc.setFont('helvetica', options.style ?? 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? INK));
    lines.forEach((line: string) => {
      ensure(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    });
  };
  const gap = (height = 8) => { y += height; };
  const heading = (value: string) => {
    ensure(32);
    gap(7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...GOLD);
    doc.text(value.toUpperCase(), margin, y);
    y += 8;
    doc.setDrawColor(...LINE);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;
  };
  const keyValues = (rows: [string, string][]) => {
    const columnWidth = contentWidth / 2;
    for (let index = 0; index < rows.length; index += 2) {
      const pair = rows.slice(index, index + 2);
      const wrapped = pair.map(([label, value]) => ({
        label,
        lines: doc.splitTextToSize(value, columnWidth - 20) as string[],
      }));
      const rowHeight = Math.max(...wrapped.map(item => 12 + item.lines.length * 12), 28);
      ensure(rowHeight);
      wrapped.forEach((item, column) => {
        const x = margin + column * columnWidth;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
        doc.text(item.label.toUpperCase(), x, y);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK);
        item.lines.forEach((line, lineIndex) => doc.text(line, x, y + 12 + lineIndex * 12));
      });
      y += rowHeight;
    }
  };

  doc.setFillColor(11, 20, 36);
  doc.rect(0, 0, pageWidth, 84, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(232, 212, 139);
  doc.text('TRANCHI LAND', margin, 34);
  doc.setFontSize(10); doc.setTextColor(237, 242, 248);
  doc.text('COMP & OFFER WORKSHEET', margin, 55);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 191, 208);
  doc.text(`Generated ${now.toLocaleString('en-US')}`, pageWidth - margin, 35, { align: 'right' });
  doc.text('Planning analysis · not an appraisal or offer', pageWidth - margin, 54, { align: 'right' });
  y = 108;

  text(addressLabel(subject), { size: 17, style: 'bold', lineHeight: 22 });
  text(`APN: ${subject.apn ?? 'Unknown'}  ·  Cached record: ${subject.cachedAt.slice(0, 10)}`, { size: 8.5, color: MUTED });

  heading('Subject parcel facts');
  keyValues([
    ['Acreage', subject.lot.acres == null ? 'Unknown' : `${number(subject.lot.acres)} acres`],
    ['Square feet', subject.lot.squareFeet == null ? 'Unknown' : `${number(subject.lot.squareFeet, 0)} sq ft`],
    ['Zoning', subject.lot.zoning ?? 'Unknown'],
    ['Topography', subject.lot.topography ?? 'Unknown'],
    ['Assessor land market value', money(subject.assessment.landMarketValue)],
    ['Assessed land value', money(subject.assessment.assessedLandValue)],
    ['Last recorded sale', `${money(subject.sale.price)} · ${dateLabel(subject.sale.date)}`],
    ['Sale transaction', subject.sale.transactionType ?? 'Unknown'],
    ['Frontage / depth', `${subject.lot.frontageFeet == null ? 'Unknown' : `${number(subject.lot.frontageFeet, 0)} ft`} / ${subject.lot.depthFeet == null ? 'Unknown' : `${number(subject.lot.depthFeet, 0)} ft`}`],
    ['Location validation', `${subject.address.geoStatus ?? 'Unknown'} (point, not boundary)`],
  ]);

  heading('Selected comp evidence');
  text(`${comps.length} selected of the qualifying arms-length recorded sales. Search: ${settings.radiusMiles} mile radius · up to ${settings.maxAgeMonths} months old · acreage within ${settings.acreageTolerance}× subject size.`, { size: 8.5, color: MUTED });
  gap(5);
  if (comps.length) {
    const widths = [164, 60, 44, 52, 96, 112];
    const headers = ['Comp / APN', 'Sale date', 'Acres', 'Distance', 'Sale price', 'Price / acre'];
    ensure(24);
    doc.setFillColor(239, 241, 244); doc.rect(margin, y - 10, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    let x = margin;
    headers.forEach((header, index) => { doc.text(header, x + 3, y + 3); x += widths[index]; });
    y += 18;
    comps.forEach(comp => {
      const cells = [
        `${comp.record.address.street ?? comp.record.apn ?? 'Land parcel'}${comp.record.apn ? `\n${comp.record.apn}` : ''}`,
        dateLabel(comp.record.sale.date),
        number(comp.record.lot.acres),
        `${comp.distanceMiles.toFixed(1)} mi`,
        money(comp.record.sale.price),
        money(comp.pricePerAcre),
      ];
      const wrapped = cells.map((cell, index) => doc.splitTextToSize(cell, widths[index] - 7) as string[]);
      const rowHeight = Math.max(...wrapped.map(lines => lines.length)) * 10 + 9;
      ensure(rowHeight);
      x = margin;
      wrapped.forEach((lines, index) => {
        doc.setFont('helvetica', index >= 4 ? 'bold' : 'normal'); doc.setFontSize(7.5); doc.setTextColor(...INK);
        lines.forEach((line, lineIndex) => doc.text(line, x + 3, y + 8 + lineIndex * 10));
        x += widths[index];
      });
      doc.setDrawColor(...LINE); doc.line(margin, y + rowHeight - 2, pageWidth - margin, y + rowHeight - 2);
      y += rowHeight;
    });
  } else {
    text('No comp evidence is selected. No value conclusion can be drawn.', { style: 'bold' });
  }

  heading('Value and maximum-offer model');
  if (analysis.available) {
    keyValues([
      ['Median selected comp price / acre', money(analysis.pricePerAcre)],
      ['Subject acreage', `${number(subject.lot.acres)} acres`],
      ['Estimated land value', money(analysis.estimatedValue)],
      ['Desired assignment fee', money(assignmentFee)],
      ['Estimated closing costs', money(closingCosts)],
      ['Maximum seller offer', money(maxOffer)],
    ]);
    gap(3);
    text(`${money(analysis.estimatedValue)} estimated value − ${money(assignmentFee)} assignment fee − ${money(closingCosts)} closing costs = ${money(maxOffer)} maximum seller offer.`, { size: 9, style: 'bold', color: maxOffer !== null && maxOffer < 0 ? [165, 48, 48] : INK });
  } else {
    text('NOT ENOUGH USABLE COMPS — NO ESTIMATE OR MAXIMUM OFFER CALCULATED', { size: 10, style: 'bold', color: [165, 48, 48] });
    gap(3);
    text(`Only ${comps.length} comp${comps.length === 1 ? ' is' : 's are'} selected; at least three are required. Estimated value: unavailable. Maximum seller offer: unavailable. Desired assignment fee: ${money(assignmentFee)}. Estimated closing costs: ${money(closingCosts)}.`, { size: 9 });
    text('Broaden the explicit search settings or select more qualifying evidence. Do not substitute the assessor value for a market comp.', { size: 8.5, color: MUTED });
  }

  heading('Assumptions and required verification');
  [
    'This worksheet is planning math, not an appraisal, buyer commitment, contract, or offer sent to any party.',
    'Estimated value is the unadjusted median selected-comp price per acre multiplied by subject acreage. No location, condition, access, zoning, utility, or time adjustments are made.',
    'Comps are recorded sales from the cached multi-market public-record land sample that meet the displayed radius, sale-age, acreage, and arms-length criteria and were selected for this worksheet.',
    'Maximum seller offer subtracts only the entered assignment fee and closing costs. Repairs, title issues, taxes, liens, commissions, financing, holding costs, resale costs, and profit margin are not separately modeled.',
    'Public records can be wrong or stale. Verify current ownership, title, taxes, legal and physical access, zoning, utilities, environmental constraints, flood/wetlands, parcel boundaries, and end-buyer demand before contracting.',
    `Source cache generated ${input.datasetGeneratedAt}. No owner contact details, live feed, or outbound action is included.`,
  ].forEach(item => { text(`• ${item}`, { size: 8.3, color: MUTED, lineHeight: 11.5 }); gap(2); });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE); doc.line(margin, pageHeight - 32, pageWidth - margin, pageHeight - 32);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
    doc.text('Tranchi Land · comp/offer planning worksheet', margin, pageHeight - 19);
    doc.text(`Page ${page} of ${pages}`, pageWidth - margin, pageHeight - 19, { align: 'right' });
  }

  const filename = `tranchi-comp-offer-${fileToken(subject.apn ?? subject.address.street ?? subject.id)}.pdf`;
  doc.save(filename);
  return filename;
}
