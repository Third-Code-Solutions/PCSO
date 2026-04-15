/**
 * Formatting utilities used across modules.
 * Money amounts are stored as strings (numeric in Postgres) — format at the UI boundary.
 */

export function formatPeso(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '₱0.00';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '₱0.00';
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString('en-PH');
}

export function formatDate(value: string | Date | null | undefined, fmt: 'short' | 'long' = 'short'): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  if (fmt === 'long') {
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fullName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
}): string {
  const { firstName, middleName, lastName, suffix } = parts;
  const mi = middleName ? `${middleName.charAt(0)}.` : '';
  const s = suffix ? `, ${suffix}` : '';
  return [firstName, mi, lastName].filter(Boolean).join(' ').trim() + s;
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  return `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase() || '??';
}
