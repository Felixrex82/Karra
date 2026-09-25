import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BusinessProfile, DailySummary } from '../types';
import { formatNaira, formatPDFCurrency } from '../engine/calculations';

export interface MonthlyCardExportData {
  year: number;
  month: number; // 0-indexed (e.g. 8 for September)
  monthName: string;
  totalSales: number;
  totalCostOfGoods: number;
  totalExpenses: number;
  netProfit: number;
  netMarginPercent: number;
  cashReceived: number;
  creditGiven: number;
  profitableDaysCount: number;
  lossDaysCount: number;
  breakevenDaysCount: number;
  bestDay: { date: string; profit: number };
  totalTransactions: number;
  totalItemsSold: number;
  monthSummaries?: Record<string, DailySummary>;
  daysInMonth: number;
}

/**
 * Generate a high-DPI Canvas representing the Monthly Calendar Performance Card
 */
export function renderMonthlyCardCanvas(data: MonthlyCardExportData, businessName: string): HTMLCanvasElement {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background gradient: sleek dark slate / deep navy
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(0.5, '#111827');
  bgGrad.addColorStop(1, '#0c1322');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient radial glow in corners
  const radialGlow = ctx.createRadialGradient(width - 100, 100, 10, width - 100, 100, 450);
  radialGlow.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  radialGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  const radialGlow2 = ctx.createRadialGradient(100, height - 100, 10, 100, height - 100, 400);
  radialGlow2.addColorStop(0, 'rgba(59, 130, 246, 0.12)');
  radialGlow2.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = radialGlow2;
  ctx.fillRect(0, 0, width, height);

  // Outer border with rounded corners
  ctx.save();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 28);
  ctx.stroke();
  ctx.restore();

  // Inner decorative accent border
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 24);
  ctx.stroke();
  ctx.restore();

  // Top Verified Badge
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
  drawRoundedRect(ctx, 60, 56, 260, 34, 17);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, 56, 260, 34, 17);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ KARRA AUDIT RECORD', 80, 78);
  ctx.restore();

  // Top Right Date Generated
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Issued: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, width - 60, 78);
  ctx.textAlign = 'left';

  // Business Name & Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(businessName || 'Karra Business', 60, 140);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.monthName.toUpperCase()} ${data.year} MONTHLY PERFORMANCE CARD`, 60, 175);

  // Big Hero Metric Box: Net Operating Result / Take-Home Profit
  const isProfit = data.netProfit >= 0;
  const heroBoxY = 205;
  const heroBoxH = 140;
  ctx.save();
  ctx.fillStyle = isProfit ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)';
  drawRoundedRect(ctx, 60, heroBoxY, width - 120, heroBoxH, 20);
  ctx.fill();
  ctx.strokeStyle = isProfit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, heroBoxY, width - 120, heroBoxH, 20);
  ctx.stroke();

  // Hero Box Content
  ctx.fillStyle = isProfit ? '#34d399' : '#f87171';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('NET OPERATING RESULT (ESTIMATED TAKE-HOME PROFIT)', 90, heroBoxY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px monospace';
  const profitText = isProfit ? `+${formatNaira(data.netProfit)}` : `-${formatNaira(Math.abs(data.netProfit))}`;
  ctx.fillText(profitText, 90, heroBoxY + 98);

  // Margin pill inside Hero Box
  ctx.textAlign = 'right';
  ctx.fillStyle = isProfit ? '#10b981' : '#ef4444';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${isProfit ? 'PROFITABLE MONTH' : 'DEFICIT'} (${data.netMarginPercent.toFixed(1)}% Net Margin)`, width - 90, heroBoxY + 68);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${data.profitableDaysCount} Profitable Days • ${data.lossDaysCount} Loss Days`, width - 90, heroBoxY + 100);
  ctx.textAlign = 'left';
  ctx.restore();

  // 4 Primary Financial KPI Metric Cards
  const kpiY = 370;
  const kpiW = (width - 120 - 45) / 4;
  const kpiH = 120;

  const kpis = [
    { label: 'GROSS SALES', value: formatNaira(data.totalSales), sub: `${data.totalTransactions} recorded sales`, color: '#10b981' },
    { label: 'PRODUCT COSTS (COGS)', value: formatNaira(data.totalCostOfGoods), sub: `${data.totalItemsSold} items moved`, color: '#60a5fa' },
    { label: 'OPERATING EXPENSES', value: formatNaira(data.totalExpenses), sub: 'Rent, logistics, utilities', color: '#f59e0b' },
    { label: 'CASH COLLECTED', value: formatNaira(data.cashReceived), sub: `Credit extended: ${formatNaira(data.creditGiven)}`, color: '#a78bfa' },
  ];

  kpis.forEach((kpi, index) => {
    const x = 60 + index * (kpiW + 15);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    drawRoundedRect(ctx, x, kpiY, kpiW, kpiH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, kpiY, kpiW, kpiH, 16);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(kpi.label, x + 18, kpiY + 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(kpi.value, x + 18, kpiY + 66);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(kpi.sub, x + 18, kpiY + 96);
    ctx.restore();
  });

  // Operational Statistics Row
  const opsY = 515;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  drawRoundedRect(ctx, 60, opsY, width - 120, 160, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  drawRoundedRect(ctx, 60, opsY, width - 120, 160, 18);
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('MONTHLY OPERATIONAL INSIGHTS & RHYTHM', 85, opsY + 36);

  const opsCols = [
    { title: 'Best Trading Day', val: data.bestDay.date ? `${data.bestDay.date} (+${formatNaira(data.bestDay.profit)})` : 'None logged' },
    { title: 'Trading Consistency', val: `${data.profitableDaysCount} Profit / ${data.lossDaysCount} Loss / ${data.breakevenDaysCount} Break-even` },
    { title: 'Average Daily Revenue', val: data.daysInMonth > 0 ? formatNaira(Math.round(data.totalSales / data.daysInMonth)) : '₦0' },
  ];

  opsCols.forEach((col, idx) => {
    const colW = (width - 170) / 3;
    const colX = 85 + idx * colW;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(col.title, colX, opsY + 74);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(col.val, colX, opsY + 102);
  });

  // Verified Seal Text
  ctx.fillStyle = '#64748b';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Historical cost locking & yield conversions calculated deterministically without assumptions.', 85, opsY + 136);
  ctx.restore();

  // Footer Watermark
  ctx.fillStyle = '#475569';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Karra • The AI Operating System for Informal & Emerging Market Merchants', 60, height - 42);

  ctx.textAlign = 'right';
  ctx.fillText('Official Digital Monthly Statement • www.karra.ng', width - 60, height - 42);

  return canvas;
}

/**
 * Trigger download of Monthly Card as PNG Image
 */
export async function exportMonthlyCardToPNG(data: MonthlyCardExportData, businessName: string): Promise<void> {
  const canvas = renderMonthlyCardCanvas(data, businessName);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karra_${data.monthName.toLowerCase()}_${data.year}_monthly_card.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

/**
 * Export Monthly Card to a formatted PDF Document using jsPDF & autoTable
 */
export function exportMonthlyCardToPDF(data: MonthlyCardExportData, businessName: string): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 14;
  const rightMargin = 14;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 182mm

  const darkColor = [15, 23, 42]; // #0f172a
  const emeraldColor = [5, 150, 105]; // #059669
  const emeraldBg = [240, 253, 244]; // #f0fdf4
  const slate600 = [71, 85, 105]; // #475569
  const slate400 = [148, 163, 184]; // #94a3b8
  const lightBg = [248, 250, 252]; // #f8fafc
  const borderColor = [226, 232, 240]; // #e2e8f0

  // 1. Header Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(businessName || 'Karra Business', leftMargin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  doc.text('Karra Verified Monthly Performance Card & Audit Statement', leftMargin, 23);

  // Right badges
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text(`${data.monthName.toUpperCase()} ${data.year} SUMMARY`, pageWidth - rightMargin, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, pageWidth - rightMargin, 22, { align: 'right' });

  // Divider
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.5);
  doc.line(leftMargin, 26, pageWidth - rightMargin, 26);

  // 2. Highlight Box: Net Result
  const isProfit = data.netProfit >= 0;
  const heroY = 31;
  const heroH = 24;

  if (isProfit) {
    doc.setFillColor(emeraldBg[0], emeraldBg[1], emeraldBg[2]);
    doc.setDrawColor(emeraldColor[0], emeraldColor[1], emeraldColor[2]);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
  }
  doc.setLineWidth(0.4);
  doc.roundedRect(leftMargin, heroY, contentWidth, heroH, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(isProfit ? emeraldColor[0] : 185, isProfit ? emeraldColor[1] : 28, isProfit ? emeraldColor[2] : 28);
  doc.text('NET OPERATING RESULT / TAKE-HOME PROFIT', leftMargin + 6, heroY + 8);

  doc.setFontSize(16);
  doc.text(formatPDFCurrency(data.netProfit), leftMargin + 6, heroY + 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `${isProfit ? 'PROFITABLE' : 'DEFICIT'} (${data.netMarginPercent.toFixed(1)}% Net Margin)`,
    pageWidth - rightMargin - 6,
    heroY + 10,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(slate600[0], slate600[1], slate600[2]);
  doc.text(
    `${data.profitableDaysCount} Profitable Days • ${data.lossDaysCount} Loss Days`,
    pageWidth - rightMargin - 6,
    heroY + 17,
    { align: 'right' }
  );

  // 3. 4 Core Financial KPIs
  const cardY = 59;
  const cardW = (contentWidth - 9) / 4;
  const cardH = 22;

  const kpiList = [
    { label: 'Gross Sales', val: formatPDFCurrency(data.totalSales), sub: `${data.totalTransactions} events` },
    { label: 'Product Costs', val: formatPDFCurrency(data.totalCostOfGoods), sub: `${data.totalItemsSold} items moved` },
    { label: 'Operating Expenses', val: formatPDFCurrency(data.totalExpenses), sub: 'Rent, transport, misc' },
    { label: 'Cash Collected', val: formatPDFCurrency(data.cashReceived), sub: `Credit: ${formatPDFCurrency(data.creditGiven)}` },
  ];

  kpiList.forEach((kpi, idx) => {
    const x = leftMargin + idx * (cardW + 3);
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(slate600[0], slate600[1], slate600[2]);
    doc.text(kpi.label.toUpperCase(), x + 3.5, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(kpi.val, x + 3.5, cardY + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(slate400[0], slate400[1], slate400[2]);
    doc.text(kpi.sub, x + 3.5, cardY + 18);
  });

  // 4. Daily Calendar Breakdown Table (All active days in the month)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
  doc.text('Calendar Daily Performance Breakdown', leftMargin, 88);

  const tableRows: any[][] = [];
  if (data.monthSummaries) {
    const dates = Object.keys(data.monthSummaries).sort();
    for (const d of dates) {
      const sum = data.monthSummaries[d];
      if (sum.eventsCount > 0) {
        tableRows.push([
          d,
          formatPDFCurrency(sum.sales),
          formatPDFCurrency(sum.costOfGoods),
          formatPDFCurrency(sum.expenses),
          formatPDFCurrency(sum.netOperatingResult),
          sum.status === 'PROFIT' ? 'Profitable' : sum.status === 'LOSS' ? 'Loss' : 'Break-even',
          sum.plainSummary || `${sum.eventsCount} events`,
        ]);
      }
    }
  }

  if (tableRows.length === 0) {
    tableRows.push(['No transactions recorded in this month', '-', '-', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: 92,
    margin: { left: leftMargin, right: rightMargin },
    head: [['Date', 'Sales', 'COGS', 'Expenses', 'Net Profit', 'Status', 'Daily Activity Note']],
    body: tableRows,
    theme: 'plain',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 24 },
      3: { cellWidth: 22 },
      4: { fontStyle: 'bold', cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 'auto' },
    },
  });

  // Footer note
  const finalY = (doc as any).lastAutoTable?.finalY || 250;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(slate400[0], slate400[1], slate400[2]);
  doc.text(
    'Karra Verified Financial Operating System • Deterministic cost accounting without manual ledger tampering.',
    leftMargin,
    Math.min(finalY + 12, 285)
  );

  doc.save(`karra_${data.monthName.toLowerCase()}_${data.year}_monthly_card.pdf`);
}

/**
 * Generate a high-DPI Canvas for the Merchant Business Profile Card
 * When excludeBankDetails is true (e.g. for card downloads), the right column displays
 * executive corporate credentials and trading operational metadata instead of sensitive bank details.
 */
export function renderBusinessCardCanvas(
  profile: BusinessProfile,
  businessName?: string,
  excludeBankDetails: boolean = false
): HTMLCanvasElement {
  const width = 1050;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const actualName = businessName || profile.businessName || 'Karra Merchant Store';

  // Deep dark luxury card gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0a0f1d');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#091220');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Emerald & gold glow accents
  const glow1 = ctx.createRadialGradient(width - 50, 50, 10, width - 50, 50, 350);
  glow1.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
  glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(80, height - 80, 10, 80, height - 80, 300);
  glow2.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
  glow2.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Card Outer Border
  ctx.save();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 20, 20, width - 40, height - 40, 26);
  ctx.stroke();

  // Subtle inner emerald border
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 26, 26, width - 52, height - 52, 22);
  ctx.stroke();
  ctx.restore();

  // Avatar Initial Box
  const avatarSize = 84;
  ctx.save();
  ctx.fillStyle = '#0f172a';
  drawRoundedRect(ctx, 52, 52, avatarSize, avatarSize, 18);
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 52, 52, avatarSize, avatarSize, 18);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(actualName.charAt(0).toUpperCase(), 52 + avatarSize / 2, 52 + 58);
  ctx.restore();

  // Verified Badge (Top right)
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  drawRoundedRect(ctx, width - 290, 52, 238, 36, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, width - 290, 52, 238, 36, 18);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🛡️ KARRA VERIFIED MERCHANT', width - 275, 75);
  ctx.restore();

  // Business Name & Category
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(actualName, 156, 88);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(profile.tagline || profile.category || 'Retail & Wholesale Merchant Store', 156, 116);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const ownerEst = `Proprietor: ${profile.ownerName} • Est. ${profile.foundedYear || 2019}${profile.registrationNumber ? ` • CAC: ${profile.registrationNumber}` : ''}`;
  ctx.fillText(ownerEst, 156, 138);

  // Left Column: Contact & Location Info
  const leftColX = 52;
  const startY = 175;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  drawRoundedRect(ctx, leftColX, startY, 440, 340, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, leftColX, startY, 440, 340, 18);
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OFFICIAL CONTACT & ADDRESS', leftColX + 22, startY + 32);

  // Phone / WhatsApp
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TELEPHONE / WHATSAPP DIRECT', leftColX + 22, startY + 64);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(profile.phone || '+234 800 000 0000', leftColX + 22, startY + 84);

  // Official Email
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OFFICIAL EMAIL ADDRESS', leftColX + 22, startY + 114);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(profile.email || 'executive@karra.ng', leftColX + 22, startY + 134);

  // Headquarters Address
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('HEADQUARTERS / PHYSICAL ADDRESS', leftColX + 22, startY + 166);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const addr1 = profile.address || 'Commercial Market';
  const addr2 = profile.cityState || 'Nigeria';
  ctx.fillText(addr1, leftColX + 22, startY + 188);
  ctx.fillText(addr2, leftColX + 22, startY + 208);

  // Trading Hours
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TRADING & DISPATCH HOURS', leftColX + 22, startY + 240);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(profile.openingHours || 'Mon – Sat: 7:30 AM – 7:00 PM', leftColX + 22, startY + 262);

  ctx.fillStyle = '#64748b';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Fast verified invoice response & executive trade directory', leftColX + 22, startY + 304);
  ctx.restore();

  // Right Column: Bank Settlement OR Corporate Trade Credentials (when excludeBankDetails = true)
  const rightColX = 512;
  ctx.save();

  if (excludeBankDetails) {
    // Elegant Corporate Standing & Trade Identity Box (No Account Details)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    drawRoundedRect(ctx, rightColX, startY, 486, 340, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, rightColX, startY, 486, 340, 18);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('🏛️ CORPORATE TRADE CREDENTIALS', rightColX + 24, startY + 34);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Corporate identification & commercial procurement profile', rightColX + 24, startY + 56);

    // Business Sector
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('BUSINESS CATEGORY / SECTOR', rightColX + 24, startY + 98);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(profile.category || 'Commodities, Provisions & Wholesale', rightColX + 24, startY + 122);

    // CAC Corporate Registration
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('CORPORATE AFFAIRS COMMISSION (CAC)', rightColX + 24, startY + 162);

    ctx.fillStyle = profile.registrationNumber ? '#38bdf8' : '#94a3b8';
    ctx.font = profile.registrationNumber ? 'bold 24px monospace' : 'italic 16px sans-serif';
    ctx.fillText(profile.registrationNumber ? profile.registrationNumber : 'Not Registered / Pending', rightColX + 24, startY + 192);

    // Trade Operations / Invoicing Policy
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('COMMERCIAL INVOICING & SETTLEMENT', rightColX + 24, startY + 232);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Direct Invoicing via Verified Official Merchant Desk', rightColX + 24, startY + 254);

    ctx.fillStyle = '#10b981';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✓ Operating System Authenticated • Tier-1 Commercial Registry', rightColX + 24, startY + 312);
  } else {
    // Official Bank Settlement Details
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    drawRoundedRect(ctx, rightColX, startY, 486, 340, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, rightColX, startY, 486, 340, 18);
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('💳 OFFICIAL BANK SETTLEMENT ACCOUNT', rightColX + 24, startY + 34);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('For customer bank transfers, supplies & debt settlement', rightColX + 24, startY + 56);

    // Bank Name
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('BANK NAME', rightColX + 24, startY + 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(profile.bankDetails?.bankName || 'First Bank of Nigeria', rightColX + 24, startY + 126);

    // Account Number (Massive & Clear Monospace)
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ACCOUNT NUMBER (NUBAN)', rightColX + 24, startY + 172);

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(profile.bankDetails?.accountNumber || '3049281094', rightColX + 24, startY + 214);

    // Account Name
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ACCOUNT NAME', rightColX + 24, startY + 256);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(profile.bankDetails?.accountName || actualName, rightColX + 24, startY + 280);

    ctx.fillStyle = '#10b981';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✓ Verified for instant POS & Mobile App Bank Transfers', rightColX + 24, startY + 312);
  }
  ctx.restore();

  // Watermark Footer
  ctx.fillStyle = '#475569';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Karra Official Merchant Digital Card • Powered by Karra AI Operating System', 52, height - 32);

  return canvas;
}

/**
 * Trigger download of Business Card as PNG Image.
 * Excludes account details by default when downloading the profile card.
 */
export async function exportBusinessCardToPNG(
  profile: BusinessProfile,
  businessName?: string,
  excludeBankDetails: boolean = true
): Promise<void> {
  const canvas = renderBusinessCardCanvas(profile, businessName, excludeBankDetails);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const actualName = businessName || profile.businessName || 'merchant';
      const cleanName = actualName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karra_business_card_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

/**
 * Trigger download of Business Card as formatted printable PDF
 */
export function exportBusinessCardToPDF(profile: BusinessProfile, businessName?: string): void {
  const actualName = businessName || profile.businessName || 'Karra Merchant';
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [140, 85], // standard card / postcard proportion
  });

  const width = 140;
  const height = 85;

  // Background
  doc.setFillColor(15, 23, 42); // slate 900
  doc.rect(0, 0, width, height, 'F');

  // Decorative border
  doc.setDrawColor(5, 150, 105); // emerald
  doc.setLineWidth(0.8);
  doc.roundedRect(4, 4, width - 8, height - 8, 3, 3, 'D');

  // Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(52, 211, 153);
  doc.text('KARRA VERIFIED MERCHANT', 10, 11);

  // Business Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(actualName, 10, 19);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(profile.tagline || profile.category || 'Retail & Wholesale Merchant', 10, 24);

  doc.setFontSize(7);
  doc.setTextColor(56, 189, 248);
  doc.text(`Proprietor: ${profile.ownerName} • Est. ${profile.foundedYear || 2019}`, 10, 29);

  // Divider
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(10, 32, width - 10, 32);

  // Left Column: Contact
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PHONE / WHATSAPP', 10, 37);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(profile.phone || '+234 800 000 0000', 10, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('LOCATION / ADDRESS', 10, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(profile.address || 'Market Line', 10, 53);
  doc.text(profile.cityState || 'Nigeria', 10, 57);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('HOURS', 10, 63);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(56, 189, 248);
  doc.text(profile.openingHours || '7:30 AM - 7:00 PM', 10, 68);

  // Right Column: Bank Settlement
  const rightX = 72;
  doc.setFillColor(24, 34, 53);
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.4);
  doc.roundedRect(rightX, 35, 58, 38, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(52, 211, 153);
  doc.text('OFFICIAL BANK SETTLEMENT', rightX + 4, 41);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('BANK', rightX + 4, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(profile.bankDetails?.bankName || 'First Bank', rightX + 4, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('ACCOUNT NUMBER', rightX + 4, 55);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153);
  doc.text(profile.bankDetails?.accountNumber || '3049281094', rightX + 4, 61);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('NAME', rightX + 4, 66);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(profile.bankDetails?.accountName || actualName, rightX + 4, 70);

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Karra Official Merchant Digital Card • Instant Bank Transfer Verified', 10, 80);

  const cleanName = actualName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  doc.save(`karra_business_card_${cleanName}.pdf`);
}

/**
 * Format card details as text
 */
export function getBusinessCardText(profile: BusinessProfile, businessName?: string): string {
  const actualName = businessName || profile.businessName || 'Karra Enterprise';
  return `🏷️ *${actualName}*
${profile.tagline ? `_${profile.tagline}_\n` : ''}👤 Executive / Proprietor: ${profile.ownerName}
📞 Phone/WhatsApp: ${profile.phone}
✉️ Official Email: ${profile.email || 'executive@karra.ng'}
📍 Headquarters / Address: ${profile.address}, ${profile.cityState}
⏰ Trading Hours: ${profile.openingHours}
${profile.registrationNumber ? `📋 CAC Registration: ${profile.registrationNumber}\n` : ''}
💳 *Official Bank Settlement Account:*
Bank: ${profile.bankDetails?.bankName || 'N/A'}
Account Number: ${profile.bankDetails?.accountNumber || 'N/A'}
Account Name: ${profile.bankDetails?.accountName || actualName}

🛡️ Verified Karra Enterprise Commercial Profile`;
}

/**
 * Share Business Card via Web Share API or WhatsApp fallback
 */
export async function shareBusinessCard(
  profile: BusinessProfile,
  businessName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard' | 'whatsapp' }> {
  const cardText = getBusinessCardText(profile, businessName);
  const actualName = businessName || profile.businessName || 'Business Card';

  // Try Web Share with image file if possible
  if (navigator.share) {
    try {
      const canvas = renderBusinessCardCanvas(profile, businessName);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'business_card.png', { type: 'image/png' })] })) {
        const file = new File([blob], `${actualName}_card.png`, { type: 'image/png' });
        await navigator.share({
          title: `${actualName} - Business Contact Card`,
          text: cardText,
          files: [file],
        });
        return { success: true, method: 'web-share' };
      } else {
        await navigator.share({
          title: `${actualName} - Business Contact Card`,
          text: cardText,
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, method: 'web-share' };
      }
      // Fallback
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(cardText);
    return { success: true, method: 'clipboard' };
  } catch {
    // If clipboard fails, open WhatsApp directly
    const encoded = encodeURIComponent(cardText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    return { success: true, method: 'whatsapp' };
  }
}

