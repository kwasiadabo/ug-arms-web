/**
 * Captures the screenshots used in the role workflows guide (docs/user-guide/screenshots) by playing one connected,
 * fictional scenario through the real user interface.
 *
 * Requires the development stack with freshly reset demonstration data (`npm run db:reset` in the backend), the
 * worker and ClamAV running. Run with `node scripts/capture-user-guide.mjs`. Environment: GUIDE_BASE_URL (default
 * http://127.0.0.1:5190), E2E_PASSWORD (the demonstration password) and GUIDE_ADMIN_NEW_PASSWORD (the password set
 * during the administrator's forced change). A failed step is reported and the run continues with the next one.
 *
 * @author Kwasi Adabo Boakye
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium, request as pwRequest } from '@playwright/test';
import { uniquePagePng } from '../tests/e2e/helpers.js';

const BASE = process.env.GUIDE_BASE_URL || 'http://127.0.0.1:5190';
const API = `${BASE}/api/v1`;
const PASSWORD = process.env.E2E_PASSWORD || 'ChangeMe!2026';
const ADMIN_NEW = process.env.GUIDE_ADMIN_NEW_PASSWORD || 'UgArms-Admin-2026!';
const OUT = path.resolve(new URL('.', import.meta.url).pathname, '../../docs/user-guide/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await context.newPage();

// ---------------------------------------------------------------- helpers

/**
 * Waits for network activity to finish and animations to settle before a screenshot.
 *
 * @returns {Promise<void>}
 */
async function settle() {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
}

/**
 * Takes a screenshot of the viewport, outlining the given elements in crest gold to show where to click. Toast
 * notifications are hidden so they do not cover the screen being explained.
 *
 * @param {string} name File name, without extension.
 * @param {import('@playwright/test').Locator|import('@playwright/test').Locator[]} [highlight=[]] Elements to
 *   outline.
 * @param {{ fullPage?: boolean, scrollTop?: boolean }} [opts={}] Capture options.
 * @returns {Promise<void>}
 */
async function snap(name, highlight = [], opts = {}) {
  await settle();
  const marks = [];
  for (const loc of [].concat(highlight)) {
    const handle = await loc
      .first()
      .elementHandle({ timeout: 5000 })
      .catch(() => null);
    if (!handle) continue;
    await handle.scrollIntoViewIfNeeded().catch(() => {});
    await handle.evaluate((el) => {
      el.dataset.guidePrev = el.getAttribute('style') || '';
      el.style.outline = '3px solid #dfb725';
      el.style.outlineOffset = '3px';
      el.style.borderRadius ||= '8px';
    });
    marks.push(handle);
  }
  if (opts.scrollTop) await page.evaluate(() => window.scrollTo(0, 0));
  // Hide toast notifications so they do not cover the screen being explained.
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' }).catch(() => {});
  await page.screenshot({
    path: path.join(OUT, `${name}.jpg`),
    type: 'jpeg',
    quality: 82,
    fullPage: Boolean(opts.fullPage),
  });
  for (const h of marks) await h.evaluate((el) => el.setAttribute('style', el.dataset.guidePrev)).catch(() => {});
  results.push(name);
  console.log('captured', name);
}

/**
 * Runs one step of the scenario, reporting a failure and continuing instead of stopping the whole capture.
 *
 * @param {string} label Description of the step.
 * @param {() => Promise<void>} fn The step.
 * @returns {Promise<void>}
 */
async function step(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`STEP FAILED: ${label}\n  ${err.message.split('\n')[0]}`);
    results.push(`FAILED:${label}`);
  }
}

/**
 * Signs in through the sign-in page as the given account.
 *
 * @param {string} email Account.
 * @param {string} [password=PASSWORD] Password.
 * @returns {Promise<void>}
 */
async function login(email, password = PASSWORD) {
  await context.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(admin|my)/);
  await settle();
}

/**
 * Clicks a confirm button in the open dialog and waits for the write request it sends, retrying the click once if
 * no request was sent. Throws when the request fails.
 *
 * @param {string|RegExp} name Label of the button.
 * @param {import('@playwright/test').Locator} [scope] Dialog to search in.
 * @returns {Promise<void>}
 */
