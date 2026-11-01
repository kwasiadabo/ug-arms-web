/**
 * Builds docs/user-guide/UG-ARMS-Transfer-to-Discovery.pdf, which follows one transfer from a department to a
 * researcher's search through every role. It uses the screenshots captured by scripts/capture-user-guide.mjs and is
 * run with `node scripts/build-transfer-journey.mjs`.
 *
 * @author Kwasi Adabo Boakye
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GUIDE = path.join(ROOT, 'docs/user-guide');
const OUT = path.join(GUIDE, 'UG-ARMS-Transfer-to-Discovery.pdf');
const crest = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'frontend/public/brand/ug-crest.png')).toString('base64')}`;
const sharp = createRequire(path.join(ROOT, 'backend/package.json'))('sharp');

const stages = [
  {
    n: '1',
    title: 'The department prepares the transfer',
    who: 'Departmental Records Liaison',
    account: 'liaison.history@ugarms.local',
    tone: '#8a6a0c',
    intro:
      'The liaison’s menu has only three items: <b>Dashboard</b>, <b>Descriptions</b> and <b>Transfer submissions</b>. They can only act for their own unit.',
    steps: [
      '<b>Transfer submissions → New transfer.</b> Enter a title, the proposed transfer date, a contact person and the <b>transfer authority</b> (the memo or decision that authorises sending the records). The originating unit is fixed to History, so a liaison cannot submit on behalf of another department.',
      '<b>Inventory.</b> Add one line per file, volume or box: identifier, title, dates, format, quantity, box number, condition and confidentiality. A CSV or Excel list can be imported instead.',
      '<b>Submit to the Archives.</b> The system checks the inventory is complete, then saves a <b>snapshot</b> of exactly what was submitted.',
    ],
    status:
      '<code>draft</code> → <code>submitted</code>. The inventory becomes read-only for the liaison, and everyone who reviews transfers is notified.',
    note: '<b>Why the snapshot matters.</b> If the Archives queries the transfer and the department edits it, each resubmission is kept as a new revision. Anyone can compare what was promised with what was changed.',
    shots: [
      ['liaison-02-new-transfer', 'Starting a new transfer'],
      ['liaison-03-inventory', 'Describing what is being sent'],
      ['liaison-05-submitted', 'Submitted: the inventory is now read-only'],
    ],
  },
  {
    n: '2',
    title: 'The Archives decides what to accept',
    who: 'Records Officer',
    account: 'records.officer@ugarms.local',
    tone: '#8a6a0c',
    steps: [
      'The dashboard’s <b>Needs your attention</b> panel shows the transfer waiting for review.',
      '<b>Start review</b>, then <b>Record decision</b>. Accept or reject <b>each inventory line</b>, so partial acceptance is normal. For example, accept the minutes and reject duplicate photocopies. Every line needs a decision before the review can be saved.',
      'If something is unclear, <b>Raise a query</b> sends the transfer back to the liaison. Its status becomes <code>query_raised</code> and it is editable again. The <b>Discussion</b> panel keeps the whole conversation.',
      'Once the lines are accepted, <b>Create accession</b> turns the transfer into a formal accession. The accession number is generated automatically, and <b>only the accepted lines</b> are copied in as received items. Missing information such as condition, provenance and rights statement is flagged.',
    ],
    status: '<code>submitted</code> → <code>accepted</code> or <code>partially_accepted</code> → accession created.',
    shots: [
      ['officer-01-dashboard', 'Needs your attention'],
      ['officer-03-decision', 'Deciding line by line'],
      ['officer-05-accession', 'The new accession with missing information flagged'],
    ],
  },
  {
    n: '3',
    title: 'The custody record is completed',
    who: 'Archivist',
    account: 'archivist@ugarms.local',
    tone: '#2b1471',
    steps: [
      'Open the accession, use <b>Edit details</b> to fill in the flagged fields, and save the received items.',
      '<b>Submit for approval.</b> The archivist cannot approve their own accession (separation of duties).',
    ],
    shots: [['archivist-02-accession-submit', 'Completing and submitting the accession']],
  },
  {
    n: '4',
    title: 'Custody is formally approved',
    who: 'Chief Archivist',
    account: 'chief.archivist@ugarms.local',
    tone: '#2b1471',
    steps: [
      'The accession appears in the Chief Archivist’s <b>Needs your attention</b> panel.',
      '<b>Start review</b>, then <b>Approve</b>. The dialog confirms how many items will be accepted. <b>Query</b> returns the accession to the archivist with a reason, and <b>Reject</b> refuses it.',
      '<b>Receipt</b> produces a PDF acknowledgement bearing the crest. It goes back to the History department as proof that the Archives now holds the records.',
    ],
    note: 'At this point the Archives <b>legally holds the material</b>, but nothing is searchable yet. An accession is a custody record, not a catalogue description.',
    shots: [
      ['chief-02-accession-approve', 'Approving the accession'],
      ['chief-03-accession-approved', 'Approved, with the receipt available'],
    ],
  },
  {
    n: '5',
    title: 'The material is catalogued',
    who: 'Archivist',
    account: 'archivist@ugarms.local',
    tone: '#2b1471',
    steps: [
      'On the accession’s <b>Catalogue links</b> tab, <b>Create collection from accession</b>. The title, dates, creator and extent are copied across, and the reference code is built automatically, here <code>UGA/HISTCOM</code>.',
      '<b>Edit</b> the description using the international ISAD(G) standard: scope and content, arrangement, conditions of access and so on. Which fields are required depends on the level (collection, series, file or item). <b>Every save creates a version</b> that can be compared or restored.',
      '<b>Creators and subjects:</b> link authority records, such as “Department of History” as a corporate body, so names stay consistent across collections.',
      '<b>Physical items and locations:</b> place the boxes on a shelf. A full shelf refuses the placement unless an authorised person overrides it, and the override is audited. <b>Print labels</b> produces barcodes.',
      '<b>Access:</b> set the access level, such as open, restricted or staff-only. This one setting decides what the researcher will eventually see (see Stage 8).',
    ],
    status: 'The description is a <b>draft</b>, visible only to staff.',
    shots: [
      ['archivist-03-create-collection', 'Creating the collection from the accession'],
      ['archivist-05-editor', 'Describing to ISAD(G)'],
      ['archivist-14-locations', 'Storage locations and capacity'],
    ],
  },
  {
    n: '6',
    title: 'The documents are digitised and the text extracted',
    who: 'Digitisation Officer, with the Archivist',
    account: 'digitisation@ugarms.local',
    tone: '#3a2490',
    intro:
      'Files can be attached directly by the archivist (<b>Digital assets → Upload</b>) or through a digitisation project and batch. Either way, every file goes through the same pipeline in the background worker:',
    table: [
      [
        'File type check',
        'The type is detected <b>from the content, not the file name</b>. A “.pdf” that is really a program is refused.',
      ],
      [
        'Malware scan',
        'ClamAV scans the file. Infected files are quarantined. If the scan itself fails, the file is <b>held</b> until it is re-scanned.',
      ],
      ['SHA-256 checksum', 'A fingerprint is stored. Scheduled fixity checks compare against it later.'],
      ['Preservation master', 'The original is stored privately and is <b>never published</b>.'],
      [
        'Access copy and thumbnail',
        'Viewable copies are generated automatically. Only these can ever be shown publicly.',
      ],
      ['OCR', 'Text is read from each page in the background.'],
    ],
    steps: [
      '<b>Projects &amp; batches → Start capture</b>, upload the scans, mark each item captured, then <b>Submit capture</b>. A <b>different person</b> passes or reworks the batch in quality review. This is one use of the second archivist account (<code>archivist2</code>): one person’s work can be checked by another.',
      '<b>OCR review:</b> the original page and the extracted text appear side by side. Correct the text, then <b>Save and approve</b>.',
    ],
    note: '<b>Important gate.</b> OCR text is not searchable until someone approves it. Unchecked machine text never reaches search results.',
    shots: [
      ['archivist-07-assets', 'Background processing: access copies, thumbnails and OCR'],
      ['digitisation-05-batch', 'Tracking a digitisation batch'],
      ['digitisation-07-ocr-review', 'Checking and approving OCR text'],
    ],
  },
  {
    n: '7',
    title: 'The description is reviewed and published',
    who: 'Archivist submits; Chief Archivist approves and publishes',
    account: 'archivist@ / chief.archivist@ugarms.local',
    tone: '#2b1471',
    steps: [
      'The archivist chooses <b>Submit for review</b>. If required fields are missing, the system lists them and refuses.',
      'The Chief Archivist chooses <b>Approve</b> (or <b>Return to draft</b> with a comment), then <b>Publish</b>.',
    ],
    status:
      '<code>draft</code> → <code>in review</code> → <code>approved</code> → <code>published</code>. Every step is recorded on the <b>History</b> tab.',
    shots: [
      ['archivist-08-submit-review', 'Submitting the description for review'],
      ['chief-05-published', 'Published'],
    ],
  },
  {
    n: '7b',
    title: 'Opening access needs a second person',
    who: 'Deputy Archivist',
    account: 'deputy.archivist@ugarms.local',
    tone: '#2b1471',
    steps: [
      'If the description was staff-only and someone changes it to <b>open</b>, that makes it <i>less</i> restrictive. The change waits in <b>Access approvals</b> until a <b>different</b> person approves it, which is why the deputy account exists.',
      'Making access <i>stricter</i> takes effect immediately with no approval.',
    ],
    shots: [
      ['chief-07-access-requests', 'The access change waiting for a second person'],
      ['chief-08-deputy-approve', 'The deputy approves'],
    ],
  },
  {
    n: '8',
    title: 'The researcher searches and finds it',
    who: 'Researcher, or any member of the public',
    account: 'researcher@ugarms.local (no account needed for open material)',
    tone: '#5a47b0',
    intro:
      'A member of the public searches “committee minutes” on the portal. Whether the record appears is decided by one shared access policy:',
    table: [
      [
        'Published at every level above it, and access is <b>open</b>',
        'The full description, digital copies, and matches inside the approved OCR text.',
      ],
      [
        'Published, but <b>restricted</b>',
        'Title, reference and dates only, the reason for the restriction and a <b>Request access</b> button. The scope note, files and OCR text are withheld.',
      ],
      [
        'Staff-only, or anything above it still unpublished',
        '<b>Nothing.</b> The record does not appear in results, filter counts, suggestions or the finding aid.',
      ],
    ],
    tableHead: ['Situation', 'What the public sees'],
    steps: [
      'The same rules apply to search, filters, exports and file downloads, so nothing can leak through a back route.',
      'For restricted material, the researcher clicks <b>Request access</b>, states their purpose and accepts the conditions. An archivist approves with conditions, then the Chief Archivist or deputy gives the <b>second approval</b>. The researcher receives time-limited access and books a reading-room slot.',
      'The <b>Reading-Room Officer</b> (<code>readingroom@ugarms.local</code>) checks their ID, issues the box with its condition recorded, and records its condition again on return.',
    ],
    shots: [
      ['visitor-02-results', 'Search results with highlighted matches'],
      ['visitor-04-record', 'An open description with its digital copies'],
      ['visitor-06-restricted', 'A restricted description: identifying information only'],
      ['researcher-03-request-form', 'Requesting access to restricted material'],
    ],
  },
];

const others = [
  [
    'System Administrator',
    'admin@ugarms.local',
    'Before anything starts: creates the liaison’s account and assigns them to the History unit, sets up the organisation structure and sets numbering rules. Takes <b>no</b> archival decisions and cannot see restricted content by default.',
    'admin-03-new-user',
    'Creating the liaison’s account',
  ],
  [
    'Auditor',
    'auditor@ugarms.local',
    'After the fact: the <b>Audit explorer</b> shows every step in this guide (who, what, when, before and after values). <b>Verify integrity</b> proves the trail has not been altered. Read-only.',
    'auditor-02-audit-explorer',
    'Every step of the journey in the audit trail',
  ],
  [
    'Second archivist',
    'archivist2@ugarms.local',
    'Lets the “a different person must check” rules be carried out at archivist level.',
    null,
  ],
];

const shotNames = [...stages.flatMap((s) => s.shots.map(([f]) => f)), ...others.map((o) => o[3]).filter(Boolean)];
const img = {};
for (const f of shotNames) {
  const file = path.join(GUIDE, 'screenshots', `${f}.jpg`);
  if (!fs.existsSync(file)) {
    console.error(`Missing screenshot: ${f}`);
    process.exit(1);
  }
  img[f] =
    `data:image/jpeg;base64,${(await sharp(file).resize({ width: 1500 }).jpeg({ quality: 76, mozjpeg: true }).toBuffer()).toString('base64')}`;
}

let fig = 0;

/**
 * Renders a numbered figure with its caption.
 *
 * @param {string} f Screenshot name.
 * @param {string} cap Caption.
 * @returns {string} HTML.
 */