/**
 * Helper to draw rounded rectangle on Canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * ============================================================================
 * EMAIL CATALOGUE CARD GENERATOR & SHARING
 * ============================================================================
 */
export interface EmailCatalogueItem {
  department: string;
  role: string;
  email: string;
  description: string;
}

export function renderEmailCatalogueCanvas(
  profile: BusinessProfile,
  emails: EmailCatalogueItem[],
  businessName?: string
): HTMLCanvasElement {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const actualName = businessName || profile.businessName || 'Karra Enterprise';

  // Deep luxury dark slate gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060B14');
  bgGrad.addColorStop(0.5, '#0E1726');
  bgGrad.addColorStop(1, '#08101E');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle accent glows
  const radial1 = ctx.createRadialGradient(width - 80, 80, 20, width - 80, 80, 450);
  radial1.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  radial1.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = radial1;
  ctx.fillRect(0, 0, width, height);

  const radial2 = ctx.createRadialGradient(80, height - 80, 20, 80, height - 80, 400);
  radial2.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
  radial2.addColorStop(1, 'rgba(99, 102, 241, 0)');
  ctx.fillStyle = radial2;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 24);
  ctx.stroke();
  ctx.restore();

  // Header Badge
  ctx.save();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  drawRoundedRect(ctx, 60, 56, 310, 36, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, 56, 310, 36, 18);
  ctx.stroke();

  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('⚡ OFFICIAL EMAIL CATALOGUE', 80, 79);
  ctx.restore();

  // Timestamp
  ctx.fillStyle = '#64748B';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Karra Verified Corporate Directory', width - 60, 79);
  ctx.textAlign = 'left';

  // Company Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(actualName, 60, 140);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Enterprise Communication & Departmental Inboxes', 60, 170);

  // Email items grid (2 columns x 2 rows)
  const items = emails.slice(0, 4);
  const startY = 210;
  const cardW = 520;
  const cardH = 220;

  items.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = 60 + col * (cardW + 40);
    const y = startY + row * (cardH + 24);

    // Box container
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    drawRoundedRect(ctx, x, y, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x, y, cardW, cardH, 18);
    ctx.stroke();

    // Department tag
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(item.department.toUpperCase(), x + 24, y + 36);

    // Role / Purpose
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(item.role, x + 24, y + 68);

    // Email address in emerald pill box
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    drawRoundedRect(ctx, x + 24, y + 92, cardW - 48, 48, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x + 24, y + 92, cardW - 48, 48, 12);
    ctx.stroke();

    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'bold 16px "SF Mono", Menlo, Consolas, monospace';
    ctx.fillText(item.email, x + 40, y + 122);

    // Description
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(item.description, x + 24, y + 175);

    ctx.restore();
  });

  // Footer
  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Protected by Karra Enterprise Security • Direct inquiries routed to authorized personnel', 60, height - 42);

  ctx.textAlign = 'right';
  ctx.fillText('Generated via Karra AI OS', width - 60, height - 42);
  ctx.textAlign = 'left';

  return canvas;
}

