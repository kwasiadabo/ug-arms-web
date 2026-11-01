/**
 * End-to-end acceptance journeys A to H, run against the real stack with the demonstration data. Decision steps are
 * driven through the user interface; lengthy data entry uses the same API the interface calls.
 *
 * The journeys cover: accession to publication; public discovery with a digital file and citation; restricted
 * research access with a second approval; digitisation with OCR, quality review, checksums and access-controlled
 * derivatives; physical circulation; a legal hold that blocks disposal; restricted-record security for public
 * users; and import recovery without duplicates.
 *
 * @author Kwasi Adabo Boakye
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import { login, PASSWORD, uniquePagePng } from './helpers.js';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:5190/api/v1';

/**
 * Returns a short unique suffix for names created during a run.
 *
 * @returns {string}
 */
const uid = () => Date.now().toString(36);

/**
 * Signs in through the API and returns a client that sends the session cookie and CSRF header, exactly as the
 * browser does.
 *
 * @param {string} email Demonstration account.
 * @returns {Promise<{ ctx: object, get: Function, post: Function, patch: Function, put: Function, multipart:
 *   Function }>}
 */
async function apiAs(email) {
  const ctx = await pwRequest.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  const csrf = (await ctx.storageState()).cookies.find((c) => c.name === 'ugarms_csrf').value;

  /**
   * Sends one API request with the CSRF header and returns the status and parsed JSON body.
   *
   * @param {string} method HTTP method.
   * @param {string} path API path.
   * @param {*} [data] Request body.
   * @param {object} [opts={}] Extra Playwright request options, such as multipart data.
   * @returns {Promise<{ status: number, body: object|null }>}
   */
  const call = async (method, path, data, opts = {}) => {
    const r = await ctx.fetch(`${API}${path}`, { method, data, headers: { 'X-CSRF-Token': csrf }, ...opts });
    const body = r.headers()['content-type']?.includes('json') ? await r.json() : null;
    return { status: r.status(), body };
  };
  return {
    ctx,
    get: (p) => call('GET', p),
    post: (p, d) => call('POST', p, d),
    patch: (p, d) => call('PATCH', p, d),
    put: (p, d) => call('PUT', p, d),
    multipart: (p, multipart) => call('POST', p, undefined, { multipart }),
  };
}

/**
 * Polls a condition until it returns a truthy value, for waiting on background work such as ingest and OCR.
 *
 * @param {() => Promise<*>} fn The condition.
 * @param {{ timeout?: number, every?: number }} [options] Maximum wait and polling interval in milliseconds.
 * @returns {Promise<*>} The first truthy value.
 * @throws {Error} When the timeout is reached.
 */
async function until(fn, { timeout = 60_000, every = 1500 } = {}) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('Timed out waiting');
    await new Promise((r) => setTimeout(r, every));
  }
}

/**
 * Clicks an action button, confirms it in the dialog that opens, and waits for the dialog to close.
 *
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {string} name Label of the action button.
 * @param {string} [confirm=name] Label of the confirm button.
 * @returns {Promise<void>}
 */
