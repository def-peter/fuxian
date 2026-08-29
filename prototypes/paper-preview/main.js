import { Previewer } from 'pagedjs';
import './prototype.css';

const variants = [
  { id: 'paged', label: 'A · Paged.js 显式页 DOM' },
  { id: 'columns', label: 'B · 原生横向多栏' },
  { id: 'markers', label: 'C · 连续流视觉页线' },
];
const search = new URLSearchParams(location.search);
const paragraph =
  '浮现需要在字体、图片、公式和图表全部结算后稳定分页，同时保留文本选择、内容目录、全文查找和图表操作。'.repeat(
    5,
  );
document.querySelectorAll('.repeat').forEach((element, index) => {
  element.textContent = `${index + 1}. ${paragraph}`;
});
const tableRows = Array.from(
  { length: Number(search.get('rows') ?? 32) },
  (_, index) => `<tr><td>${index + 1}</td><td>${paragraph.slice(0, 90)}</td></tr>`,
);
const table = document.querySelector('#table-body').closest('table');
if (tableRows.length > 8) {
  const groups = document.createDocumentFragment();
  for (let index = 0; index < tableRows.length; index += 8) {
    const group = table.cloneNode(true);
    group.querySelector('tbody').innerHTML = tableRows.slice(index, index + 8).join('');
    groups.append(group);
  }
  table.replaceWith(groups);
} else {
  document.querySelector('#table-body').innerHTML = tableRows.join('');
}
document.querySelector('#code-content').textContent = Array.from(
  { length: 10 },
  (_, index) => `const page${index + 1} = paginate(revision, { paper: 'A4' });`,
).join('\n');

const requestedVariant = search.get('variant');
const currentIndex = Math.max(
  0,
  variants.findIndex(({ id }) => id === requestedVariant),
);
const current = variants[currentIndex];
const source = document.querySelector('#source');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
document.documentElement.dataset.variant = current.id;
document.querySelector('#variant-label').textContent = current.label;

const navigate = (delta) => {
  const next = variants[(currentIndex + delta + variants.length) % variants.length];
  const nextUrl = new URL(location.href);
  nextUrl.searchParams.set('variant', next.id);
  location.href = nextUrl.toString();
};
document.querySelector('#previous').addEventListener('click', () => navigate(-1));
document.querySelector('#next').addEventListener('click', () => navigate(1));
addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, [contenteditable]')) return;
  if (event.key === 'ArrowLeft') navigate(-1);
  if (event.key === 'ArrowRight') navigate(1);
});

if (current.id === 'paged') {
  const startedAt = performance.now();
  const stylesheet = new URL('/paper.css', location.href).href;
  const flow = await new Previewer().preview(source.innerHTML, [stylesheet], preview);
  source.hidden = true;
  const selectableTextNode = preview.querySelector('svg text')?.firstChild;
  const selection = getSelection();
  if (selectableTextNode && selection) {
    const range = document.createRange();
    range.selectNodeContents(selectableTextNode);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  const result = {
    endingAnchorPresent: Boolean(preview.querySelector('#ending')),
    flowTotal: flow.total,
    hasEnding: preview.textContent.includes('FUXIAN_PAPER_PREVIEW_END'),
    pageElements: preview.querySelectorAll('.pagedjs_page').length,
    paginationMilliseconds: Math.round(performance.now() - startedAt),
    selectableText: selection?.toString() ?? '',
  };
  selection?.removeAllRanges();
  globalThis.__prototypeResult = result;
  console.log('Paged prototype result', result);
  status.textContent = `${result.pageElements} 页 · 可打印快照已就绪`;
} else {
  preview.hidden = true;
  source.className = current.id;
  status.textContent = current.id === 'columns' ? '匿名列只能横向排列' : '页线不参与内容分片';
  globalThis.__prototypeResult = { flowTotal: 0, pageElements: 0 };
}
