/**
 * Display formatting of dates, times, numbers, money, sizes and codes.
 *
 * Formatting follows the institution's configured locale and time zone (by default en-GH, Africa/Accra and the
 * Ghana cedi). Calendar dates are shown without time-zone shifting. Archival date expressions are free text and are
 * always shown exactly as catalogued, never through these functions.
 *
 * @author Kwasi Adabo Boakye
 */

let cfg = { locale: 'en-GH', timeZone: 'Africa/Accra', currency: 'GHS' };
let dtf;
let dttf;

/**
 * Rebuilds the cached date formatters for the current configuration, falling back to en-GB and UTC if the browser
 * does not support the configured locale or time zone.
 */
function build() {
  /**
   * Runs a formatter factory, retrying with en-GB and UTC if the configured locale or time zone is not supported.
   *
   * @param {() => Intl.DateTimeFormat} fn The factory.
   * @returns {Intl.DateTimeFormat}
   */
  const safe = (fn) => {
    try {
      return fn();
    } catch {
      cfg = { ...cfg, locale: 'en-GB', timeZone: 'UTC' };
      return fn();
    }
  };
  dtf = safe(
    () =>
      new Intl.DateTimeFormat(cfg.locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: cfg.timeZone }),
  );
  dttf = safe(
    () =>
      new Intl.DateTimeFormat(cfg.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: cfg.timeZone,
      }),
  );
}
build();

/**
 * Sets the locale, time zone and currency used for display, typically from the institution settings.
 *
 * @param {{ locale?: string, timeZone?: string, currency?: string }} [options]
 */
export function configureFormatting({ locale, timeZone, currency } = {}) {
  cfg = { locale: locale || cfg.locale, timeZone: timeZone || cfg.timeZone, currency: currency || cfg.currency };
  build();
}

/**
 * Returns a copy of the current formatting configuration.
 *
 * @returns {{ locale: string, timeZone: string, currency: string }}
 */
export const formattingConfig = () => ({ ...cfg });

// Calendar-only values (YYYY-MM-DD) are formatted without time-zone shifting.

/**
 * Formats a date, or a YYYY-MM-DD calendar date without shifting it to another day.
 *
 * @param {string|Date|null} v The date.
 * @returns {string} The formatted date, or a dash when empty.
 */
export const fmtDate = (v) => {
  if (!v) return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v))
    return new Intl.DateTimeFormat(cfg.locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${v}T00:00:00Z`));
  return dtf.format(new Date(v));
};

/**
 * Formats a date and time in the institution's time zone.
 *
 * @param {string|Date|null} v The timestamp.
 * @returns {string}
 */
export const fmtDateTime = (v) => (v ? dttf.format(new Date(v)) : '—');

/**
 * Formats a number with the locale's digit grouping.
 *
 * @param {number|null} v The number.
 * @returns {string}
 */
export const fmtNumber = (v) => (v === null || v === undefined ? '—' : new Intl.NumberFormat(cfg.locale).format(v));

/**
 * Formats an amount of money in the given or configured currency.
 *
 * @param {number|string|null} v The amount.
 * @param {string} [currency] ISO currency code.
 * @returns {string}
 */
export const fmtMoney = (v, currency = cfg.currency) =>
  v === null || v === undefined
    ? '—'
    : new Intl.NumberFormat(cfg.locale, { style: 'currency', currency }).format(Number(v));

/**
 * Turns a code such as "partially_accepted" or "accessLevel" into readable text such as "Partially accepted".
 *
 * @param {string|null} s The code.
 * @returns {string}
 */
export const humanize = (s) =>
  s
    ? String(s)
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_.]/g, ' ')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : '—';

/**
 * Formats a size in bytes using B, KB, MB, GB or TB.
 *
 * @param {number|string} n Size in bytes.
 * @returns {string}
 */
export function fmtBytes(n) {
  const v = Number(n);
  if (!v) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
  return `${(v / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}

/**
 * Formats a time relative to now ("just now", "5 minutes ago", "3 days ago"), switching to the date after 30 days.
 *
 * @param {string|Date|null} v The time.
 * @returns {string}
 */
export const relative = (v) => {
  if (!v) return '—';
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  const r = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(diff) < 60) return 'just now';
  if (Math.abs(diff) < 3600) return r.format(-Math.round(diff / 60), 'minute');
  if (Math.abs(diff) < 86400) return r.format(-Math.round(diff / 3600), 'hour');
  if (Math.abs(diff) < 86400 * 30) return r.format(-Math.round(diff / 86400), 'day');
  return fmtDate(v);
};