async function act(page, name, confirm = name) {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: confirm, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Signs out by clearing cookies and signs in as another demonstration account.
 *
 * @param {import('@playwright/test').Page} page Browser page.
 * @param {string} email Account to switch to.
 * @returns {Promise<void>}
 */
async function switchUser(page, email) {
  await page.context().clearCookies();
  await login(page, email);
}

test('Journey A: accession to publication', async ({ page }) => {
  const id = uid();
  // Records officer prepares and submits a transfer (UI).
  await login(page, 'records.officer@ugarms.local');
  await page.goto('/admin/transfers');
  await page.getByRole('button', { name: 'New transfer' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(/^Title/).fill(`E2E transfer ${id}`);
  await dlg.getByLabel(/Originating unit/).selectOption({ label: 'Office of the Registrar' });
  await dlg.getByLabel('Proposed transfer date').fill('2026-12-01');
  await dlg.getByLabel('Transfer authority').fill('Registrar memo (test)');
  await dlg.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('heading', { name: `E2E transfer ${id}` })).toBeVisible();
  await page.getByRole('button', { name: 'Add line' }).click();
  await page.getByLabel('Title / description line 1').fill('Registry correspondence files');
  await page.getByLabel('Identifier line 1').fill(`R-${id}`);
  await page.getByRole('button', { name: 'Save inventory' }).click();
  await expect(page.getByText('Inventory saved')).toBeVisible();
  await act(page, 'Submit to the Archives');
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  const transferId = page.url().split('/').pop();

  // Archivist reviews and approves the transfer, then creates the accession (UI).
  await switchUser(page, 'archivist@ugarms.local');
  await page.goto(`/admin/transfers/${transferId}`);
  await act(page, 'Start review');
  await act(page, 'Record decision', 'Accept all');
  await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Create accession' }).click();
  await expect(page).toHaveURL(/\/admin\/accessions\//);
  const accessionId = page.url().split('/').pop();

  // Accession details and approval by a different authorised officer (separation of duties).
  const archivist = await apiAs('archivist@ugarms.local');
  await archivist.patch(`/accessions/${accessionId}`, {
    physicalCondition: 'Good',
    provenance: 'Registry',
    rightsStatement: 'University',
    accessionDate: '2026-10-27',
  });
  await page.reload();
  await act(page, 'Submit for approval');
  await switchUser(page, 'chief.archivist@ugarms.local');
  await page.goto(`/admin/accessions/${accessionId}`);
  await act(page, 'Start review');
  await act(page, 'Approve');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

  // Archivist catalogues: creates the collection from the accession, completes it and links a digital asset.
  await switchUser(page, 'archivist@ugarms.local');
  await page.goto(`/admin/accessions/${accessionId}`);
  await page.getByRole('tab', { name: /Catalogue links/ }).click();
  await page.getByRole('button', { name: 'Create collection from accession' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(/Local identifier/)
    .fill(`A${id}`);
  await page.getByRole('dialog').getByRole('button', { name: 'Create draft' }).click();
  await expect(page).toHaveURL(/\/admin\/records\//);
  const recordId = page.url().split('/').pop();
  const rec = (await archivist.get(`/records/${recordId}`)).body.data;
  await archivist.patch(`/records/${recordId}`, {
    version: rec.version,
    dateExpression: '1960–1970',
    creatorNote: 'Office of the Registrar',
    scopeAndContent: `Registry files for E2E ${id}`,
    adminBiographicalHistory: 'Registry history',
    accessConditions: 'Open',
    reproductionConditions: 'Copies on request',
    extentAndMedium: '1 box',
  });
  await page.reload();
  await page.getByRole('tab', { name: 'Digital assets' }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: `registry-${id}.png`, mimeType: 'image/png', buffer: uniquePagePng(`seed${id}`) });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText(/1 file\(s\) uploaded/)).toBeVisible();
  await act(page, 'Submit for review');
  await expect(page.getByText('In review', { exact: true }).first()).toBeVisible();

  // An authorised archivist approves and publishes the public description.
  await switchUser(page, 'chief.archivist@ugarms.local');
  await page.goto(`/admin/records/${recordId}`);
  await act(page, 'Approve');
  await act(page, 'Publish');
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible();
  const chief = await apiAs('chief.archivist@ugarms.local');
  await chief.put(`/permissions/records/${recordId}/level`, { accessLevel: 'open', reason: 'Open after review (E2E)' }); // pending second approval
  const pending = (await chief.get('/permissions/requests?status=pending')).body.data.find(
    (r) => r.targetId === recordId,
  );
  expect(pending).toBeTruthy(); // loosening access waits for a second person, as configured
  const visitor = await pwRequest.newContext(); // no cookies: a genuine anonymous visitor
  expect((await visitor.get(`${API}/public/records/${recordId}`)).status()).toBe(404); // still staff-only until the second approval

  // A second authorised approver confirms the change through the access-requests queue.
  await switchUser(page, 'deputy.archivist@ugarms.local');
  await page.goto('/admin/access-requests');
  const row = page
    .getByRole('listitem')
    .filter({ hasText: 'Open after review (E2E)' })
    .filter({ hasText: `E2E transfer ${id}` });
  await row.getByRole('button', { name: 'Approve' }).click();
  const dlg2 = page.getByRole('dialog');
  await dlg2.getByLabel(/Reason/).fill('Second approval (E2E)');
  await dlg2.getByRole('button', { name: /Approve|Confirm/ }).click();
  await expect(dlg2).toHaveCount(0);
  expect((await visitor.get(`${API}/public/records/${recordId}`)).status()).toBe(200);
  await page.context().clearCookies();
  await page.goto(`/records/${recordId}`);
  await expect(page.getByRole('heading', { name: /E2E transfer/ })).toBeVisible();
});

test('Journey B: public discovery with digital file and citation', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.locator('#hero-q').fill('Congregation');
  await page.locator('#hero-q').press('Enter');
  await expect(page).toHaveURL(/q=Congregation/);
  await page
    .getByRole('complementary', { name: 'Filters' })
    .getByRole('button', { name: /Series/ })
    .click();
  await expect(page).toHaveURL(/level=series/);
  await page
    .getByRole('link', { name: /Congregation ceremonies/ })
    .first()
    .click();
  const image = page.getByRole('img', { name: /Congregation ceremonies|Congregation procession/ }).first();
  await expect(image).toBeVisible();
  const src = await image.getAttribute('src');
  const file = await page.request.get(src);
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('image/jpeg');
  await page.getByRole('button', { name: 'Copy citation' }).click();
  await expect(page.getByText('Citation copied')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('UGA/DEMO-PHOTO/CONG');
});

test('Journey C: restricted research access with second approval', async ({ page }) => {
  // Start from no access: revoke any grant left by an earlier run.
  const chiefApi = await apiAs('chief.archivist@ugarms.local');
  const target = (await chiefApi.get('/records?q=UGA%2FDEMO-REG%2FSTU&pageSize=5')).body.data.find(
    (r) => r.referenceCode === 'UGA/DEMO-REG/STU',
  );
  const me = (await (await apiAs('researcher@ugarms.local')).get('/auth/me')).body.data;
  for (const g of (await chiefApi.get(`/permissions/records/${target.id}`)).body.data.grants.filter(
    (x) => x.userId === me.id && !x.revokedAt,
  )) {
    expect(
      (await chiefApi.post(`/permissions/grants/${g.id}/revoke`, { reason: 'Reset before E2E journey C' })).status,
    ).toBe(200);
  }
  await login(page, 'researcher@ugarms.local');
  await page.goto(`/records/${target.id}`);
  await expect(page.getByText('Access to this material is restricted')).toBeVisible();
  await page.getByRole('link', { name: 'Request access' }).click();
  await page.getByLabel(/Research purpose/).fill('E2E: doctoral research on admissions policy');
  await page.getByLabel(/I acknowledge the access conditions/).check();
  await page.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText(/received/)).toBeVisible();
  await page.getByRole('button', { name: 'Track this request' }).click();
  const requestId = page.url().split('/').pop();

  await switchUser(page, 'archivist@ugarms.local');
  await page.goto(`/admin/research-requests/${requestId}`);
  await page.getByRole('button', { name: 'Start review' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel(/Message to the researcher/).fill('Approved: supervised consultation, no photography.');
  await d.getByLabel('Conditions').fill('No photography');
  await d.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Awaiting approval', { exact: true }).first()).toBeVisible();

  await switchUser(page, 'chief.archivist@ugarms.local');
  await page.goto(`/admin/research-requests/${requestId}`);
  await act(page, 'Give second approval', 'Approve');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

  await switchUser(page, 'researcher@ugarms.local');
  await page.goto(`/my/requests/${requestId}`);
  await expect(page.getByText('Conditions: No photography')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Book a reading-room visit' })).toBeVisible();
});

test('Journey D: digitisation, OCR, QA, checksums and access-controlled derivative', async ({ page }) => {
  test.setTimeout(240_000);
  const id = uid();
  const archivist = await apiAs('archivist@ugarms.local');
  const chief = await apiAs('chief.archivist@ugarms.local');
  const digitiser = await apiAs('digitisation@ugarms.local');
  const cong = (await archivist.get('/records?q=UGA%2FDEMO-PHOTO%2FCONG&pageSize=5')).body.data.find(
    (r) => r.referenceCode === 'UGA/DEMO-PHOTO/CONG',
  );
  const project = (
    await archivist.post('/digitisation/projects', { title: `E2E project ${id}`, sourceRecordId: cong.id })
  ).body.data;
  await chief.post(`/digitisation/projects/${project.id}/status`, { status: 'approved' });
  const me = (await digitiser.get('/auth/me')).body.data;
  const batch = (
    await archivist.post(`/digitisation/projects/${project.id}/batches`, {
      operatorId: me.id,
      ocrEnabled: true,
      ocrLanguage: 'eng',
    })
  ).body.data;
  await archivist.post(`/digitisation/batches/${batch.id}/items`, {
    items: [{ label: `Page ${id}`, recordId: cong.id, expectedPages: 1 }],
  });

  // Operator uploads the page through the batch screen.
  await login(page, 'digitisation@ugarms.local');
  await page.goto(`/admin/digitisation/batches/${batch.id}`);
  await act(page, 'Start capture');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: `page-${id}.png`, mimeType: 'image/png', buffer: uniquePagePng(`seedd${id}`) });
  await page.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page.getByText(/1 file\(s\) uploaded/)).toBeVisible();

  /**
   * Loads the current state of the digitisation batch used in Journey D.
   *
   * @returns {Promise<object>}
   */
  const batchState = async () => (await digitiser.get(`/digitisation/batches/${batch.id}`)).body.data;
  const asset = await until(async () => {
    const a = (await batchState()).items[0].assets.find((x) => x.role === 'preservation_master');
    return a && a.status === 'available' && a;
  });
  expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
  // OCR runs asynchronously in the worker.
  const ocrStatus = await until(
    async () => {
      const st = (await digitiser.get(`/digital-assets/${asset.id}`)).body.data.ocrStatus;
      return ['succeeded', 'failed'].includes(st) && st;
    },
    { timeout: 120_000 },
  );
  expect(ocrStatus).toBe('succeeded');
  await page.reload();
  await page.getByRole('button', { name: 'Mark captured' }).click();
  await act(page, 'Submit capture');
  await act(page, 'Processing complete');
  await expect(page.getByText('Quality review', { exact: true }).first()).toBeVisible();

  // A different reviewer completes QA and approves the batch.
  await switchUser(page, 'archivist@ugarms.local');
  await page.goto(`/admin/digitisation/batches/${batch.id}`);
  await page.getByRole('button', { name: 'Quality review' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Record pass/i })
    .click();
  await act(page, 'Approve batch');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

  // Checksums are recorded and visible; the derivative is published per the record's open access.
  await page.goto(`/admin/assets/${asset.id}`);
  await page.getByRole('tab', { name: /Preservation/ }).click();
  await expect(page.getByText('SHA-256').first()).toBeVisible();
  const derivative = (await chief.get(`/digital-assets/${asset.id}`)).body.data.derivatives.find(
    (x) => x.role === 'access_derivative',
  );
  expect((await chief.post(`/digital-assets/${derivative.id}/publish`, { publish: true })).status).toBe(200);
  const anon = await pwRequest.newContext();
  const link = await anon.post(`${API}/digital-assets/${derivative.id}/link`, { data: {} });
  expect(link.status()).toBe(200);
  const masterLink = await anon.post(`${API}/digital-assets/${asset.id}/link`, { data: {} });
  expect(masterLink.status()).toBe(404);
});

test('Journey E: physical circulation', async ({ page }) => {
  const id = uid();
  const archivist = await apiAs('archivist@ugarms.local');
  const researcher = await apiAs('researcher@ugarms.local');
  const rr = await apiAs('readingroom@ugarms.local');
  const estates = (await archivist.get('/records?q=UGA%2FDEMO-REG%2FEST&pageSize=5')).body.data.find(
    (r) => r.referenceCode === 'UGA/DEMO-REG/EST',
  );
  const box = (await archivist.get('/physical-items?q=DEMO-0003')).body.data[0];
  const req = (
    await researcher.post('/research-requests', {
      requestType: 'consultation',
      purpose: `E2E circulation ${id}`,
      items: [{ recordId: estates.id }],
    })
  ).body.data;
  await archivist.post(`/research-requests/${req.id}/actions`, { action: 'start_review' });
  await archivist.post(`/research-requests/${req.id}/actions`, { action: 'approve', publicNote: 'Approved' });
  // A fresh slot starting ten minutes from now (institution time is UTC, Africa/Accra), so each run books its own place
  // and the reading-room officer can check the researcher in today.
  const rooms = (await rr.get('/reading-rooms')).body.data;
  const start = new Date(Date.now() + 10 * 60_000);
  const day = start.toISOString().slice(0, 10);
  const time = start.toISOString().slice(11, 16);
  await rr.post(`/reading-rooms/${rooms[0].id}/slots/generate`, {
    from: day,
    to: day,
    times: [time],
    durationMinutes: 25,
    capacity: 4,
    skipWeekends: false,
  });
  const slot = (await rr.get(`/reading-rooms/${rooms[0].id}/availability?from=${day}&to=${day}`)).body.data.slots.find(
    (s) => s.available > 0 && s.startsAt.slice(11, 16) === time,
  );
  expect(slot, `slot at ${day} ${time}`).toBeTruthy();
  expect((await researcher.post('/appointments', { slotId: slot.id, requestId: req.id })).status).toBe(201);

  await login(page, 'readingroom@ugarms.local');
  await page.goto('/admin/reading-room');
  const row = page.getByRole('listitem').filter({ hasText: req.requestNumber }).last();
  await row.getByRole('button', { name: 'Check in' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm check-in' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: req.requestNumber })
    .last()
    .getByRole('link', { name: 'Issue items' })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel(/Item barcode/)
    .fill(box.barcode);
  await page.getByRole('dialog').getByRole('button', { name: 'Issue', exact: true }).click();
  await expect(page.getByText('Item issued')).toBeVisible();
  expect((await archivist.get(`/physical-items/${box.id}`)).body.data.status).toBe('issued');
  const issueRow = page.getByRole('row').filter({ hasText: box.barcode });
  await issueRow.getByRole('button', { name: 'Return' }).click();
  await page.getByRole('dialog').getByLabel('Condition notes').fill('Unchanged');
  await page.getByRole('dialog').getByRole('button', { name: 'Record return' }).click();
  await expect(page.getByText('Return recorded')).toBeVisible();
  const item = (await archivist.get(`/physical-items/${box.id}`)).body.data;
  expect(item.status).toBe('available');
  expect(item.movements.slice(0, 2).map((m) => m.movementType)).toEqual(['return', 'issue']);
  expect(item.conditions.slice(0, 2).map((c) => c.context)).toEqual(['return', 'issue']);
});

test('Journey F: legal hold blocks disposal; nothing is destroyed', async ({ page }) => {
  const records = await apiAs('records.officer@ugarms.local');
  const chief = await apiAs('chief.archivist@ugarms.local');
  const vouchers = (await records.get('/records?q=UGA%2FDEMO-FIN&pageSize=5')).body.data.find(
    (r) => r.referenceCode === 'UGA/DEMO-FIN',
  );
  const boxBefore = (await records.get('/physical-items?q=DEMO-0005')).body.data[0];
  // Release holds left by earlier runs of this journey or by demo walkthroughs (audited), so the review can start cleanly.
  const deputy = await apiAs('deputy.archivist@ugarms.local'); // separation of duties: not the person who placed it
  for (const h of (await chief.get('/legal-holds?status=active&pageSize=100')).body.data.filter((x) =>
    ['E2E audit investigation', 'Internal audit enquiry'].includes(x.title),
  )) {
    expect((await deputy.post(`/legal-holds/${h.id}/release`, { reason: 'Reset before E2E journey F' })).status).toBe(
      200,
    );
  }
  const kase = (
    await records.post('/appraisal/cases', {
      title: `E2E retention review ${uid()}`,
      items: [{ recordId: vouchers.id }],
    })
  ).body.data;
  for (const a of ['start_review']) await records.post(`/appraisal/cases/${kase.id}/transition`, { action: a });
  await records.post(`/appraisal/cases/${kase.id}/transition`, {
    action: 'recommend',
    recommendation: 'dispose',
    rationale: 'Retention period met (E2E)',
  });
  await records.post(`/appraisal/cases/${kase.id}/transition`, { action: 'request_approval' });
  await chief.post(`/appraisal/cases/${kase.id}/transition`, { action: 'approve', reason: 'Agreed (E2E)' });
  const created = await records.post('/disposal/cases', { appraisalCaseId: kase.id, action: 'destroy_physical' });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const disposal = created.body.data;

  // A legal hold is placed through the interface.
  await login(page, 'chief.archivist@ugarms.local');
  await page.goto('/admin/retention?tab=holds');
  await page.getByRole('button', { name: 'Place hold' }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel(/^Title/).fill('E2E audit investigation');
  await d.getByLabel('Find a description by reference or title…').fill('UGA/DEMO-FIN');
  await d.getByRole('option').filter({ hasText: 'UGA/DEMO-FIN' }).first().getByRole('button').click();
  await d.getByRole('button', { name: 'Place hold' }).click();
  await expect(page.getByText(/Legal hold placed/)).toBeVisible();

  await page.goto(`/admin/disposal/${disposal.id}`);
  await expect(page.getByText('Blocked', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execute' })).toHaveCount(0);
  const exec = await chief.post(`/disposal/cases/${disposal.id}/execute`, { confirmation: disposal.caseNumber });
  expect(exec.status).toBe(409);
  const boxAfter = (await records.get(`/physical-items/${boxBefore.id}`)).body.data;
  expect(boxAfter.status).toBe(boxBefore.status);
  expect((await chief.get(`/disposal/cases/${disposal.id}`)).body.data.certificates).toHaveLength(0);
});

test('Journey G: restricted-record security for public users', async ({ page }) => {
  const staff = await apiAs('chief.archivist@ugarms.local');
  const restricted = (await staff.get('/records?q=UGA%2FDEMO-REG%2FSTU&pageSize=5')).body.data.find(
    (r) => r.referenceCode === 'UGA/DEMO-REG/STU',
  );
  const hidden = 'personnel-secret-scope';
  const rec = (await staff.get(`/records/${restricted.id}`)).body.data;
  await staff.patch(`/records/${restricted.id}`, {
    version: rec.version,
    scopeAndContent: `${rec.scopeAndContent} ${hidden}`,
  });
  await page.goto(`/records/${restricted.id}`);
  await expect(page.getByText('Access to this material is restricted')).toBeVisible();
  await expect(page.getByText(hidden)).toHaveCount(0);
  const anon = page.request;
  const detail = await anon.get(`${API}/public/records/${restricted.id}`);
  expect(JSON.stringify(await detail.json())).not.toContain(hidden);
  const search = await anon.get(`${API}/public/search?q=${hidden}`);
  expect((await search.json()).data.total).toBe(0);
  expect((await anon.get(`${API}/records/${restricted.id}`)).status()).toBe(401);
  expect((await anon.get(`${API}/ocr/queue`)).status()).toBe(401);
  const anyAsset = (await staff.get('/digital-assets?pageSize=1')).body.data[0];
  const masterLink = await anon.post(`${API}/digital-assets/${anyAsset.id}/link`, { data: {} });
  expect(masterLink.status()).toBe(404);
  expect((await anon.get(`${API}/files/not-a-real-token`)).status()).toBe(404);
});

test('Journey H: import recovery without duplicates', async ({ page }) => {
  const id = uid();
  const ref = `IMP${id}`;

  /**
   * Builds an import file with a header row and the given data rows.
   *
   * @param {string[]} rows CSV data rows.
   * @returns {Buffer}
   */
  const csv = (rows) => Buffer.from(['Legacy ID,Reference,Parent,Level,Title,Date From,Date To', ...rows].join('\n'));
  const first = csv([
    `L1-${id},${ref},,fonds,Legacy register ${id},1950,1970`,
    `L2-${id},${ref}/1,${ref},series,Valid series,1950,1960`,
    `L3-${id},${ref}/2,${ref},series,Bad dates,1990,1980`,
  ]);
  await login(page, 'archivist@ugarms.local');
  await page.goto('/admin/imports');
  await page.getByRole('button', { name: 'New import' }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: `legacy-${id}.csv`, mimeType: 'text/csv', buffer: first });
  await page.getByRole('dialog').getByRole('button', { name: 'Upload' }).click();
  await expect(page).toHaveURL(/\/admin\/imports\//);
  await page.getByRole('button', { name: 'Validate (dry run)' }).click();
  await expect(page.getByText(/2 valid, 1 with errors/)).toBeVisible();
  await expect(page.getByText(/End date is before start date/)).toBeVisible();
  await page.getByRole('button', { name: /Import 2 valid row/ }).click();
  await expect(page.getByText('Reconciled: every source row is accounted for.')).toBeVisible({ timeout: 60_000 });

  // Corrected file re-imported: the fixed row is added, earlier rows are skipped, nothing is duplicated.
  const fixed = csv([
    `L1-${id},${ref},,fonds,Legacy register ${id},1950,1970`,
    `L2-${id},${ref}/1,${ref},series,Valid series,1950,1960`,
    `L3-${id},${ref}/2,${ref},series,Fixed dates,1980,1990`,
  ]);
  await page.goto('/admin/imports');
  await page.getByRole('button', { name: 'New import' }).click();
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: `legacy-${id}-fixed.csv`, mimeType: 'text/csv', buffer: fixed });
  await page.getByRole('dialog').getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('button', { name: 'Validate (dry run)' }).click();
  await page.getByRole('button', { name: /Import 3 valid row/ }).click();
  await expect(page.getByText('Reconciled: every source row is accounted for.')).toBeVisible({ timeout: 60_000 });
  const api = await apiAs('archivist@ugarms.local');
  const found = (await api.get(`/records?q=${ref}&pageSize=50`)).body.data.filter((r) =>
    r.referenceCode.startsWith(ref),
  );
  expect(found.map((r) => r.referenceCode).sort()).toEqual([ref, `${ref}/1`, `${ref}/2`]);
});