export async function exportEmailCatalogueToPNG(
  profile: BusinessProfile,
  emails: EmailCatalogueItem[],
  businessName?: string
): Promise<void> {
  const canvas = renderEmailCatalogueCanvas(profile, emails, businessName);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const actualName = businessName || profile.businessName || 'enterprise';
      const cleanName = actualName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karra_email_catalogue_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export function getEmailCatalogueText(
  profile: BusinessProfile,
  emails: EmailCatalogueItem[],
  businessName?: string
): string {
  const actualName = businessName || profile.businessName || 'Karra Enterprise';
  let text = `📬 *${actualName} — Official Corporate Email Directory*\n`;
  text += `_Verified Enterprise Communication Catalogue_\n\n`;

  emails.forEach((item) => {
    text += `🔹 *${item.department}* (${item.role})\n`;
    text += `✉️ ${item.email}\n`;
    text += `ℹ️ ${item.description}\n\n`;
  });

  text += `📞 Primary Telephone / WhatsApp: ${profile.phone}\n`;
  text += `📍 Headquarters: ${profile.address}, ${profile.cityState}\n`;
  text += `⚡ Powered by Karra AI Business Operating System`;
  return text;
}

export async function shareEmailCatalogue(
  profile: BusinessProfile,
  emails: EmailCatalogueItem[],
  businessName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard' | 'whatsapp' }> {
  const actualName = businessName || profile.businessName || 'Enterprise Email Directory';
  const text = getEmailCatalogueText(profile, emails, businessName);

  if (navigator.share) {
    try {
      const canvas = renderEmailCatalogueCanvas(profile, emails, businessName);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'email_catalogue.png', { type: 'image/png' })] })) {
        const file = new File([blob], `${actualName}_email_directory.png`, { type: 'image/png' });
        await navigator.share({
          title: `${actualName} - Email Directory`,
          text: text,
          files: [file],
        });
        return { success: true, method: 'web-share' };
      } else {
        await navigator.share({
          title: `${actualName} - Email Directory`,
          text: text,
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, method: 'web-share' };
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  } catch {
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    return { success: true, method: 'whatsapp' };
  }
}