async function confirm(name, scope = page.getByRole('dialog')) {
  const button = scope.getByRole('button', { name, exact: typeof name === 'string' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const write = page
      .waitForResponse((r) => r.url().includes('/api/v1/') && ['POST', 'PUT', 'PATCH'].includes(r.request().method()), {
        timeout: 8000,
      })
      .catch(() => null);
    await button.click();
    const res = await write;
    if (res) {
      if (res.status() >= 400) throw new Error(`${name} failed: ${res.status()} ${await res.text()}`);
      await page
        .getByRole('dialog')
        .waitFor({ state: 'detached', timeout: 10_000 })
        .catch(() => {});
      await settle();
      return;
    }
  }
  throw new Error(`${name}: no request was sent`);
}

/**
 * Clicks an action button, optionally fills in the dialog that opens, and confirms it.
 *
 * @param {string} name Label of the action button.
 * @param {string} [confirmName=name] Label of the confirm button.
 * @param {(dialog: import('@playwright/test').Locator) => Promise<void>} [before] Fills in the dialog before
 *   confirming.
 * @returns {Promise<void>}
 */
async function act(name, confirmName = name, before) {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (before) await before(dialog);
  await confirm(confirmName, dialog);
}

/**
 * Signs in through the API and returns a client that sends the CSRF header, for setting up data the scenario needs.
 *
 * @param {string} email Account.
 * @param {string} [password=PASSWORD] Password.
 * @returns {Promise<{ get: Function, post: Function, patch: Function, put: Function }>}
 */
async function apiAs(email, password = PASSWORD) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`API login failed for ${email}: ${res.status()}`);
  const csrf = (await ctx.storageState()).cookies.find((c) => c.name === 'ugarms_csrf').value;

  /**
   * Sends one API request with the CSRF header and returns the parsed JSON body, if any.
   *
   * @param {string} method HTTP method.
   * @param {string} p API path.
   * @param {*} [data] Request body.
   * @returns {Promise<object|null>}
   */
  const call = async (method, p, data) => {
    const r = await ctx.fetch(`${API}${p}`, { method, data, headers: { 'X-CSRF-Token': csrf } });
    return r.headers()['content-type']?.includes('json') ? r.json() : null;
  };
  return {
    get: (p) => call('GET', p),
    post: (p, d) => call('POST', p, d),
    patch: (p, d) => call('PATCH', p, d),
    put: (p, d) => call('PUT', p, d),
  };
}

/**
 * Finds a description by its exact reference code.
 *
 * @param {object} api Client from `apiAs`.
 * @param {string} ref Reference code.
 * @returns {Promise<object|undefined>}
 */
const byRef = async (api, ref) =>
  (await api.get(`/records?q=${encodeURIComponent(ref)}&pageSize=10`)).data.find((r) => r.referenceCode === ref);

const S = {}; // scenario state shared between actors

// ================================================================ 1. Public visitor
await step('visitor', async () => {
  await context.clearCookies();
  await page.goto(BASE);
  await snap('visitor-01-home', page.locator('form').filter({ has: page.locator('#hero-q') }));
  await page.locator('#hero-q').fill('council');
  await page.locator('#hero-q').press('Enter');
  await snap('visitor-02-results', page.getByRole('complementary', { name: 'Filters' }));
  await page.goto(`${BASE}/collections`);
  await snap('visitor-03-collections');
  const api = await apiAs('chief.archivist@ugarms.local');
  S.cong = await byRef(api, 'UGA/DEMO-PHOTO/CONG');
  S.stu = await byRef(api, 'UGA/DEMO-REG/STU');
  S.reg = await byRef(api, 'UGA/DEMO-REG');
  await page.goto(`${BASE}/records/${S.cong.id}`);
  await snap('visitor-04-record', [page.getByText('Cite this').locator('..')]);
  await page.goto(`${BASE}/records/${S.reg.id}/finding-aid`);
  await snap('visitor-05-finding-aid');
  await page.goto(`${BASE}/records/${S.stu.id}`);
  await snap('visitor-06-restricted', [
    page.getByText('Access to this material is restricted').locator('..'),
    page.getByRole('link', { name: 'Request access' }),
  ]);
  await page.goto(`${BASE}/request?type=enquiry`);
  await snap('visitor-07-enquiry');
});

