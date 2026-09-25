/**
 * Date utility helpers for Karra
 * Ensures the platform is always synchronized with the current calendar date
 * and relative dates (Today, Yesterday, etc.).
 */

export function getTodayDateStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysAgoDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayDateStr();
}

export function isYesterday(dateStr: string): boolean {
  return dateStr === getYesterdayDateStr();
}

export function getDateBadgeLabel(dateStr: string): string {
  if (isToday(dateStr)) return 'Today';
  if (isYesterday(dateStr)) return 'Yesterday';
  return formatDateShort(dateStr);
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatDateFull(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length < 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Extracts a target date string (YYYY-MM-DD) from user text, or null if no relative/explicit date found.
 */
export function extractDateFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  if (lower.includes('yesterday')) {
    return getYesterdayDateStr();
  }
  if (lower.includes('today')) {
    return getTodayDateStr();
  }

  // e.g. "2 days ago", "3 days ago"
  const daysAgoMatch = lower.match(/([0-9]+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    if (!isNaN(days) && days > 0) {
      return getDaysAgoDateStr(days);
    }
  }

  // Explicit ISO date e.g. "2026-09-20"
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // e.g. "Sept 20", "September 20", "20th Sept"
  const months: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  const monthNamePattern = Object.keys(months).join('|');
  const monthDayRegex = new RegExp(`(?:on\\s+)?(${monthNamePattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i');
  const match1 = lower.match(monthDayRegex);
  if (match1) {
    const m = months[match1[1].toLowerCase()];
    const d = String(parseInt(match1[2], 10)).padStart(2, '0');
    const year = new Date().getFullYear();
    return `${year}-${m}-${d}`;
  }

  const dayMonthRegex = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthNamePattern})`, 'i');
  const match2 = lower.match(dayMonthRegex);
  if (match2) {
    const d = String(parseInt(match2[1], 10)).padStart(2, '0');
    const m = months[match2[2].toLowerCase()];
    const year = new Date().getFullYear();
    return `${year}-${m}-${d}`;
  }

  return null;
}