/**
 * ============================================================================
 * OPERATING SYSTEM INTEGRITY & ARCHITECTURE CARD GENERATOR
 * ============================================================================
 */
export interface OSIntegrityData {
  kernelVersion: string;
  ledgerEngine: string;
  cloudSyncStatus: string;
  totalEvents: number;
  historicalCostModel: string;
  lastBackupTime: string;
  uptimeIntegrity: string;
}

export function renderOSIntegrityCanvas(
  profile: BusinessProfile,
  osData: OSIntegrityData,
  businessName?: string
): HTMLCanvasElement {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const actualName = businessName || profile.businessName || 'Karra Enterprise';

  // High-tech deep obsidian background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#090D16');
  bgGrad.addColorStop(0.5, '#0E1726');
  bgGrad.addColorStop(1, '#070C15');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Radial cyan/emerald ambient lights
  const radial1 = ctx.createRadialGradient(width - 100, 100, 10, width - 100, 100, 450);
  radial1.addColorStop(0, 'rgba(6, 182, 212, 0.15)');
  radial1.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = radial1;
  ctx.fillRect(0, 0, width, height);

  const radial2 = ctx.createRadialGradient(100, height - 100, 10, 100, height - 100, 400);
  radial2.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
  radial2.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = radial2;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 24);
  ctx.stroke();
  ctx.restore();

  // Top Badge
  ctx.save();
  ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
  drawRoundedRect(ctx, 60, 56, 320, 36, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, 56, 320, 36, 18);
  ctx.stroke();

  ctx.fillStyle = '#22D3EE';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🛡️ KARRA SYSTEM INTEGRITY CERTIFICATE', 76, 79);
  ctx.restore();

  // Top Right Status
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('● SYSTEM STATUS: OPTIMAL & ACTIVE', width - 60, 79);
  ctx.textAlign = 'left';

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(actualName, 60, 140);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Enterprise Business Operating System Architecture & Ledger Reliability', 60, 170);

  // 6 Metric Panels (3 columns x 2 rows)
  const panels = [
    { label: 'KERNEL ENGINE', value: osData.kernelVersion, desc: 'Enterprise deterministic runtime' },
    { label: 'LEDGER INTEGRITY', value: osData.ledgerEngine, desc: 'Zero-drift balance reconciliation' },
    { label: 'CLOUD PERSISTENCE', value: osData.cloudSyncStatus, desc: 'Google Cloud Firestore mirror' },
    { label: 'AUDITABLE EVENTS', value: `${osData.totalEvents.toLocaleString()} Events`, desc: 'Cryptographically ordered records' },
    { label: 'COST BENCHMARK', value: osData.historicalCostModel, desc: 'Locked purchase-time inventory cost' },
    { label: 'UPTIME & RELIABILITY', value: osData.uptimeIntegrity, desc: `Last verified: ${osData.lastBackupTime}` },
  ];

  const startY = 210;
  const panelW = 340;
  const panelH = 220;

  panels.forEach((p, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 60 + col * (panelW + 25);
    const y = startY + row * (panelH + 24);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    drawRoundedRect(ctx, x, y, panelW, panelH, 18);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x, y, panelW, panelH, 18);
    ctx.stroke();

    ctx.fillStyle = '#22D3EE';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.label, x + 24, y + 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.value, x + 24, y + 80);

    // Accent line
    ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.fillRect(x + 24, y + 105, panelW - 48, 2);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(p.desc, x + 24, y + 145);
    ctx.restore();
  });

  // Footer
  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Karra Quantum Ledger Specification • Fully compliant with Nigerian Merchant Audit Standards', 60, height - 42);

  ctx.textAlign = 'right';
  ctx.fillText('Cloud Architecture v2.4', width - 60, height - 42);
  ctx.textAlign = 'left';

  return canvas;
}