// ================================================================ 2. Researcher: register, sign in, request access
await step('researcher-request', async () => {
  await context.clearCookies();
  await page.goto(`${BASE}/register`);
  await snap('researcher-01-register');
  await login('researcher@ugarms.local');
  await snap('researcher-02-my-research');
  await page.goto(`${BASE}/records/${S.stu.id}`);
  await page.getByRole('link', { name: 'Request access' }).click();
  await page
    .getByLabel(/Research purpose/)
    .fill('Doctoral research on the history of admissions policy at the University, 1948–1995 (demonstration).');
  await page.getByLabel(/I acknowledge the access conditions/).check();
  await snap('researcher-03-request-form', [
    page.getByLabel(/I acknowledge the access conditions/).locator('xpath=ancestor::label[1]'),
    page.getByRole('button', { name: 'Submit request' }),
  ]);
  await page.getByRole('button', { name: 'Submit request' }).click();
  await settle();
  await snap('researcher-04-request-received');
  await page.getByRole('button', { name: 'Track this request' }).click();
  await settle();
  S.requestId = page.url().split('/').pop();
  await snap('researcher-05-request-tracking');
});

// ================================================================ 3. Departmental records liaison: prepare and submit a transfer
await step('liaison', async () => {
  await login('liaison.history@ugarms.local');
  await snap('liaison-01-dashboard', page.getByRole('navigation', { name: 'Main' }));
  await page.goto(`${BASE}/admin/transfers`);
  await page.getByRole('button', { name: 'New transfer' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(/^Title/).fill('Department of History committee minutes, 1990–2000');
  const unit = dlg.getByLabel(/Originating unit/);
  if (await unit.isEnabled()) await unit.selectOption({ label: 'Department of History' }).catch(() => {});
  await dlg.getByLabel('Proposed transfer date').fill('2026-12-01');
  await dlg.getByLabel('Transfer authority').fill('Head of Department memo (demonstration)');
  await snap('liaison-02-new-transfer', dlg);
  await dlg.getByRole('button', { name: 'Create draft' }).click();
  await settle();
  S.transferId = page.url().split('/').pop();
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Title / description line 1').fill('Departmental committee minutes, bound volumes');
  await page.getByLabel('Identifier line 1').fill('HIST/COM/1');
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Title / description line 2').fill('Correspondence with the Registrar');
  await page.getByLabel('Identifier line 2').fill('HIST/COR/4');
  await page.getByRole('button', { name: 'Save inventory' }).click();
  await settle();
  await snap('liaison-03-inventory', page.getByRole('button', { name: 'Submit to the Archives' }));
  await page.getByRole('button', { name: 'Submit to the Archives', exact: true }).click();
  await snap('liaison-04-submit-confirm', page.getByRole('dialog'));
  await confirm('Submit to the Archives');
  await snap('liaison-05-submitted', page.getByText('Submitted', { exact: true }).first());
});

// ================================================================ 4. Records officer: review the transfer, create the accession
await step('records-officer', async () => {
  await login('records.officer@ugarms.local');
  await snap('officer-01-dashboard');
  await page.goto(`${BASE}/admin/transfers`);
  await snap('officer-02-transfer-queue', page.getByRole('row').filter({ hasText: 'committee minutes' }));
  await page.goto(`${BASE}/admin/transfers/${S.transferId}`);
  await act('Start review');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await snap('officer-03-decision', page.getByRole('dialog'));
  await confirm('Accept all');
  await snap('officer-04-accepted', page.getByRole('button', { name: 'Create accession' }));
  await page.getByRole('button', { name: 'Create accession' }).click();
  await page.waitForURL(/\/admin\/accessions\//);
  S.accessionId = page.url().split('/').pop();
  await snap('officer-05-accession');
  await page.goto(`${BASE}/admin/appraisal`);
  await snap('officer-06-appraisal');
  await page.goto(`${BASE}/admin/retention`);
  await snap('officer-07-retention');
});

// ================================================================ 5. Archivist: complete accession, catalogue, upload, research request decision
await step('archivist-accession', async () => {
  const api = await apiAs('archivist@ugarms.local');
  await api.patch(`/accessions/${S.accessionId}`, {
    physicalCondition: 'Good; bound volumes',
    provenance: 'Department of History, University of Ghana (demonstration)',
    rightsStatement: 'University of Ghana',
    accessionDate: '2026-10-27',
    extent: '2 boxes',
  });
  await login('archivist@ugarms.local');
  await snap('archivist-01-dashboard');
  await page.goto(`${BASE}/admin/accessions/${S.accessionId}`);
  await page.getByRole('button', { name: 'Submit for approval', exact: true }).click();
  await snap('archivist-02-accession-submit', page.getByRole('dialog'));
  await confirm('Submit for approval');
});
await step('chief-accession', async () => {
  await login('chief.archivist@ugarms.local');
  await snap(
    'chief-01-dashboard',
    page.getByText('Needs your attention').locator('xpath=ancestor::*[contains(@class,"card")][1]'),
  );
  await page.goto(`${BASE}/admin/accessions/${S.accessionId}`);
  await act('Start review');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await snap('chief-02-accession-approve', page.getByRole('dialog'));
  await confirm('Approve');
  await snap('chief-03-accession-approved', page.getByRole('button', { name: 'Receipt' }));
});
await step('archivist-catalogue', async () => {
  await login('archivist@ugarms.local');
  await page.goto(`${BASE}/admin/accessions/${S.accessionId}`);
  await page.getByRole('tab', { name: /Catalogue links/ }).click();
  await page.getByRole('button', { name: 'Create collection from accession' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Local identifier/)
    .fill('HISTCOM');
  await snap('archivist-03-create-collection', page.getByRole('dialog'));
  await page.getByRole('dialog').getByRole('button', { name: 'Create draft' }).click();
  await page.waitForURL(/\/admin\/records\//);
  S.recordId = page.url().split('/').pop();
  await settle();
  await snap('archivist-04-draft-record');
  await page.goto(`${BASE}/admin/records/${S.recordId}/edit`);
  await settle();
  await snap('archivist-05-editor');
  const api = await apiAs('archivist@ugarms.local');
  const rec = (await api.get(`/records/${S.recordId}`)).data;
  await api.patch(`/records/${S.recordId}`, {
    version: rec.version,
    dateExpression: '1990–2000',
    dateStart: '1990-01-01',
    dateEnd: '2000-12-31',
    creatorNote: 'Department of History, University of Ghana',
    scopeAndContent:
      'Minutes of the departmental committee and related correspondence. Fictional demonstration description.',
    adminBiographicalHistory:
      'The committee advised the Head of Department on teaching and research (demonstration text).',
    accessConditions: 'Open for research.',
    reproductionConditions: 'Copies on request.',
    extentAndMedium: '2 boxes (demonstration)',
  });
  await page.goto(`${BASE}/admin/records/${S.recordId}`);
  await page.getByRole('tab', { name: 'Digital assets' }).click();
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'committee-minutes-1990-p1.png',
      mimeType: 'image/png',
      buffer: uniquePagePng(`archivist-${Date.now()}`),
    });
  await snap('archivist-06-upload', page.getByRole('button', { name: 'Upload', exact: true }));
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/digital-assets') && r.request().method() === 'POST' && r.status() < 300,
      { timeout: 120_000 },
    ),
    page.getByRole('button', { name: 'Upload', exact: true }).click(),
  ]);
  await page.waitForTimeout(6000);
  await page.reload();
  await page.getByRole('tab', { name: 'Digital assets' }).click();
  await snap('archivist-07-assets');
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await snap('archivist-08-submit-review', page.getByRole('dialog'));
  await confirm('Submit for review');
  await page
    .getByRole('tab', { name: /History/ })
    .click()
    .catch(() => {});
  await snap('archivist-09-history');
});
await step('archivist-research', async () => {
  await page.goto(`${BASE}/admin/research-requests`);
  await snap('archivist-10-research-queue');
  await page.goto(`${BASE}/admin/research-requests/${S.requestId}`);
  await page.getByRole('button', { name: 'Start review', exact: true }).click();
  await settle();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const d = page.getByRole('dialog');
  await d
    .getByLabel(/Message to the researcher/)
    .fill('Approved for supervised consultation in the reading room. Photography is not permitted.');
  await d.getByLabel('Conditions').fill('Supervised consultation; no photography');
  await snap('archivist-11-research-approve', d);
  await confirm('Approve', d);
  await snap('archivist-12-awaiting-second', page.getByText('Awaiting approval', { exact: true }).first());
  await page.goto(`${BASE}/admin/authorities`);
  await snap('archivist-13-authorities');
  await page.goto(`${BASE}/admin/storage`);
  await snap('archivist-14-locations');
  await page.goto(`${BASE}/admin/storage/items`);
  await snap('archivist-15-physical-items');
});

