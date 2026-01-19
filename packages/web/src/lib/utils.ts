import { parseISO, isToday, isPast, startOfDay, differenceInDays } from 'date-fns';

export function formatTime(time: string | null): string {
  if (!time) return '';
  return time;
}

export function isOverdue(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isPast(startOfDay(d)) && !isToday(d);
}

export function isExpired(date: string | Date | null): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isPast(startOfDay(d));
}

export function isExpiringSoon(date: string | Date | null, days: number = 7): boolean {
  if (!date) return false;
  const d = typeof date === 'string' ? parseISO(date) : date;
  const daysUntil = differenceInDays(startOfDay(d), startOfDay(new Date()));
  return daysUntil >= 0 && daysUntil <= days;
}

export function daysUntilExpiry(date: string | Date | null): number | null {
  if (!date) return null;
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(startOfDay(d), startOfDay(new Date()));
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Unit conversion definitions for smart display
const UNIT_CONVERSIONS: Record<string, { smallerUnit: string; factor: number; threshold: number }> = {
  'kg': { smallerUnit: 'g', factor: 1000, threshold: 1 },    // < 1 kg -> show in g
  'l': { smallerUnit: 'ml', factor: 1000, threshold: 1 },    // < 1 l -> show in ml
  'L': { smallerUnit: 'ml', factor: 1000, threshold: 1 },
};

export function formatQuantity(quantity: number, unit: string, smartConvert: boolean = true): string {
  // Check if we should convert to a smaller unit for better readability
  if (smartConvert && quantity > 0 && quantity < 1) {
    const conversion = UNIT_CONVERSIONS[unit];
    if (conversion && quantity < conversion.threshold) {
      const convertedQuantity = quantity * conversion.factor;
      const rounded = Math.round(convertedQuantity * 100) / 100;
      // Only use smaller unit if the result is a nice number (not too many decimals)
      if (rounded === Math.round(rounded) || rounded === Math.round(rounded * 10) / 10) {
        return `${rounded} ${conversion.smallerUnit}`;
      }
    }
  }

  // Round to reasonable precision
  const rounded = Math.round(quantity * 100) / 100;
  return `${rounded} ${unit}`;
}

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(amount);
}
