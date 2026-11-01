/**
 * Builds docs/user-guide/UG-ARMS-Role-Workflows.pdf from docs/user-guide/guide-content.mjs and the captured
 * screenshots.
 *
 * Run `node scripts/capture-user-guide.mjs` first (against freshly reset demonstration data), then `node
 * scripts/build-user-guide.mjs`. Screenshots are reduced to 1,600 pixels wide, and the guide is rendered from HTML
 * to PDF with Google Chrome.
 *
 * @author Kwasi Adabo Boakye
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GUIDE = path.join(ROOT, 'docs/user-guide');
const { meta, intro, roles, chapters, glossary } = await import(
  pathToFileURL(path.join(GUIDE, 'guide-content.mjs')).href
);
const crest = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'frontend/public/brand/ug-crest.png')).toString('base64')}`;

// sharp lives in the backend workspace; screenshots are downscaled to 1600 px wide (about 240 dpi at print width).
const sharp = createRequire(path.join(ROOT, 'backend/package.json'))('sharp');
const shots = {};
for (const c of chapters)
  for (const st of c.steps) {
    const file = path.join(GUIDE, 'screenshots', `${st.shot}.jpg`);
    if (fs.existsSync(file))
      shots[st.shot] =
        `data:image/jpeg;base64,${(await sharp(file).resize({ width: 1600 }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()).toString('base64')}`;
  }
const missing = chapters
  .flatMap((c) => c.steps.map((s) => s.shot))
  .filter((s) => !fs.existsSync(path.join(GUIDE, 'screenshots', `${s}.jpg`)));
if (missing.length) {
  console.error(`Missing screenshots: ${missing.join(', ')}`);
  process.exit(1);
}

/**
 * Escapes ampersands that do not already start an HTML entity.
 *
 * @param {*} s Text.
 * @returns {string}
 */
const esc = (s) => String(s).replace(/&(?!\w+;)/g, '&amp;');
const ROLE_TONE = {
  visitor: '#5a47b0',
  researcher: '#5a47b0',
  liaison: '#8a6a0c',
  officer: '#8a6a0c',
  archivist: '#2b1471',
  chief: '#2b1471',
  digitisation: '#3a2490',
  readingroom: '#3a2490',
  auditor: '#55526a',
  admin: '#55526a',
};

const flows = [
  {
    title: 'From department to public catalogue',
    steps: [
      ['Liaison', 'Prepares and submits transfer'],
      ['Records Officer', 'Reviews and accepts lines'],
      ['Records Officer', 'Creates accession'],
      ['Archivist', 'Completes and submits accession'],
      ['Chief Archivist', 'Approves accession'],
      ['Archivist', 'Catalogues and uploads files'],
      ['Chief Archivist', 'Approves and publishes'],
      ['Deputy', 'Second approval to open access'],
      ['Visitor', 'Finds and cites it'],
    ],
  },
  {
    title: 'From research request to returned box',
    steps: [
      ['Researcher', 'Requests restricted access'],
      ['Archivist', 'First approval with conditions'],
      ['Chief Archivist', 'Second approval'],
      ['Researcher', 'Books a visit'],
      ['Reading Room', 'Checks identity'],
      ['Reading Room', 'Issues by barcode'],
      ['Reading Room', 'Receives and records condition'],
    ],
  },
  {
    title: 'Digitisation',
    steps: [
      ['Archivist', 'Plans project and batch'],
      ['Chief Archivist', 'Approves project'],
      ['Digitisation', 'Captures and uploads'],
      ['System', 'Checksums, copies, OCR'],
      ['Digitisation', 'Corrects and approves OCR'],
      ['Another reviewer', 'Quality assurance'],
    ],
  },
  {
    title: 'Retention and disposal',
    steps: [
      ['Records Officer', 'Opens appraisal case'],
      ['Chief Archivist', 'Approves recommendation'],
      ['Records Officer', 'Creates disposal case and dry run'],
      ['Two approvers', 'Approve the exact dry run'],
      ['Legal hold', 'Blocks everything not yet executed'],
    ],
  },
];

/**
 * Renders one role's chapter: its summary, what the role can and cannot do, and each step with its screenshot.
 *
 * @param {object} c Chapter content.
 * @param {number} n Chapter number.
 * @returns {string} HTML.
 */