export async function exportOSIntegrityToPNG(
  profile: BusinessProfile,
  osData: OSIntegrityData,
  businessName?: string
): Promise<void> {
  const canvas = renderOSIntegrityCanvas(profile, osData, businessName);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const actualName = businessName || profile.businessName || 'enterprise';
      const cleanName = actualName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karra_operating_system_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export function getOSIntegrityText(
  profile: BusinessProfile,
  osData: OSIntegrityData,
  businessName?: string
): string {
  const actualName = businessName || profile.businessName || 'Karra Enterprise';
  return `⚙️ *${actualName} — Operating System & Architecture Dossier*
_Karra Quantum Business Operating System v2.4_

🛡️ *System Specifications:*
• Kernel Engine: ${osData.kernelVersion}
• Ledger Standard: ${osData.ledgerEngine}
• Cloud Persistence: ${osData.cloudSyncStatus}
• Audited Events: ${osData.totalEvents.toLocaleString()} Immutable Records
• Cost Allocation Model: ${osData.historicalCostModel}
• Integrity & Uptime: ${osData.uptimeIntegrity}
• Last Backup / Verification: ${osData.lastBackupTime}

✅ *Security & Governance:*
• Historical transaction locks active (zero cost-drift)
• Realtime multi-region cloud replication
• Double-entry arithmetic validation on every event

⚡ Enterprise Infrastructure by Karra AI OS`;
}

export async function shareOSIntegrity(
  profile: BusinessProfile,
  osData: OSIntegrityData,
  businessName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard' | 'whatsapp' }> {
  const actualName = businessName || profile.businessName || 'System Architecture';
  const text = getOSIntegrityText(profile, osData, businessName);

  if (navigator.share) {
    try {
      const canvas = renderOSIntegrityCanvas(profile, osData, businessName);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'operating_system.png', { type: 'image/png' })] })) {
        const file = new File([blob], `${actualName}_os_integrity.png`, { type: 'image/png' });
        await navigator.share({
          title: `${actualName} - Operating System Integrity`,
          text: text,
          files: [file],
        });
        return { success: true, method: 'web-share' };
      } else {
        await navigator.share({
          title: `${actualName} - Operating System Integrity`,
          text: text,
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, method: 'web-share' };
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  } catch {
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    return { success: true, method: 'whatsapp' };
  }
}

