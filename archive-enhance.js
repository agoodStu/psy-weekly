/* archive-enhance.js — 存档列表页增强（纯前端）
 *
 * 适用页面：archive.html（周报存档）与 daily/index.html（日报存档）
 * 功能：
 *   1. 每期自动 fetch 对应 HTML，提取标题做预览（前 5 条 + 展开全部）
 *   2. 顶部搜索框：按标题/日期实时过滤
 *   3. 按月分组（日报 53 期时尤其有用），默认展开最近一组
 * 自包含：注入样式 + 渐进式加载（预览逐期填充），无后端依赖。
 * 用法：在存档列表页 </body> 前加 <script src="archive-enhance.js"></script>
 */
(function () {
  'use strict';

  var list = document.querySelector('.archive-list');
  if (!list) return;
  var items = Array.prototype.slice.call(list.querySelectorAll('.archive-item'));
  if (!items.length) return;

  var isWeekly = /psych_weekly/i.test(items[0].getAttribute('href') || '');
  var TITLE_SELECTOR = isWeekly ? '.card-title' : '.item-title';
  var PREVIEW_N = 5;
  var CONCURRENCY = 6;

  /* ── 样式注入 ── */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.archive-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }',
    '.archive-search {',
    '  flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 8px;',
    '  border: 1px solid var(--border, #21262d); background: var(--bg-card, #161b22);',
    '  color: var(--text, #c9d1d9); font-size: 13.5px; outline: none;',
    '  transition: border-color .15s;',
    '}',
    '.archive-search:focus { border-color: var(--accent, #58a6ff); }',
    '.archive-search::placeholder { color: var(--text-tertiary, #6e7681); }',
    '.archive-group { margin-bottom: 8px; }',
    '.archive-group-head {',
    '  display: flex; align-items: center; gap: 8px; padding: 10px 4px 6px;',
    '  font-size: 13px; font-weight: 600; color: var(--accent, #58a6ff);',
    '  cursor: pointer; user-select: none;',
    '}',
    '.archive-group-head .group-arrow { transition: transform .15s; font-size: 10px; }',
    '.archive-group-head.collapsed .group-arrow { transform: rotate(-90deg); }',
    '.archive-group-head .group-count { color: var(--text-tertiary, #6e7681); font-weight: 400; font-size: 12px; }',
    '.archive-group.collapsed .archive-items { display: none; }',
    '.archive-item { position: relative; display: block; }',
    '.archive-preview {',
    '  padding: 4px 12px 12px 44px; font-size: 12.5px; color: var(--text-secondary, #8b949e);',
    '  border-left: 2px solid var(--divider, #21262d); margin: 0 8px 12px 20px;',
    '}',
    '.archive-preview.loading { color: var(--text-tertiary, #6e7681); font-style: italic; }',
    '.archive-preview .pv-title { display: block; padding: 2.5px 0; line-height: 1.5; }',
    '.archive-preview .pv-title::before { content: "· "; color: var(--accent, #58a6ff); }',
    '.archive-preview .pv-more {',
    '  background: none; border: none; color: var(--accent, #58a6ff);',
    '  font-size: 12px; cursor: pointer; padding: 4px 0 0; margin-top: 2px;',
    '}',
    '.archive-preview .pv-more:hover { text-decoration: underline; }',
    '.archive-preview .pv-empty { color: var(--text-tertiary, #6e7681); }',
    '.archive-no-match { padding: 24px; text-align: center; color: var(--text-tertiary, #6e7681); font-size: 13px; }',
    '.archive-item.filtered-out { display: none !important; }',
    '.archive-group.filtered-out { display: none !important; }'
  ].join('\n');
  document.head.appendChild(styleEl);

  /* ── 搜索框 ── */
  var toolbar = document.createElement('div');
  toolbar.className = 'archive-toolbar';
  var searchBox = document.createElement('input');
  searchBox.className = 'archive-search';
  searchBox.type = 'search';
  searchBox.placeholder = isWeekly ? '🔍 搜索往期论文标题/日期…' : '🔍 搜索往期标题/日期…';
  toolbar.appendChild(searchBox);
  list.parentNode.insertBefore(toolbar, list);

  /* ── 按月分组（重组 DOM，保留原链接）── */
  var groups = {};      // key: '2026-08' → {head, container, items: []}
  var order = [];

  function groupKeyOf(item) {
    var href = item.getAttribute('href') || '';
    var m = href.match(/(\d{4})-(\d{2})/);
    return m ? m[1] + '-' + m[2] : 'other';
  }

  function buildGroups() {
    items.forEach(function (item) {
      var key = groupKeyOf(item);
      if (!groups[key]) {
        groups[key] = { head: null, container: null, items: [] };
        order.push(key);
      }
      groups[key].items.push(item);
    });
    order.sort().reverse(); // 新月份在前

    // 把 archive-list 内容换成分组结构
    list.innerHTML = '';
    order.forEach(function (key, i) {
      var g = groups[key];
      var groupEl = document.createElement('div');
      groupEl.className = 'archive-group' + (i === 0 ? '' : ' collapsed');
      groupEl.setAttribute('data-group', key);

      var head = document.createElement('div');
      head.className = 'archive-group-head' + (i === 0 ? '' : ' collapsed');
      var [y, mo] = key.split('-');
      head.innerHTML = '<span class="group-arrow">▼</span><span>' + y + '年' + parseInt(mo, 10) + '月</span>' +
        '<span class="group-count">' + g.items.length + ' 期</span>';
      head.addEventListener('click', function () {
        groupEl.classList.toggle('collapsed');
        head.classList.toggle('collapsed');
      });
      g.head = head;

      var container = document.createElement('div');
      container.className = 'archive-items';
      g.items.forEach(function (item) {
        container.appendChild(item);
        // 每期后追加预览容器
        var pv = document.createElement('div');
        pv.className = 'archive-preview loading';
        pv.textContent = '加载预览…';
        item.parentNode.insertBefore(pv, item.nextSibling);
        item._previewEl = pv;
        item._titles = [];
      });
      g.container = container;

      groupEl.appendChild(head);
      groupEl.appendChild(container);
      list.appendChild(groupEl);
    });
  }

  /* ── fetch 并提取标题 ── */
  function fetchTitles(item) {
    var href = item.getAttribute('href');
    return fetch(href, { credentials: 'same-origin' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var titles = Array.prototype.slice.call(doc.querySelectorAll(TITLE_SELECTOR))
          .map(function (el) {
            var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
            // 日报条目里 title 可能含日期小标，去掉
            t = t.replace(/\s*\(\d{4}\.\d{2}\.\d{2}\)\s*$/, '');
            return t;
          })
          .filter(function (t) { return t && t.length > 1; });
        item._titles = titles;
        return titles;
      })
      .catch(function () {
        item._titles = [];
        return [];
      });
  }

  function renderPreview(item) {
    var pv = item._previewEl;
    if (!pv) return;
    var titles = item._titles;
    if (!titles.length) {
      pv.className = 'archive-preview';
      pv.innerHTML = '<span class="pv-empty">（无内容预览）</span>';
      return;
    }
    var shown = titles.slice(0, PREVIEW_N);
    var more = titles.length - PREVIEW_N;
    pv.className = 'archive-preview';
    pv.innerHTML = shown.map(function (t) { return '<span class="pv-title">' + esc(t) + '</span>'; }).join('') +
      (more > 0 ? '<button class="pv-more">展开全部 ' + titles.length + ' 条</button>' : '');
    var moreBtn = pv.querySelector('.pv-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        pv.innerHTML = titles.map(function (t) { return '<span class="pv-title">' + esc(t) + '</span>'; }).join('');
      });
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── 搜索过滤 ── */
  function applySearch(q) {
    q = (q || '').trim().toLowerCase();
    var any = false;
    items.forEach(function (item) {
      var hay = (item.textContent + ' ' + item._titles.join(' ')).toLowerCase();
      var match = !q || hay.indexOf(q) !== -1;
      item.classList.toggle('filtered-out', !match);
      if (match) any = true;
    });
    // 组内无匹配则整组隐藏
    order.forEach(function (key) {
      var g = groups[key];
      var has = g.items.some(function (it) { return !it.classList.contains('filtered-out'); });
      list.querySelector('.archive-group[data-group="' + key + '"]').classList.toggle('filtered-out', !has);
      if (has) any = true;
    });
    var noMatch = list.parentNode.querySelector('.archive-no-match');
    if (!q) {
      if (noMatch) noMatch.remove();
      return;
    }
    if (!any && !noMatch) {
      noMatch = document.createElement('div');
      noMatch.className = 'archive-no-match';
      noMatch.textContent = '未找到匹配的往期内容';
      list.parentNode.insertBefore(noMatch, list.nextSibling);
    } else if (any && noMatch) {
      noMatch.remove();
    }
  }

  searchBox.addEventListener('input', function () { applySearch(this.value); });

  /* ── 渐进式加载（并发受限）── */
  function loadAll() {
    var idx = 0;
    function next() {
      if (idx >= items.length) return;
      var item = items[idx++];
      fetchTitles(item).then(function () {
        renderPreview(item);
        next();
      });
    }
    for (var i = 0; i < Math.min(CONCURRENCY, items.length); i++) next();
  }

  /* ── init ── */
  buildGroups();
  loadAll();
})();