// ================================================================ 6. Chief archivist: publish, second approval, access change, governance
await step('chief-publish', async () => {
  await login('chief.archivist@ugarms.local');
  await page.goto(`${BASE}/admin/records/${S.recordId}`);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await snap('chief-04-record-approve', page.getByRole('dialog'));
  await confirm('Approve');
  await act('Publish');
  await snap('chief-05-published', page.getByText('Published', { exact: true }).first());
  const api = await apiAs('chief.archivist@ugarms.local');
  await api.put(`/permissions/records/${S.recordId}/level`, {
    accessLevel: 'open',
    reason: 'Open for research after review (demonstration)',
  });
  await page.goto(`${BASE}/admin/research-requests/${S.requestId}`);
  await page.getByRole('button', { name: 'Give second approval' }).click();
  await snap('chief-06-second-approval', page.getByRole('dialog'));
  await confirm('Approve');
  await page.goto(`${BASE}/admin/access-requests`);
  await snap(
    'chief-07-access-requests',
    page.getByRole('listitem').filter({ hasText: 'Open for research after review' }).first(),
  );
});
await step('deputy-access', async () => {
  await login('deputy.archivist@ugarms.local');
  await page.goto(`${BASE}/admin/access-requests`);
  const row = page.getByRole('listitem').filter({ hasText: 'Open for research after review' }).first();
  await row.getByRole('button', { name: 'Approve' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel(/Reason/).fill('Second approval: content reviewed, no personal information (demonstration).');
  await snap('chief-08-deputy-approve', d);
  await confirm(/Approve|Confirm/, d);
});
await step('chief-governance', async () => {
  await login('chief.archivist@ugarms.local');
  const records = await apiAs('records.officer@ugarms.local');
  const chief = await apiAs('chief.archivist@ugarms.local');
  const fin = await byRef(records, 'UGA/DEMO-FIN');
  const kase = (
    await records.post('/appraisal/cases', {
      title: 'Review of departmental payment vouchers',
      items: [{ recordId: fin.id }],
    })
  ).data;
  await records.post(`/appraisal/cases/${kase.id}/transition`, { action: 'start_review' });
  await records.post(`/appraisal/cases/${kase.id}/transition`, {
    action: 'recommend',
    recommendation: 'dispose',
    rationale: 'Retention period of the demonstration schedule has ended.',
  });
  await records.post(`/appraisal/cases/${kase.id}/transition`, { action: 'request_approval' });
  S.appraisalId = kase.id;
  await page.goto(`${BASE}/admin/appraisal/${kase.id}`);
  await snap('chief-09-appraisal', page.getByRole('button', { name: 'Approve', exact: true }));
  await chief.post(`/appraisal/cases/${kase.id}/transition`, { action: 'approve', reason: 'Agreed (demonstration)' });
  const disposal = (await records.post('/disposal/cases', { appraisalCaseId: kase.id, action: 'destroy_physical' }))
    .data;
  S.disposalId = disposal.id;
  await page.goto(`${BASE}/admin/disposal/${disposal.id}`);
  await snap('chief-10-disposal');
  await page.goto(`${BASE}/admin/retention?tab=holds`);
  await page.getByRole('button', { name: 'Place hold' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel(/^Title/).fill('Internal audit enquiry');
  await d.getByLabel('Find a description by reference or title…').fill('UGA/DEMO-FIN');
  await d.getByRole('option').filter({ hasText: 'UGA/DEMO-FIN' }).first().getByRole('button').click();
  await snap('chief-11-legal-hold', d);
  await confirm('Place hold', d);
  await page.goto(`${BASE}/admin/disposal/${disposal.id}`);
  await snap('chief-12-disposal-blocked', page.getByText('Blocked', { exact: true }).first());
  await page.goto(`${BASE}/admin/reports`);
  await snap('chief-13-reports');
});

// ================================================================ 7. Digitisation officer
await step('digitisation', async () => {
  const archivist = await apiAs('archivist@ugarms.local');
  const chief = await apiAs('chief.archivist@ugarms.local');
  const digitiser = await apiAs('digitisation@ugarms.local');
  const project = (
    await archivist.post('/digitisation/projects', {
      title: 'Digitisation of committee minutes',
      sourceRecordId: S.recordId,
    })
  ).data;
  await chief.post(`/digitisation/projects/${project.id}/status`, { status: 'approved' });
  const me = (await digitiser.get('/auth/me')).data;
  const batch = (
    await archivist.post(`/digitisation/projects/${project.id}/batches`, {
      operatorId: me.id,
      ocrEnabled: true,
      ocrLanguage: 'eng',
    })
  ).data;
  await archivist.post(`/digitisation/batches/${batch.id}/items`, {
    items: [{ label: 'Minutes volume 1, page 1', recordId: S.recordId, expectedPages: 1 }],
  });
  S.batchId = batch.id;
  await login('digitisation@ugarms.local');
  await snap('digitisation-01-dashboard');
  await page.goto(`${BASE}/admin/digitisation`);
  await snap('digitisation-02-projects');
  await page.goto(`${BASE}/admin/digitisation/batches/${batch.id}`);
  await page.getByRole('button', { name: 'Start capture', exact: true }).click();
  await snap('digitisation-03-start-capture', page.getByRole('dialog'));
  await confirm('Start capture');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'minutes-vol1-p001.png',
      mimeType: 'image/png',
      buffer: uniquePagePng(`digitisation-${Date.now()}`),
    });
  await snap('digitisation-04-upload', page.getByRole('button', { name: 'Upload', exact: true }));
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/v1/digital-assets') && r.request().method() === 'POST', {
      timeout: 120_000,
    }),
    page.getByRole('button', { name: 'Upload', exact: true }).click(),
  ]);
  await page.waitForTimeout(15000);
  await page.reload();
  await snap('digitisation-05-batch');
  await page.goto(`${BASE}/admin/ocr`);
  await snap('digitisation-06-ocr-queue');
  const firstOcr = page.getByRole('row').nth(1);
  await firstOcr.click().catch(() => {});
  await settle();
  if (/\/admin\/ocr\//.test(page.url()))
    await snap('digitisation-07-ocr-review', page.getByRole('button', { name: 'Save and approve' }));
  const assets = (await digitiser.get(`/digital-assets?recordId=${S.recordId}&pageSize=5`)).data || [];
  const master = assets.find((a) => a.role === 'preservation_master') || assets[0];
  if (master) {
    await page.goto(`${BASE}/admin/assets/${master.id}`);
    await page
      .getByRole('tab', { name: /Preservation/ })
      .click()
      .catch(() => {});
    await snap('digitisation-08-asset-preservation', page.getByText('SHA-256').first());
  }
  await page.goto(`${BASE}/admin/preservation`);
  await snap('digitisation-09-preservation');
});