/**
 * ============================================================================
 * ASSETS & TREASURY PORTFOLIO CARD GENERATOR
 * ============================================================================
 */
export interface AssetsPortfolioData {
  totalInventoryValue: number;
  totalProductsTracked: number;
  liquidCashPosition: number;
  receivablesValue: number;
  activeDebtorsCount: number;
  totalEnterpriseAssets: number;
  baseCurrency: string;
  auditDate: string;
  timeframeLabel?: string;
}

export function renderAssetsPortfolioCanvas(
  profile: BusinessProfile,
  data: AssetsPortfolioData,
  businessName?: string
): HTMLCanvasElement {
  const width = 1200;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const actualName = businessName || profile.businessName || 'Karra Enterprise';

  // Deep royal executive slate & emerald gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#061019');
  bgGrad.addColorStop(0.5, '#0B1924');
  bgGrad.addColorStop(1, '#060E18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Ambient gold & emerald aura
  const radial1 = ctx.createRadialGradient(width - 80, 80, 20, width - 80, 80, 480);
  radial1.addColorStop(0, 'rgba(234, 179, 8, 0.15)');
  radial1.addColorStop(1, 'rgba(234, 179, 8, 0)');
  ctx.fillStyle = radial1;
  ctx.fillRect(0, 0, width, height);

  const radial2 = ctx.createRadialGradient(80, height - 80, 20, 80, height - 80, 400);
  radial2.addColorStop(0, 'rgba(16, 185, 129, 0.16)');
  radial2.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = radial2;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.save();
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, width - 48, height - 48, 24);
  ctx.stroke();
  ctx.restore();

  // Top Badge
  ctx.save();
  ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
  drawRoundedRect(ctx, 60, 56, 320, 36, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, 56, 320, 36, 18);
  ctx.stroke();

  ctx.fillStyle = '#FACC15';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('🏛️ TREASURY & ASSET VALUATION', 76, 79);
  ctx.restore();

  // Top Right Audit Stamp
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  const stampText = data.timeframeLabel ? `Audited: ${data.auditDate} (${data.timeframeLabel})` : `Audited: ${data.auditDate}`;
  ctx.fillText(stampText, width - 60, 79);
  ctx.textAlign = 'left';

  // Company Name
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(actualName, 60, 140);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Consolidated Enterprise Assets, Commodity Inventory & Liquid Reserves', 60, 170);

  // Hero Big Metric Banner: Total Net Enterprise Assets
  ctx.save();
  const heroGrad = ctx.createLinearGradient(60, 205, width - 120, 205);
  heroGrad.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
  heroGrad.addColorStop(1, 'rgba(6, 182, 212, 0.12)');
  ctx.fillStyle = heroGrad;
  drawRoundedRect(ctx, 60, 205, width - 120, 130, 20);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, 60, 205, width - 120, 130, 20);
  ctx.stroke();

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CONSOLIDATED NET ENTERPRISE ASSET VALUE (ESTIMATED)', 85, 238);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px "SF Pro Display", -apple-system, sans-serif';
  ctx.fillText(formatNaira(data.totalEnterpriseAssets), 85, 298);

  ctx.fillStyle = '#6EE7B7';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('⚡ 100% ASSET BACKED', width - 90, 240);
  ctx.fillStyle = '#94A3B8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Reconciled across liquid + commodity inventory + receivables', width - 90, 290);
  ctx.textAlign = 'left';
  ctx.restore();

  // 3 Asset Pillars
  const pillars = [
    {
      title: 'COMMODITY & INVENTORY',
      amount: formatNaira(data.totalInventoryValue),
      detail: `${data.totalProductsTracked} core commodity lines tracked`,
      color: '#34D399',
    },
    {
      title: 'LIQUID CASH & BANK HOLDINGS',
      amount: formatNaira(data.liquidCashPosition),
      detail: `${profile.bankDetails?.bankName || 'Treasury'} settlement account`,
      color: '#60A5FA',
    },
    {
      title: 'RECEIVABLES PORTFOLIO',
      amount: formatNaira(data.receivablesValue),
      detail: `${data.activeDebtorsCount} verified commercial credit accounts`,
      color: '#FBBF24',
    },
  ];

  const pillarW = 340;
  const pillarH = 270;
  const pillarY = 360;

  pillars.forEach((pil, idx) => {
    const x = 60 + idx * (pillarW + 25);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    drawRoundedRect(ctx, x, pillarY, pillarW, pillarH, 18);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, x, pillarY, pillarW, pillarH, 18);
    ctx.stroke();

    ctx.fillStyle = pil.color;
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(pil.title, x + 24, pillarY + 40);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(pil.amount, x + 24, pillarY + 95);

    // Divider
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 24, pillarY + 125, pillarW - 48, 1);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(pil.detail, x + 24, pillarY + 160);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Verified with zero inventory drift', x + 24, pillarY + 195);
    ctx.restore();
  });

  // Footer
  ctx.fillStyle = '#64748B';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Corporate Treasury Division • Karra Enterprise Financial Engine', 60, height - 42);

  ctx.textAlign = 'right';
  ctx.fillText('Official Asset Statement', width - 60, height - 42);
  ctx.textAlign = 'left';

  return canvas;
}

