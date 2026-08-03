/* prevnext.js — 单期页面「前一期/后一期」导航（纯前端）
 *
 * 适用页面：日报单期 daily/YYYY-MM-DD.html、周报单期 psych_weekly_*.html
 * 逻辑：fetch 存档列表页（daily → index.html，weekly → archive.html），
 *       解析 .archive-item 顺序（存档列表是倒序：最新在上），
 *       找到当前页位置后取相邻项，在 page-header 后插入导航条。
 * 边界：最新一期「后一期」置灰，最早一期「前一期」置灰。
 * 用法：页面 </body> 前加 <script src="prevnext.js"></script>
 *       （子目录页面用 ../prevnext.js）
 */
(function () {
  'use strict';

  var path = location.pathname;
  var basename = path.split('/').pop() || '';

  // 判定页面类型
  var isDaily = /\/daily\/\d{4}-\d{2}-\d{2}\.html/.test(path);
  var isWeekly = /psych_weekly_/.test(basename);
  if (!isDaily && !isWeekly) return;

  var ARCHIVE_URL = isDaily ? 'index.html' : 'archive.html';
  var TITLE_SELECTOR = isDaily ? '.archive-date' : '.archive-week';

  /* ── 样式注入 ── */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.pn-nav {',
    '  display: flex; align-items: center; gap: 8px;',
    '  margin: 0 0 18px; padding: 10px 14px;',
    '  background: var(--bg-card, #161b22);',
    '  border: 1px solid var(--border, #21262d); border-radius: 8px;',
    '}',
    '.pn-link {',
    '  flex: 1; display: inline-flex; align-items: center; gap: 4px;',
    '  padding: 6px 10px; border-radius: 6px;',
    '  color: var(--accent, #58a6ff); text-decoration: none;',
    '  font-size: 12.5px; font-weight: 500;',
    '  transition: background .15s; white-space: nowrap; overflow: hidden;',
    '  text-overflow: ellipsis; min-width: 0;',
    '}',
    '.pn-link:hover { background: var(--accent-soft, rgba(88,166,255,.1)); color: var(--accent, #58a6ff); text-decoration: none; }',
    '.pn-link.pn-prev { justify-content: flex-start; }',
    '.pn-link.pn-next { justify-content: flex-end; }',
    '.pn-link.pn-disabled { color: var(--text-tertiary, #6e7681); cursor: default; pointer-events: none; opacity: .55; }',
    '.pn-current {',
    '  flex-shrink: 0; font-size: 12px; color: var(--text-secondary, #8b949e);',
    '  font-family: var(--font-mono, monospace); padding: 0 4px;',
    '}',
    '@media (max-width: 480px) {',
    '  .pn-current { display: none; }',
    '  .pn-link { font-size: 11.5px; padding: 6px 8px; }',
    '}'
  ].join('\n');
  document.head.appendChild(styleEl);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function buildNav(items, curIdx, curLabel) {
    var nav = document.createElement('div');
    nav.className = 'pn-nav';

    var prev = items[curIdx + 1]; // 存档倒序 → 更早一期
    var next = items[curIdx - 1]; // 更新一期

    var prevEl = document.createElement('a');
    if (prev) {
      prevEl.className = 'pn-link pn-prev';
      prevEl.href = prev.href;
      prevEl.textContent = '← 前一期 ' + prev.label;
    } else {
      prevEl.className = 'pn-link pn-prev pn-disabled';
      prevEl.setAttribute('aria-disabled', 'true');
      prevEl.textContent = '← 前一期';
    }

    var curEl = document.createElement('span');
    curEl.className = 'pn-current';
    curEl.textContent = curLabel;

    var nextEl = document.createElement('a');
    if (next) {
      nextEl.className = 'pn-link pn-next';
      nextEl.href = next.href;
      nextEl.textContent = '后一期 ' + next.label + ' →';
    } else {
      nextEl.className = 'pn-link pn-next pn-disabled';
      nextEl.setAttribute('aria-disabled', 'true');
      nextEl.textContent = '后一期 →';
    }

    nav.appendChild(prevEl);
    nav.appendChild(curEl);
    nav.appendChild(nextEl);
    return nav;
  }

  function inject(nav) {
    var header = document.querySelector('header.page-header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(nav, header.nextSibling);
      return true;
    }
    var main = document.querySelector('main, .main');
    if (main) {
      main.insertBefore(nav, main.firstChild);
      return true;
    }
    return false;
  }

  fetch(ARCHIVE_URL, { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var items = Array.prototype.slice.call(doc.querySelectorAll('.archive-item')).map(function (el) {
        var href = el.getAttribute('href') || '';
        var labelEl = el.querySelector(TITLE_SELECTOR);
        var label = labelEl ? (labelEl.textContent || '').replace(/\s+/g, ' ').trim() : href;
        return { href: href, label: label };
      });
      if (!items.length) return;

      var curIdx = -1;
      items.forEach(function (it, i) {
        if (it.href === basename) curIdx = i;
      });
      if (curIdx === -1) return; // 当前页不在存档列表（理论上不会）

      // 当前期标签
      var curLabel = items[curIdx].label;

      var nav = buildNav(items, curIdx, curLabel);
      inject(nav);
      // 注意：存档列表页与当前页同目录（daily/ 或根目录），
      // 其 href 裸文件名相对当前页解析天然正确，不需要加 ../ 前缀。
      // （daily/2026-08-02.html 里的 index.html 存档链接 "2026-08-03.html"
      //   解析为 /daily/2026-08-03.html，正确。）
    })
    .catch(function () { /* 静默失败：存档列表不可用则不显示导航 */ });
})();
