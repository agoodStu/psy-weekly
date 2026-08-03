/* favorites.js — psy-weekly 收藏功能（纯前端 localStorage）
 *
 * 自包含：注入样式 + 动态挂载 ☆ 按钮到周报卡片(.timeline-card)与日报条目(.item)
 * 任何页面只需 <script src="favorites.js"></script> 即可启用。
 * 收藏页 favorites.html 通过 #fav-list 容器渲染收藏列表。
 *
 * localStorage key: psy_weekly_favs = [{id,type,title,url,journal,date,summary,ts}]
 *   type: 'weekly' | 'daily'
 */
(function () {
  'use strict';

  var KEY = 'psy_weekly_favs';

  /* ── 样式注入（不依赖页面 CSS）── */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.fav-btn {',
    '  background: none; border: none; cursor: pointer;',
    '  font-size: 16px; line-height: 1; padding: 2px 4px; margin: 0;',
    '  color: var(--text-tertiary, #6e7681); border-radius: 4px;',
    '  transition: color .15s, transform .15s;',
    '}',
    '.fav-btn:hover { color: var(--accent-yellow, #d29922); transform: scale(1.15); }',
    '.fav-btn.fav-on { color: #e3b341; }',
    '.card-head-right .fav-btn { margin-right: 6px; order: -1; }',
    '.item .fav-btn { margin-left: auto; align-self: center; flex-shrink: 0; }',
    '',
    '/* 收藏页 */',
    '.fav-page { max-width: 760px; margin: 0 auto; padding: 24px 16px 84px; }',
    '.fav-page h1 { font-size: 22px; margin: 0 0 4px; font-family: var(--font-serif, serif); }',
    '.fav-page .fav-sub { color: var(--text-secondary, #8b949e); font-size: 12px; margin-bottom: 20px; }',
    '.fav-empty { text-align: center; color: var(--text-secondary, #8b949e); padding: 60px 20px; font-size: 14px; }',
    '.fav-card { background: var(--bg-card, #161b22); border: 1px solid var(--border, #21262d);',
    '  border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }',
    '.fav-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }',
    '.fav-type { font-size: 11px; padding: 1px 8px; border-radius: 10px;',
    '  background: var(--accent-soft, rgba(88,166,255,.12)); color: var(--accent, #58a6ff);',
    '  font-family: var(--font-mono, monospace); flex-shrink: 0; }',
    '.fav-title { font-size: 15px; font-weight: 600; line-height: 1.45; }',
    '.fav-title a { color: var(--text, #c9d1d9); text-decoration: none; }',
    '.fav-title a:hover { color: var(--accent, #58a6ff); text-decoration: underline; text-underline-offset: 3px; }',
    '.fav-meta { font-size: 12px; color: var(--text-secondary, #8b949e); margin-top: 6px; }',
    '.fav-summary { font-size: 13px; color: var(--text-secondary, #8b949e); margin-top: 8px; line-height: 1.6; }',
    '.fav-remove { background: none; border: 1px solid var(--border, #30363d); color: var(--text-secondary, #8b949e);',
    '  border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer; margin-top: 10px;',
    '  transition: color .15s, border-color .15s; }',
    '.fav-remove:hover { color: #f85149; border-color: #f85149; }',
    '.fav-clear { background: none; border: 1px solid var(--border, #30363d); color: var(--text-tertiary, #6e7681);',
    '  border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer; margin-left: 8px; }',
    '.fav-clear:hover { color: #f85149; border-color: #f85149; }'
  ].join('\n');
  document.head.appendChild(styleEl);

  /* ── localStorage 读写 ── */
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function isFav(id) {
    return load().some(function (f) { return f.id === id; });
  }

  /* ── 周报卡片注入 ☆ ── */
  function injectWeeklyButtons() {
    document.querySelectorAll('.timeline-card').forEach(function (card) {
      if (card.querySelector('.fav-btn')) return;
      var headRight = card.querySelector('.card-head-right');
      if (!headRight) return;
      var titleEl = card.querySelector('.card-title');
      if (!titleEl) return;
      var title = titleEl.textContent.trim();
      var url = titleEl.getAttribute('href') || '';
      var journalEl = card.querySelector('.card-journal');
      var journal = journalEl ? journalEl.textContent.trim() : '';
      var dateEl = card.querySelector('.card-date');
      var date = dateEl ? dateEl.textContent.trim() : '';
      var sumEl = card.querySelector('.card-summary');
      var summary = sumEl ? sumEl.textContent.trim() : '';
      var id = url || ('weekly:' + title);
      var btn = makeBtn(id, 'weekly');
      btn.title = isFav(id) ? '取消收藏' : '收藏';
      btn.setAttribute('aria-label', btn.title);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var favs = load();
        var idx = favs.findIndex(function (f) { return f.id === id; });
        if (idx >= 0) {
          favs.splice(idx, 1);
          btn.textContent = '☆';
          btn.classList.remove('fav-on');
          btn.title = '收藏';
        } else {
          favs.push({ id: id, type: 'weekly', title: title, url: url,
                      journal: journal, date: date, summary: summary, ts: Date.now() });
          btn.textContent = '★';
          btn.classList.add('fav-on');
          btn.title = '取消收藏';
        }
        save(favs);
      });
      headRight.appendChild(btn);
    });
  }

  /* ── 日报条目注入 ☆ ── */
  function injectDailyButtons() {
    document.querySelectorAll('.item').forEach(function (item) {
      if (item.querySelector('.fav-btn')) return;
      var titleEl = item.querySelector('.item-title a, .item-title');
      if (!titleEl) return;
      var a = item.querySelector('.item-title a');
      var title = titleEl.textContent.trim();
      var url = a ? (a.getAttribute('href') || '') : '';
      var idxEl = item.querySelector('.item-idx');
      var idx = idxEl ? idxEl.textContent.trim() : '';
      var dateEl = item.querySelector('.item-date');
      var date = dateEl ? dateEl.textContent.trim().replace(/[()]/g, '') : '';
      var descEl = item.querySelector('.item-desc');
      var summary = descEl ? descEl.textContent.trim() : '';
      var id = url || ('daily:' + idx + ':' + title);
      var btn = makeBtn(id, 'daily');
      btn.title = isFav(id) ? '取消收藏' : '收藏';
      btn.setAttribute('aria-label', btn.title);
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var favs = load();
        var i = favs.findIndex(function (f) { return f.id === id; });
        if (i >= 0) {
          favs.splice(i, 1);
          btn.textContent = '☆';
          btn.classList.remove('fav-on');
          btn.title = '收藏';
        } else {
          favs.push({ id: id, type: 'daily', title: title, url: url,
                      journal: '', date: date, summary: summary, ts: Date.now() });
          btn.textContent = '★';
          btn.classList.add('fav-on');
          btn.title = '取消收藏';
        }
        save(favs);
      });
      item.appendChild(btn);
    });
  }

  function makeBtn(id, type) {
    var btn = document.createElement('button');
    btn.className = 'fav-btn' + (isFav(id) ? ' fav-on' : '');
    btn.textContent = isFav(id) ? '★' : '☆';
    btn.setAttribute('data-fav-id', id);
    btn.setAttribute('data-fav-type', type);
    return btn;
  }

  /* ── 收藏页渲染 ── */
  function renderFavPage() {
    var listEl = document.getElementById('fav-list');
    if (!listEl) return;
    var favs = load().sort(function (a, b) { return b.ts - a.ts; });
    var countEl = document.getElementById('fav-count');
    if (countEl) countEl.textContent = favs.length;
    if (!favs.length) {
      listEl.innerHTML = '<div class="fav-empty">还没有收藏。<br>在周报卡片或日报条目上点 ☆ 即可收藏，收藏后在这里统一查看。</div>';
      return;
    }
    var html = favs.map(function (f) {
      var typeLabel = f.type === 'daily' ? '日报' : '周报';
      var titleHtml = f.url
        ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.title) + ' ↗</a>'
        : esc(f.title);
      var meta = [];
      if (f.journal) meta.push(esc(f.journal));
      if (f.date) meta.push(esc(f.date));
      var summaryHtml = f.summary
        ? '<div class="fav-summary">' + esc(f.summary) + '</div>' : '';
      return '<div class="fav-card" data-fav-id="' + esc(f.id) + '">' +
        '<div class="fav-card-head"><span class="fav-type">' + typeLabel + '</span>' +
        '<span class="fav-title">' + titleHtml + '</span></div>' +
        (meta.length ? '<div class="fav-meta">' + meta.join(' · ') + '</div>' : '') +
        summaryHtml +
        '<button class="fav-remove" data-id="' + esc(f.id) + '">取消收藏</button>' +
        '</div>';
    }).join('');
    listEl.innerHTML = html;

    listEl.querySelectorAll('.fav-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var favs = load().filter(function (f) { return f.id !== id; });
        save(favs);
        renderFavPage();
      });
    });
    var clearBtn = document.getElementById('fav-clear');
    if (clearBtn) clearBtn.style.display = favs.length ? '' : 'none';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── 初始化 ── */
  function init() {
    injectWeeklyButtons();
    injectDailyButtons();
    renderFavPage();
    var clearBtn = document.getElementById('fav-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        save([]);
        renderFavPage();
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