export async function exportAssetsPortfolioToPNG(
  profile: BusinessProfile,
  data: AssetsPortfolioData,
  businessName?: string
): Promise<void> {
  const canvas = renderAssetsPortfolioCanvas(profile, data, businessName);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const actualName = businessName || profile.businessName || 'enterprise';
      const cleanName = actualName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karra_treasury_assets_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

export function getAssetsPortfolioText(
  profile: BusinessProfile,
  data: AssetsPortfolioData,
  businessName?: string
): string {
  const actualName = businessName || profile.businessName || 'Karra Enterprise';
  return `🏛️ *${actualName} — Corporate Treasury & Asset Valuation Statement*
_Audited Statement as of ${data.auditDate}${data.timeframeLabel ? ` (${data.timeframeLabel})` : ''}_

💎 *Total Consolidated Enterprise Assets:*
*${formatNaira(data.totalEnterpriseAssets)}*

📊 *Asset Breakdown:*
• 📦 Commodity & Inventory Assets: ${formatNaira(data.totalInventoryValue)} (${data.totalProductsTracked} product lines)
• 💵 Liquid Capital & Bank Reserves: ${formatNaira(data.liquidCashPosition)} (${profile.bankDetails?.bankName || 'Settlement Bank'})
• 📑 Accounts Receivable Portfolio: ${formatNaira(data.receivablesValue)} (${data.activeDebtorsCount} commercial credit clients)

🏦 *Settlement Repository:*
Bank: ${profile.bankDetails?.bankName || 'N/A'}
Account: ${profile.bankDetails?.accountNumber || 'N/A'}
Beneficiary: ${profile.bankDetails?.accountName || actualName}

⚡ Authenticated by Karra Enterprise Financial Engine`;
}

export async function shareAssetsPortfolio(
  profile: BusinessProfile,
  data: AssetsPortfolioData,
  businessName?: string
): Promise<{ success: boolean; method: 'web-share' | 'clipboard' | 'whatsapp' }> {
  const actualName = businessName || profile.businessName || 'Treasury Assets';
  const text = getAssetsPortfolioText(profile, data, businessName);

  if (navigator.share) {
    try {
      const canvas = renderAssetsPortfolioCanvas(profile, data, businessName);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'assets_portfolio.png', { type: 'image/png' })] })) {
        const file = new File([blob], `${actualName}_treasury_assets.png`, { type: 'image/png' });
        await navigator.share({
          title: `${actualName} - Treasury & Assets`,
          text: text,
          files: [file],
        });
        return { success: true, method: 'web-share' };
      } else {
        await navigator.share({
          title: `${actualName} - Treasury & Assets`,
          text: text,
        });
        return { success: true, method: 'web-share' };
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return { success: false, method: 'web-share' };
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  } catch {
    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    return { success: true, method: 'whatsapp' };
  }
}
