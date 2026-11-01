/**
 * End-to-end smoke tests of the public portal (search, filters, citations, restricted and hidden records) and the
 * staff workspace (drafting a description, the liaison's limited menu, and the researcher's landing page).
 *
 * @author Kwasi Adabo Boakye
 */

import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Public portal smoke', () => {
  test('visitor searches, filters and opens a public description with a citation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Explore the archives/ })).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/public-home.png', fullPage: true });
    await page.locator('#hero-q').fill('Council');
    await page.getByRole('button', { name: 'Search', exact: true }).first().click();
    await expect(page).toHaveURL(/\/search\?q=Council/);
    const result = page.getByRole('link', { name: /Council minutes/ }).first();
    await expect(result).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/public-search.png', fullPage: true });
    await result.click();
    await expect(page.getByText('Cite this')).toBeVisible();
    await expect(page.getByText(/UGA\/DEMO-REG\/GOV/).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/public-record.png', fullPage: true });
  });

  test('restricted descriptions show metadata only and offer an access request', async ({ page }) => {
    await page.goto('/search?q=Student%20files');
    await page
      .getByRole('link', { name: /Student files and admissions/ })
      .first()
      .click();
    await expect(page.getByText('Access to this material is restricted')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request access' })).toBeVisible();
    await expect(page.getByText('Scope and content')).toHaveCount(0);
  });

  test('unknown or hidden records return a not-found page', async ({ page }) => {
    await page.goto('/records/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/Not found/)).toBeVisible();
  });
});

test.describe('Staff workspace', () => {
  test('archivist creates a draft description and sees required fields before review', async ({ page }) => {
    await login(page, 'archivist@ugarms.local');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/dashboard.png', fullPage: true });
    await page.goto('/admin/records/new');
    const id = `E2E${Date.now().toString(36)}`;
    await page.getByLabel(/Local identifier/).fill(id);
    await page.getByLabel(/^Title/).fill(`End-to-end test fonds ${id}`);
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('heading', { name: `End-to-end test fonds ${id}` })).toBeVisible();
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await expect(page.getByText(/Missing:/)).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/record-detail.png', fullPage: true });
  });

  test('departmental liaison sees only transfer features', async ({ page }) => {
    await login(page, 'liaison.history@ugarms.local');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Transfer submissions' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
    await page.goto('/admin/users');
    await expect(page.getByText('Access not permitted')).toBeVisible();
  });

  test('researcher signs in and lands on their research area', async ({ page }) => {
    await login(page, 'researcher@ugarms.local');
    await expect(page).toHaveURL(/\/my/);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  });
});
