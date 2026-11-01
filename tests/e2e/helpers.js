/**
 * Shared helpers for the Playwright journeys and the user-guide screenshot script.
 *
 * @author Kwasi Adabo Boakye
 */

import fs from 'node:fs';

export const PASSWORD = process.env.E2E_PASSWORD || 'ChangeMe!2026';

/**
 * Signs in through the sign-in page and waits for the staff dashboard or the researcher area.
 *
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {string} email Demonstration account.
 * @returns {Promise<void>}
 */
export async function login(page, email) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(admin|my)/);
}

/**
 * Calculates the standard CRC-32 of a buffer, as used for PNG chunk checksums.
 *
 * @param {Buffer} buf The data.
 * @returns {number} The checksum as an unsigned 32-bit integer.
 */
export function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/**
 * Returns the fictional test page image with a PNG text chunk (with a correct checksum) inserted after the header.
 * The picture is unchanged, but the file content is unique, so duplicate detection treats each upload as new.
 *
 * @param {string} tag Text that makes the file unique.
 * @returns {Buffer} The PNG file.
 */
export function uniquePagePng(tag) {
  const base = fs.readFileSync(new URL('./fixtures/test-page.png', import.meta.url));
  const body = Buffer.concat([Buffer.from('tEXt'), Buffer.from(`Comment\0${tag}`)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length - 4);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([base.subarray(0, 33), len, body, crc, base.subarray(33)]);
}
