/**
 * Checks on a single transfer inventory line, matching the server's inventory validation, so a line added in the
 * form is not refused later when the inventory is saved.
 *
 * @author Kwasi Adabo Boakye
 */

/**
 * Reads a date in one of the accepted forms (YYYY, YYYY-MM-DD, DD/MM/YYYY; dots or hyphens may replace the slashes).
 *
 * @param {string} v Date as typed.
 * @returns {string|null|undefined} The ISO date, null when empty, undefined when not a valid date.
 */
export function parseLineDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.isNaN(Date.parse(s)) ? undefined : s;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return Number.isNaN(Date.parse(iso)) ? undefined : iso;
  }
  return undefined;
}

/**
 * Checks one inventory line: a title is required, dates must be in an accepted form with the end not before the
 * start, the quantity must be a positive whole number, and the identifier must not already be used by another line
 * (ignoring case).
 *
 * @param {Record<string, string>} line The line's values.
 * @param {string[]} otherIdentifiers Identifiers of the other lines in the inventory.
 * @returns {Record<string, string>} Error message by field; empty when the line is valid.
 */
export function validateLine(line, otherIdentifiers) {
  const errors = {};
  if (!String(line.title ?? '').trim()) errors.title = 'Enter a title';
  const start = parseLineDate(line.dateStart);
  const end = parseLineDate(line.dateEnd);
  if (start === undefined) errors.dateStart = 'Use YYYY, YYYY-MM-DD or DD/MM/YYYY';
  if (end === undefined) errors.dateEnd = 'Use YYYY, YYYY-MM-DD or DD/MM/YYYY';
  if (start && end && start > end) errors.dateEnd = 'The end date is before the start date';
  const qty = String(line.quantity ?? '').trim();
  if (qty && !(Number.isInteger(Number(qty)) && Number(qty) > 0))
    errors.quantity = 'Enter a positive whole number, or leave it empty for 1';
  const id = String(line.sourceIdentifier ?? '')
    .trim()
    .toLowerCase();
  if (
    id &&
    otherIdentifiers.some(
      (o) =>
        String(o ?? '')
          .trim()
          .toLowerCase() === id,
    )
  )
    errors.sourceIdentifier = 'Another line already uses this identifier';
  return errors;
}
