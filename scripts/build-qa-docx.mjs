#!/usr/bin/env node
// docs/VADA_SCREEN_QA.md → docs/VADA_SCREEN_QA.docx 재생성 (의존성 없음, 순수 Node)
// .docx = OOXML(WordprocessingML) 파트들을 ZIP으로 조립. zlib(deflate)+수동 CRC32 사용.
// 지원 문법: # ## ### 제목, > 인용, - 불릿, | 표, `code`, **bold**, 셀 내 리터럴 <br>.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import zlib from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "docs/VADA_SCREEN_QA.md");
const outPath = join(root, "docs/VADA_SCREEN_QA.docx");

// ── 페이지/색상 (HTML과 일치) ─────────────────────────────
const PAGE_W = 15840, PAGE_H = 12240, MARGIN = 792;      // 11in×8.5in 가로, 0.55in 여백 (twips)
const CONTENT_W = PAGE_W - MARGIN * 2;                    // 14256
const COL5 = [1568, 1853, 3421, 5988, 1426];             // 11/13/24/42/10%
const C_H12 = "2E74B5", C_H3 = "1F4D78", C_META = "556070";
const C_HDR_FILL = "E8EEF5", C_HDR_TEXT = "1F4D78", C_BORDER = "B8C5D2";

// ── XML 이스케이프 ────────────────────────────────────────
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── 인라인 런 생성 (baseRpr = 모든 런에 공통 적용할 rPr 조각 배열) ──
function textRun(t, { baseRpr = [], code = false, bold = false } = {}) {
  if (t === "") return "";
  const rpr = [...baseRpr];
  if (code) rpr.unshift('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
  if (bold && !baseRpr.some(x => x.includes("<w:b/>"))) rpr.push("<w:b/>");
  const x = rpr.length ? `<w:rPr>${rpr.join("")}</w:rPr>` : "";
  return `<w:r>${x}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
}
function runs(s, baseRpr = []) {
  const out = [];
  for (const part of s.split(/(<br\s*\/?>)/i)) {
    if (/^<br/i.test(part)) {
      const x = baseRpr.length ? `<w:rPr>${baseRpr.join("")}</w:rPr>` : "";
      out.push(`<w:r>${x}<w:br/></w:r>`);
      continue;
    }
    let idx = 0;
    const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
    let m;
    while ((m = re.exec(part))) {
      if (m.index > idx) out.push(textRun(part.slice(idx, m.index), { baseRpr }));
      if (m[1] !== undefined) out.push(textRun(m[1], { baseRpr, code: true }));
      else out.push(textRun(m[2], { baseRpr, bold: true }));
      idx = m.index + m[0].length;
    }
    if (idx < part.length) out.push(textRun(part.slice(idx), { baseRpr }));
  }
  return out.join("") || '<w:r><w:t xml:space="preserve"></w:t></w:r>';
}

// ── 문단 종류 ────────────────────────────────────────────
function heading(text, level) {
  const cfg = { 1: { sz: 42, color: C_H12, sp: '<w:spacing w:before="0" w:after="160"/>' },
                2: { sz: 28, color: C_H12, sp: '<w:spacing w:before="360" w:after="140"/>' },
                3: { sz: 22, color: C_H3, sp: '<w:spacing w:before="240" w:after="80"/>' } }[level];
  const base = [`<w:b/>`, `<w:color w:val="${cfg.color}"/>`, `<w:sz w:val="${cfg.sz}"/>`, `<w:szCs w:val="${cfg.sz}"/>`];
  return `<w:p><w:pPr>${cfg.sp}<w:keepNext/></w:pPr>${runs(text, base)}</w:p>`;
}
function metaPara(text) {
  const base = [`<w:color w:val="${C_META}"/>`, `<w:sz w:val="17"/>`, `<w:szCs w:val="17"/>`];
  return `<w:p><w:pPr><w:spacing w:after="100"/></w:pPr>${runs(text, base)}</w:p>`;
}
function bulletPara(text) {
  return `<w:p><w:pPr><w:ind w:left="260"/><w:spacing w:after="60"/></w:pPr>${runs("• " + text)}</w:p>`;
}
function plainPara(text) {
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${runs(text)}</w:p>`;
}
const EMPTY_P = "<w:p/>";

// ── 표 ──────────────────────────────────────────────────
function colWidths(n) {
  if (n === 5) return COL5;
  const base = Math.floor(CONTENT_W / n);
  const w = Array(n).fill(base);
  w[n - 1] = CONTENT_W - base * (n - 1);
  return w;
}
function cell(text, widthTw, isHeader) {
  const shd = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="${C_HDR_FILL}"/>` : "";
  const base = isHeader ? [`<w:b/>`, `<w:color w:val="${C_HDR_TEXT}"/>`] : [];
  const pPr = `<w:pPr><w:spacing w:after="0"/></w:pPr>`;
  return `<w:tc><w:tcPr><w:tcW w:w="${widthTw}" w:type="dxa"/>${shd}</w:tcPr><w:p>${pPr}${runs(text, base)}</w:p></w:tc>`;
}
function table(header, rows) {
  const n = header.length;
  const widths = colWidths(n);
  const side = d => `<w:${d} w:val="single" w:sz="4" w:space="0" w:color="${C_BORDER}"/>`;
  const borders = `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(side).join("")}</w:tblBorders>`;
  const grid = `<w:tblGrid>${widths.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const hRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map((h, i) => cell(h, widths[i], true)).join("")}</w:tr>`;
  const bRows = rows.map(r => {
    const cells = [];
    for (let i = 0; i < n; i++) cells.push(cell(r[i] ?? "", widths[i], false));
    return `<w:tr>${cells.join("")}</w:tr>`;
  }).join("");
  const pr = `<w:tblPr><w:tblW w:w="${CONTENT_W}" w:type="dxa"/><w:tblLayout w:type="fixed"/>${borders}</w:tblPr>`;
  return `<w:tbl>${pr}${grid}${hRow}${bRows}</w:tbl>` + EMPTY_P;
}

// ── 마크다운 → 블록 XML ──────────────────────────────────
function splitRow(row) {
  const c = row.split("|");
  c.shift();
  if (c.length && c[c.length - 1].trim() === "") c.pop();
  return c.map(x => x.trim());
}
function buildBody(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      const block = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { block.push(lines[i]); i++; }
      const header = splitRow(block[0]);
      const start = block[1] && /^\s*\|[\s:|-]+\|?\s*$/.test(block[1]) ? 2 : 1;
      out.push(table(header, block.slice(start).map(splitRow)));
      continue;
    }
    if (/^### /.test(line)) out.push(heading(line.slice(4), 3));
    else if (/^## /.test(line)) out.push(heading(line.slice(3), 2));
    else if (/^# /.test(line)) out.push(heading(line.slice(2), 1));
    else if (/^> /.test(line)) out.push(metaPara(line.slice(2)));
    else if (/^- /.test(line)) out.push(bulletPara(line.slice(2)));
    else if (line.trim() !== "") out.push(plainPara(line.trim()));
    i++;
  }
  const sect = `<w:sectPr><w:pgSz w:w="${PAGE_W}" w:h="${PAGE_H}" w:orient="landscape"/>` +
    `<w:pgMar w:top="${MARGIN}" w:right="${MARGIN}" w:bottom="${MARGIN}" w:left="${MARGIN}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;
  return out.join("") + sect;
}