// ================================================================ 8. Researcher books; reading-room officer checks in, issues, receives
await step('reading-room', async () => {
  const rr = await apiAs('readingroom@ugarms.local');
  const rooms = (await rr.get('/reading-rooms')).data;
  const start = new Date(Date.now() + 15 * 60_000);
  const day = start.toISOString().slice(0, 10);
  const time = start.toISOString().slice(11, 16);
  await rr.post(`/reading-rooms/${rooms[0].id}/slots/generate`, {
    from: day,
    to: day,
    times: [time],
    durationMinutes: 120,
    capacity: 6,
    skipWeekends: false,
  });
  await login('researcher@ugarms.local');
  await page.goto(`${BASE}/my/requests/${S.requestId}`);
  await snap('researcher-06-approved-book', [
    page.getByText('Approved', { exact: true }).first().locator('..'),
    page.getByRole('heading', { name: 'Book a reading-room visit' }),
  ]);
  await page.evaluate(() => window.scrollTo(0, 0));
  const researcher = await apiAs('researcher@ugarms.local');
  const slot = (await rr.get(`/reading-rooms/${rooms[0].id}/availability?from=${day}&to=${day}`)).data.slots.find(
    (s) => s.startsAt.slice(11, 16) === time,
  );
  await researcher.post('/appointments', { slotId: slot.id, requestId: S.requestId });
  await page.reload();
  await snap('researcher-07-booked');
  const req = (await rr.get(`/research-requests/${S.requestId}`)).data;
  await login('readingroom@ugarms.local');
  await snap('readingroom-01-dashboard');
  await page.goto(`${BASE}/admin/reading-room`);
  const row = page.getByRole('listitem').filter({ hasText: req.requestNumber }).last();
  await snap('readingroom-02-schedule', row);
  await row.getByRole('button', { name: 'Check in' }).click();
  await snap('readingroom-03-check-in', page.getByRole('dialog'));
  await confirm('Confirm check-in');
  await page
    .getByRole('listitem')
    .filter({ hasText: req.requestNumber })
    .last()
    .getByRole('link', { name: 'Issue items' })
    .click();
  await settle();
  const box = (await rr.get('/physical-items?q=DEMO-0002')).data[0];
  await page
    .getByRole('dialog')
    .getByLabel(/Item barcode/)
    .fill(box.barcode);
  await snap('readingroom-04-issue', page.getByRole('dialog'));
  await confirm('Issue');
  await snap('readingroom-05-circulation', page.getByRole('row').filter({ hasText: box.barcode }));
  await page.getByRole('row').filter({ hasText: box.barcode }).getByRole('button', { name: 'Return' }).click();
  await page.getByRole('dialog').getByLabel('Condition notes').fill('Unchanged; returned in good order.');
  await snap('readingroom-06-return', page.getByRole('dialog'));
  await confirm('Record return');
  await page.goto(`${BASE}/admin/storage/items/${box.id}`);
  await snap('readingroom-07-item-history');
});