const figure = (f, cap) =>
  `<figure><img src="${img[f]}" alt="${cap}"><figcaption>Figure ${++fig} · ${cap}</figcaption></figure>`;
const flow = [
  ['Liaison', 'Prepares transfer'],
  ['Records Officer', 'Accepts lines'],
  ['Archivist', 'Completes accession'],
  ['Chief Archivist', 'Approves custody'],
  ['Archivist', 'Catalogues'],
  ['Digitisation', 'Scans, approves OCR'],
  ['Chief Archivist', 'Publishes'],
  ['Deputy', 'Opens access'],
  ['Researcher', 'Finds it'],
];

/**
 * Renders one stage of the journey: who acts, the steps, the status change, notes, tables and screenshots.
 *
 * @param {object} s Stage content.
 * @returns {string} HTML.
 */
const stageHtml = (s) => `
  <section class="stage">
    <div class="stage-head" style="--tone:${s.tone}">
      <p class="eyebrow">Stage ${s.n}</p>
      <h1>${s.title}</h1>
      <p class="who"><b>${s.who}</b> · <code>${s.account}</code></p>
    </div>
    ${s.intro ? `<p>${s.intro}</p>` : ''}
    ${s.table ? `<table>${s.tableHead ? `<thead><tr><th>${s.tableHead[0]}</th><th>${s.tableHead[1]}</th></tr></thead>` : ''}<tbody>${s.table.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>` : ''}
    <ol>${s.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
    ${s.status ? `<p class="status"><span>Status</span> ${s.status}</p>` : ''}
    ${s.note ? `<div class="note">${s.note}</div>` : ''}
    ${s.shots.map(([f, c]) => figure(f, c)).join('')}
  </section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>From Transfer to Discovery</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  @page :first { margin: 0; }
  :root { --indigo:#2b1471; --indigo-900:#1a0c45; --gold:#dfb725; --gold-text:#8a6a0c; --ink:#1e1c2b; --soft:#55526a; --line:#e5e3ee; --canvas:#f7f6fa; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Manrope, 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.5; }
  h1, h2, h3 { margin: 0; letter-spacing: -0.01em; }
  code { font-family: Menlo, monospace; font-size: 8.6pt; background: var(--canvas); border: 1px solid var(--line); border-radius: 4px; padding: 0 3px; }
  .cover { height: 297mm; background: var(--indigo-900); color: #fff; padding: 28mm 22mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; }
  .cover::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 18mm 18mm; }
  .cover > * { position: relative; }
  .cover .bar { position: absolute; left: 0; right: 0; top: 0; height: 4mm; background: var(--gold); }
  .cover img { width: 46mm; }
  .cover .inst { margin-top: 10mm; color: var(--gold); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 9.5pt; }
  .cover h1 { font-size: 32pt; line-height: 1.1; margin-top: 4mm; font-weight: 800; }
  .cover .sub { font-size: 13.5pt; color: #d2cbee; margin-top: 5mm; max-width: 150mm; }
  .cover .foot { margin-top: auto; font-size: 9.5pt; color: #ab9fdc; border-top: 1px solid rgba(255,255,255,.15); padding-top: 5mm; }
  .cover .foot b { color: #fff; }
  .eyebrow { margin: 0 0 1.5mm; font-size: 8.5pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--gold-text); }
  .section-title { font-size: 20pt; font-weight: 800; color: var(--indigo); margin-bottom: 4mm; }
  .flow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; margin: 4mm 0 6mm; counter-reset: f; }
  .flow div { border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 6px; padding: 2.5mm 3mm; background: var(--canvas); counter-increment: f; }
  .flow div::before { content: counter(f); float: right; font-weight: 800; color: var(--gold-text); }
  .flow b { display: block; color: var(--indigo); font-size: 9.5pt; }
  .flow span { font-size: 9pt; color: var(--soft); }
  .stage { break-before: page; }
  .stage-head { border-left: 5px solid var(--tone); padding: 1mm 0 1mm 5mm; margin-bottom: 5mm; }
  .stage-head h1 { font-size: 19pt; font-weight: 800; color: var(--indigo); }
  .who { margin: 1.5mm 0 0; color: var(--soft); font-size: 10pt; }
  ol { padding-left: 6mm; margin: 3mm 0; } ol li { margin-bottom: 2mm; }
  .status { background: var(--canvas); border: 1px solid var(--line); border-radius: 6px; padding: 2.5mm 4mm; margin: 3mm 0; }
  .status span { font-size: 8pt; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--gold-text); margin-right: 2mm; }
  .note { border-left: 3px solid var(--gold); background: #fdf8e6; padding: 3mm 4mm; border-radius: 0 6px 6px 0; margin: 3mm 0 4mm; break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0 4mm; font-size: 9.6pt; break-inside: avoid; }
  th { text-align: left; background: var(--indigo); color: #fff; padding: 2mm 3mm; font-weight: 700; }
  td { border-bottom: 1px solid var(--line); padding: 2mm 3mm; vertical-align: top; }
  td:first-child { font-weight: 700; color: var(--indigo); width: 36%; }
  figure { margin: 5mm 0 0; break-inside: avoid; text-align: center; }
  figure img { max-width: 157mm; max-height: 98mm; border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 1px 3px rgba(26,12,69,.08); }
  figcaption { font-size: 8.6pt; color: var(--soft); margin-top: 1.5mm; }
  .others { break-before: page; }
  .role { border: 1px solid var(--line); border-radius: 8px; padding: 4mm 5mm; margin-bottom: 4mm; break-inside: avoid; }
  .role h2 { font-size: 12.5pt; color: var(--indigo); }
  .role p { margin: 1.5mm 0 0; }
  .role figure { margin-top: 3mm; }
  .role figure img { max-height: 80mm; }
  .tryit ol li { margin-bottom: 1.5mm; }
</style></head><body>
  <section class="cover">
    <div class="bar"></div>
    <img src="${crest}" alt="University of Ghana crest">
    <p class="inst">University of Ghana · UG-ARMS</p>
    <h1>From Transfer to Discovery</h1>
    <p class="sub">How records travel from a department to the Archives, and how they become searchable by a researcher. One example followed through every role.</p>
    <div class="foot"><b>Worked example:</b> the Department of History sends committee minutes to the Archives. All content shown is fictional demonstration data, not University of Ghana archival holdings.<br>Prepared ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Companion to <b>UG-ARMS Role Workflows</b>.</div>
  </section>

  <section>
    <p class="eyebrow">Overview</p>
    <h2 class="section-title">The journey in one line</h2>
    <p>Records pass through several people, each with their own role. No one person can take a record from a department to the public on their own: every important step has a check by someone else. That is deliberate, and it is enforced by the server, not just hidden in the menus.</p>
    <div class="flow">${flow.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>
    <h3 style="color:var(--indigo);margin:2mm 0">Three things to remember</h3>
    <ol>
      <li><b>A transfer is a proposal, an accession is custody, a description is the catalogue.</b> They are three separate records, created in that order.</li>
      <li><b>Nothing is public until it is published, at every level above it too.</b> A published file inside an unpublished collection stays hidden.</li>
      <li><b>Access level decides what the public sees.</b> Open shows everything; restricted shows identifying information only; staff-only shows nothing.</li>
    </ol>
    <div class="tryit">
      <h3 style="color:var(--indigo);margin:4mm 0 2mm">To follow along in the app</h3>
      <p>Open <code>http://localhost:5190</code> and sign in with the accounts from the separate demo credentials PDF, in this order:</p>
      <ol><li>liaison</li><li>records officer</li><li>archivist</li><li>chief archivist</li><li>archivist</li><li>digitisation officer</li><li>chief archivist</li><li>deputy archivist</li></ol>
      <p>Finish by searching from a private browser window, as the public would.</p>
    </div>
  </section>

  ${stages.map(stageHtml).join('')}

  <section class="others">
    <p class="eyebrow">The remaining roles</p>
    <h2 class="section-title">Where the other roles fit in</h2>
    ${others.map(([r, a, t, f, c]) => `<div class="role"><h2>${r}</h2><p><code>${a}</code></p><p>${t}</p>${f ? figure(f, c) : ''}</div>`).join('')}
  </section>
</body></html>`;

const htmlPath = path.join(GUIDE, 'ugarms-transfer-journey.html');
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-family:Arial;font-size:7.5pt;color:#55526a;padding:0 15mm;display:flex;justify-content:space-between"><span>UG-ARMS · From Transfer to Discovery</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
});
await browser.close();
fs.rmSync(htmlPath);
console.log(`Wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB)`);