// ── OOXML 파트 ──────────────────────────────────────────
const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
function documentXml(body) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W_NS}><w:body>${body}</w:body></w:document>`;
}
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/><w:lang w:val="ko-KR"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

// ── ZIP (수동 CRC32 + deflate) ──────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(entries) {
  const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (8 << 5) | 14; // 고정 날짜(결정적 출력)
  const chunks = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, "utf8");
    const data = Buffer.from(e.data, "utf8");
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10); cd.writeUInt16LE(DOS_TIME, 12); cd.writeUInt16LE(DOS_DATE, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));
    offset += local.length + nameBuf.length + comp.length;
  }
  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, centralBuf, eocd]);
}

// ── 실행 ────────────────────────────────────────────────
const md = readFileSync(srcPath, "utf8");
const body = buildBody(md);
const zip = makeZip([
  { name: "[Content_Types].xml", data: CONTENT_TYPES },
  { name: "_rels/.rels", data: RELS },
  { name: "word/document.xml", data: documentXml(body) },
  { name: "word/styles.xml", data: STYLES },
  { name: "word/_rels/document.xml.rels", data: DOC_RELS },
]);
writeFileSync(outPath, zip);
const tbl = (body.match(/<w:tbl>/g) || []).length;
const rows = (body.match(/<w:tr>/g) || []).length;
console.log(`생성 완료: ${outPath} (${zip.length} bytes)`);
console.log(`표 ${tbl}개, 행 ${rows}개(헤더 포함)`);
