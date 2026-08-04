/**
 * Nepal (Asia/Kathmandu) date helpers for reports/dashboard filters.
 */

export function nepalDateString(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatNepalDisplay(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(`${dateStr}T12:00:00+05:45`);
    return d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kathmandu',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatNepalDateTime(value) {
  if (!value) return '—';
  const raw = String(value).includes('T') || String(value).includes(' ')
    ? value
    : `${value}T00:00:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Resolve a report/dashboard period into { start, end, label }.
 * start/end are YYYY-MM-DD in Nepal calendar.
 */
export function resolvePeriodRange(period = 'today', startDate = null, endDate = null) {
  const today = nepalDateString(new Date());

  if (period === 'custom' && startDate && endDate) {
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;
    return {
      start,
      end,
      label: `${formatNepalDisplay(start)} – ${formatNepalDisplay(end)}`,
      period: 'custom',
    };
  }

  if (period === 'week') {
    // Last 7 days including today
    const end = new Date(`${today}T12:00:00+05:45`);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startStr = nepalDateString(start);
    return {
      start: startStr,
      end: today,
      label: `This week · ${formatNepalDisplay(startStr)} – ${formatNepalDisplay(today)}`,
      period: 'week',
    };
  }

  if (period === 'month') {
    // Calendar month in Nepal
    const [y, m] = today.split('-').map(Number);
    const startStr = `${y}-${String(m).padStart(2, '0')}-01`;
    return {
      start: startStr,
      end: today,
      label: `This month · ${formatNepalDisplay(startStr)} – ${formatNepalDisplay(today)}`,
      period: 'month',
    };
  }

  // today (default)
  return {
    start: today,
    end: today,
    label: `Today · ${formatNepalDisplay(today)}`,
    period: 'today',
  };
}

/** SQL DATE() comparison params for a range (inclusive). */
export function dateParams(range) {
  return [range.start, range.end];
}