const chapterHtml = (c, n) => `
  <section class="chapter" id="${c.id}">
    <div class="chapter-head" style="--tone:${ROLE_TONE[c.id] || '#2b1471'}">
      <p class="eyebrow">Chapter ${n}</p>
      <h1>${esc(c.title)}</h1>
      <p class="summary">${c.summary}</p>
    </div>
    <div class="cancannot">
      <div><h3>Can</h3><ul>${c.can.map((x) => `<li>${x}</li>`).join('')}</ul></div>
      <div class="cannot"><h3>Cannot</h3><ul>${c.cannot.map((x) => `<li>${x}</li>`).join('')}</ul></div>
    </div>
    ${c.steps
      .map(
        (s, i) => `
      <article class="step">
        <div class="step-text"><span class="num">${n}.${i + 1}</span><div><h2>${esc(s.title)}</h2><p>${s.text}</p></div></div>
        <figure><img src="${shots[s.shot]}" alt="${esc(s.title)}"><figcaption>Figure ${n}.${i + 1} · ${esc(s.title)}</figcaption></figure>
      </article>`,
      )
      .join('')}
  </section>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(meta.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  @page :first { margin: 0; }
  :root { --indigo:#2b1471; --indigo-900:#1a0c45; --gold:#dfb725; --gold-text:#8a6a0c; --ink:#1e1c2b; --soft:#55526a; --line:#e5e3ee; --canvas:#f7f6fa; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Manrope, 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 10.5pt; line-height: 1.5; }
  h1, h2, h3 { margin: 0; letter-spacing: -0.01em; }
  b { font-weight: 700; }
  code { font-family: Menlo, monospace; font-size: 9pt; background: var(--canvas); border: 1px solid var(--line); border-radius: 4px; padding: 0 3px; }
  .cover { height: 297mm; background: var(--indigo-900); color: #fff; padding: 28mm 22mm; display: flex; flex-direction: column; position: relative; overflow: hidden; break-after: page; }
  .cover::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 18mm 18mm; }
  .cover > * { position: relative; }
  .cover .bar { position: absolute; left: 0; right: 0; top: 0; height: 4mm; background: var(--gold); }
  .cover img { width: 46mm; }
  .cover .inst { margin-top: 10mm; color: var(--gold); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 9.5pt; }
  .cover h1 { font-size: 34pt; line-height: 1.1; margin-top: 4mm; font-weight: 800; }
  .cover .sub { font-size: 14pt; color: #d2cbee; margin-top: 5mm; max-width: 140mm; }
  .cover .foot { margin-top: auto; font-size: 9.5pt; color: #ab9fdc; border-top: 1px solid rgba(255,255,255,.15); padding-top: 5mm; }
  .cover .foot b { color: #fff; }
  .page { break-before: page; }
  .eyebrow { margin: 0 0 1.5mm; font-size: 8.5pt; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--gold-text); }
  .section-title { font-size: 20pt; font-weight: 800; color: var(--indigo); margin-bottom: 4mm; }
  .lead p { margin: 0 0 3mm; }
  ul.conv { padding-left: 5mm; } ul.conv li { margin-bottom: 1.5mm; }
  .principles { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 4mm; }
  .principles div { border: 1px solid var(--line); border-left: 3px solid var(--gold); border-radius: 2mm; padding: 3mm 4mm; background: #fff; break-inside: avoid; }
  .principles h3 { font-size: 10.5pt; color: var(--indigo); margin-bottom: 1mm; }
  .principles p { margin: 0; font-size: 9.5pt; color: var(--soft); }
  table { width: 100%; border-collapse: collapse; font-size: 9.3pt; }
  th { text-align: left; background: var(--indigo); color: #fff; padding: 2.2mm 3mm; font-weight: 700; }
  td { padding: 2.2mm 3mm; border-bottom: 1px solid var(--line); vertical-align: top; }
  tr:nth-child(even) td { background: var(--canvas); }
  td:first-child { font-weight: 700; color: var(--indigo); white-space: nowrap; }
  .toc ol { padding-left: 0; list-style: none; counter-reset: c; columns: 2; column-gap: 8mm; }
  .toc li { counter-increment: c; padding: 2mm 0; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .toc li::before { content: counter(c); display: inline-block; width: 7mm; font-weight: 800; color: var(--gold-text); }
  .toc a { color: var(--ink); text-decoration: none; font-weight: 600; }
  .toc span { color: var(--soft); font-size: 9pt; }
  .flow { margin: 0 0 6mm; break-inside: avoid; }
  .flow h3 { font-size: 11pt; color: var(--indigo); margin-bottom: 2.5mm; }
  .flow ol { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 1.5mm; }
  .flow li { position: relative; background: var(--canvas); border: 1px solid var(--line); border-radius: 2mm; padding: 2mm 3mm; font-size: 8.6pt; width: 39mm; }
  .flow li b { display: block; color: var(--gold-text); font-size: 7.6pt; letter-spacing: .06em; text-transform: uppercase; }
  .flow li:not(:last-child)::after { content: '›'; position: absolute; right: -1.6mm; top: 50%; transform: translateY(-55%); color: var(--indigo); font-weight: 800; font-size: 11pt; }
  .chapter { break-before: page; }
  .chapter-head { background: var(--tone); color: #fff; border-radius: 3mm; padding: 7mm 8mm; position: relative; overflow: hidden; }
  .chapter-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1.6mm; background: var(--gold); }
  .chapter-head .eyebrow { color: var(--gold); }
  .chapter-head h1 { font-size: 22pt; font-weight: 800; }
  .chapter-head .summary { margin: 3mm 0 0; color: #ece9f7; font-size: 10.3pt; }
  .chapter-head .summary b { color: #fff; }
  .cancannot { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 5mm 0 2mm; break-inside: avoid; }
  .cancannot > div { border: 1px solid var(--line); border-radius: 2mm; padding: 3mm 4mm; }
  .cancannot h3 { font-size: 9pt; text-transform: uppercase; letter-spacing: .1em; color: #1d7a4a; margin-bottom: 1mm; }
  .cancannot .cannot h3 { color: #b42318; }
  .cancannot ul { margin: 0; padding-left: 4.5mm; font-size: 9.3pt; } .cancannot li { margin: .8mm 0; }
  .step { break-inside: avoid; margin-top: 5mm; }
  .step-text { display: flex; gap: 3.5mm; align-items: flex-start; }
  .num { flex: none; min-width: 10mm; height: 7mm; padding: 0 1.5mm; border-radius: 1.5mm; background: var(--indigo); color: var(--gold); font-weight: 800; font-size: 9.5pt; display: inline-flex; align-items: center; justify-content: center; margin-top: .5mm; }
  .step h2 { font-size: 12pt; color: var(--indigo); font-weight: 800; }
  .step p { margin: 1mm 0 0; }
  figure { margin: 2.5mm 0 0; width: 157mm; }
  figure img { width: 100%; max-height: 98mm; object-fit: contain; object-position: left top; display: block; border: 1px solid var(--line); border-radius: 2mm; box-shadow: 0 1mm 3mm rgba(26,12,69,.08); }
  figcaption { font-size: 8pt; color: var(--soft); margin-top: 1.5mm; }
</style></head><body>
<section class="cover">
  <div class="bar"></div>
  <img src="${crest}" alt="University of Ghana crest">
  <p class="inst">University of Ghana, Legon · Archives</p>
  <h1>${esc(meta.title)}</h1>
  <p class="sub">${esc(meta.subtitle)}</p>
  <div class="foot"><b>For:</b> ${esc(meta.audience)}<br><b>Version:</b> ${esc(meta.version)}<br>All screenshots show fictional demonstration data.</div>
</section>

<section class="toc">
  <p class="eyebrow">Contents</p>
  <h2 class="section-title">In this guide</h2>
  <ol>
    <li><a href="#intro">How to use this guide</a><br><span>Purpose, conventions and principles</span></li>
    <li><a href="#roles">Who does what</a><br><span>The roles and how work passes between them</span></li>
    ${chapters.map((c) => `<li><a href="#${c.id}">${esc(c.title)}</a><br><span>${c.steps.length} steps</span></li>`).join('')}
    <li><a href="#glossary">Glossary</a><br><span>Terms used in this guide</span></li>
  </ol>
</section>

<section class="page lead" id="intro">
  <p class="eyebrow">Introduction</p>
  <h2 class="section-title">How to use this guide</h2>
  ${intro.purpose.map((p) => `<p>${p}</p>`).join('')}
  <ul class="conv">${intro.conventions.map((c) => `<li>${c}</li>`).join('')}</ul>
  <h3 style="margin-top:6mm;color:var(--indigo)">Principles that apply to everyone</h3>
  <div class="principles">${intro.principles.map(([h, p]) => `<div><h3>${esc(h)}</h3><p>${p}</p></div>`).join('')}</div>
</section>

<section class="page" id="roles">
  <p class="eyebrow">Overview</p>
  <h2 class="section-title">Who does what</h2>
  <table><thead><tr><th>Role</th><th>Typically held by</th><th>Main work</th></tr></thead>
  <tbody>${roles.map(([r, w, m]) => `<tr><td>${esc(r)}</td><td>${esc(w)}</td><td>${esc(m)}</td></tr>`).join('')}</tbody></table>
  </section>
<section class="page">
  <p class="eyebrow">Overview</p>
  <h2 class="section-title">How work passes between roles</h2>
  <p style="margin:0 0 5mm">Most work in UG-ARMS moves from one role to another. These maps show the four main processes; each box names who acts and what they do. The chapters that follow explain every step.</p>
  ${flows.map((f) => `<div class="flow"><h3>${esc(f.title)}</h3><ol>${f.steps.map(([who, what]) => `<li><b>${esc(who)}</b>${esc(what)}</li>`).join('')}</ol></div>`).join('')}
</section>

${chapters.map((c, i) => chapterHtml(c, i + 1)).join('')}

<section class="page" id="glossary">
  <p class="eyebrow">Reference</p>
  <h2 class="section-title">Glossary</h2>
  <table><tbody>${glossary.map(([t, d]) => `<tr><td>${esc(t)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>
</section>
</body></html>`;

const htmlPath = path.join(GUIDE, 'ugarms-role-workflows.html');
fs.writeFileSync(htmlPath, html);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const out = path.join(GUIDE, 'UG-ARMS-Role-Workflows.pdf');
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5pt;color:#55526a;padding:0 15mm;display:flex;justify-content:space-between"><span>${esc(meta.title)} · University of Ghana Archives</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
});
await browser.close();
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
