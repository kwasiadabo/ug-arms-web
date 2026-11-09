/**
 * Default identifiers for new transfer inventory lines.
 *
 * @author Kwasi Adabo Boakye
 */

/**
 * Turns a unit code into an identifier prefix: upper case, letters, digits, dots and hyphens only, "ITEM" when the
 * unit has no usable code.
 *
 * @param {string} [unitCode] Code of the originating unit, for example "HIST".
 * @returns {string}
 */
export const identifierPrefix = (unitCode) =>
  String(unitCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9.-]+/g, '') || 'ITEM';

/**
 * Suggests the next identifier in a unit's sequence, such as HIST/003. Numbering continues after the highest number
 * already used with that prefix, so deleted lines are not reused, and an identifier typed by hand is never repeated
 * (identifiers must be unique within the inventory, ignoring case). The user can change the suggestion.
 *
 * @param {string} prefix Identifier prefix from `identifierPrefix`.
 * @param {Array<string|null|undefined>} existing Identifiers already in the inventory.
 * @returns {string}
 */
export function nextIdentifier(prefix, existing) {
  const values = existing.map((v) => String(v ?? '').trim()).filter(Boolean);
  const taken = new Set(values.map((v) => v.toLowerCase()));
  const pattern = new RegExp(`^${prefix.replace(/[.-]/g, '\\$&')}/(\\d+)$`, 'i');
  let n = Math.max(0, ...values.map((v) => Number(pattern.exec(v)?.[1] ?? 0)));
  let id;
  do {
    n += 1;
    id = `${prefix}/${String(n).padStart(3, '0')}`;
  } while (taken.has(id.toLowerCase()));
  return id;
}
