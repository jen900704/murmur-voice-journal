// Test-only stand-ins for the helpers in js/app.js (same contracts).
import { createLanguageView } from '../../js/language-view.js';

function h(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
function add(parent, ...kids) {
  parent.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return parent;
}
const lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh-TW';
document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant-TW';
const getLang = () => lang;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
}
let sheetFn = null;
function renderSheet() {
  const sheet = document.getElementById('sheet');
  sheet.hidden = false;
  sheet.innerHTML = '';
  document.getElementById('main').setAttribute('inert', '');
  const body = h('div', { class: 'sheet-body', role: 'dialog', 'aria-modal': 'true' }, h('button', { type: 'button', class: 'link back', onclick: closeSheet }, lang === 'en' ? 'Back' : '返回'));
  add(body, sheetFn(renderSheet));
  const head = body.querySelector('h2');
  if (head) {
    head.id = 'sheet-title';
    body.setAttribute('aria-labelledby', head.id);
  }
  sheet.appendChild(body);
  body.querySelector('.back').focus();
}
function closeSheet() {
  const sheet = document.getElementById('sheet');
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.getElementById('main').removeAttribute('inert');
}
function openSheet(fn) {
  sheetFn = fn;
  renderSheet();
}
const useSheet = new URLSearchParams(location.search).get('sheet') !== '0';
const view = createLanguageView({ h, add, getLang, toast, openSheet: useSheet ? openSheet : undefined });
document.getElementById('main').appendChild(view.view());
window.__languageView = view;