// ================================================================ 9. Auditor
await step('auditor', async () => {
  await login('auditor@ugarms.local');
  await snap('auditor-01-dashboard');
  await page.goto(`${BASE}/admin/audit`);
  await snap('auditor-02-audit-explorer');
  const verify = page.getByRole('button', { name: /Verify integrity/ });
  if (await verify.count()) {
    await verify.click();
    await settle();
    await snap('auditor-03-verify', page.getByText(/intact|verified|valid/i).first());
  }
  await page
    .getByRole('row')
    .nth(1)
    .click()
    .catch(() => {});
  await settle();
  await snap('auditor-04-event-detail');
  await page.goto(`${BASE}/admin/reports`);
  await snap('auditor-05-reports');
});

// ================================================================ 10. System administrator
await step('admin', async () => {
  await context.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.getByLabel('Email').fill('admin@ugarms.local');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/admin/);
  await settle();
  await snap('admin-01-forced-change');
  await page.getByLabel(/Current password/).fill(PASSWORD);
  await page.getByLabel(/^New password/).fill(ADMIN_NEW);
  await page.getByLabel(/Confirm/).fill(ADMIN_NEW);
  await page
    .getByRole('button', { name: /Change password|Update password|Save/ })
    .first()
    .click();
  await settle();
  await page.goto(`${BASE}/admin/users`);
  await snap('admin-02-users');
  await page.getByRole('button', { name: 'New user' }).click();
  await snap('admin-03-new-user', page.getByRole('dialog'));
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/admin/roles`);
  await snap('admin-04-roles');
  await page.goto(`${BASE}/admin/organisation`);
  await snap('admin-05-organisation');
  await page.goto(`${BASE}/admin/settings`);
  await snap('admin-06-settings');
  await page.goto(`${BASE}/admin/system`);
  await snap('admin-07-system-health');
  await page.goto(`${BASE}/admin/imports`);
  await snap('admin-08-imports');
});

await browser.close();
const failed = results.filter((r) => r.startsWith('FAILED:'));
console.log(
  `\n${results.length - failed.length} screenshots captured; ${failed.length} step(s) failed${failed.length ? `: ${failed.join(', ')}` : ''}`,
);
process.exit(failed.length ? 1 : 0);
