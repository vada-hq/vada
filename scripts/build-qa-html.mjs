#!/usr/bin/env node
// docs/VADA_SCREEN_QA.md → docs/VADA_SCREEN_QA.html 재생성 (의존성 없음)
// .md가 단일 소스. 사용 문법: # ## ### 제목, > 인용, - 불릿, | 표, `code`, **bold**, 셀 내 리터럴 <br>.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "docs/VADA_SCREEN_QA.md");
const outPath = join(root, "docs/VADA_SCREEN_QA.html");

const HEAD = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>VADA 화면별 QA 매트릭스</title><style>
@page { size: 11in 8.5in; margin: 0.55in; }
body { font-family: Arial, 'Apple SD Gothic Neo', sans-serif; color: #1f2937; font-size: 9pt; line-height: 1.25; }
h1 { color: #2e74b5; font-size: 21pt; margin: 0 0 8pt 0; }
h2 { color: #2e74b5; font-size: 14pt; margin: 18pt 0 7pt 0; page-break-after: avoid; }
h3 { color: #1f4d78; font-size: 11pt; margin: 12pt 0 4pt 0; page-break-after: avoid; }
p { margin: 0 0 5pt 0; } .meta { color: #556070; font-size: 8.5pt; } .bullet { margin-left: 13pt; }
table { border-collapse: collapse; width: 100%; margin: 0 0 12pt 0; table-layout: fixed; page-break-inside: auto; }
thead { display: table-header-group; } tr { page-break-inside: avoid; } th, td { border: 0.6pt solid #b8c5d2; padding: 5pt 5.5pt; vertical-align: top; word-wrap: break-word; } th { background: #e8eef5; color: #1f4d78; font-weight: bold; text-align: left; } td:first-child, th:first-child { width: 11%; } td:nth-child(2), th:nth-child(2) { width: 13%; } td:nth-child(3), th:nth-child(3) { width: 24%; } td:nth-child(4), th:nth-child(4) { width: 42%; } td:nth-child(5), th:nth-child(5) { width: 10%; text-align: center; } code { font-family: Menlo, monospace; font-size: 8pt; }
</style></head><body>`;

// 인라인: 셀 내 리터럴 <br>은 보존, 나머지 <>&는 이스케이프, `code`/**bold** 처리
function inline(s) {
  return s.split(/<br\s*\/?>/i).map(part => {
    let e = part.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    e = e.replace(/`([^`]+)`/g, "<code>$1</code>");
    e = e.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return e;
  }).join("<br>");
}

function splitRow(row) {
  const cells = row.split("|");
  cells.shift(); // 선행 |
  if (cells.length && cells[cells.length - 1].trim() === "") cells.pop(); // 후행 |
  return cells.map(c => c.trim());
}

const md = readFileSync(srcPath, "utf8");
const lines = md.split("\n");
const out = [];
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (/^\s*\|/.test(line)) {
    // 표 블록: 연속된 | 시작 행 수집
    const block = [];
    while (i < lines.length && /^\s*\|/.test(lines[i])) { block.push(lines[i]); i++; }
    const header = splitRow(block[0]);
    // 2번째 행이 |---| 구분선이면 건너뜀
    const bodyStart = (block[1] && /^\s*\|[\s:|-]+\|?\s*$/.test(block[1])) ? 2 : 1;
    let t = "<table><thead><tr>" + header.map(h => `<th>${inline(h)}</th>`).join("") + "</tr></thead><tbody>";
    for (let r = bodyStart; r < block.length; r++) {
      const cells = splitRow(block[r]);
      t += "<tr>" + cells.map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
    }
    t += "</tbody></table>";
    out.push(t);
    continue;
  }
  if (/^### /.test(line)) out.push(`<h3>${inline(line.slice(4))}</h3>`);
  else if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
  else if (/^# /.test(line)) out.push(`<h1>${inline(line.slice(2))}</h1>`);
  else if (/^> /.test(line)) out.push(`<p class="meta">${inline(line.slice(2))}</p>`);
  else if (/^- /.test(line)) out.push(`<p class="bullet">• ${inline(line.slice(2))}</p>`);
  else if (line.trim() !== "") out.push(`<p>${inline(line.trim())}</p>`);
  i++;
}

writeFileSync(outPath, HEAD + out.join("") + "</body></html>");
const tables = out.filter(o => o.startsWith("<table")).length;
console.log(`생성 완료: ${outPath}`);
console.log(`블록 ${out.length}개 (표 ${tables}개)`);
