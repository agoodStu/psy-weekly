/* fold-extra.js — 周报普通文章折叠 + 紧凑阅读模式（纯前端，self-contained）
 *
 * 适用页面：周报 index.html / psych_weekly_*.html（含 .timeline-field[data-field] 的页面）
 *          日报页面无此结构，脚本自动跳过。
 * 行为（方案 D）：
 *   1. 默认折叠：所有非精选卡片（.card:not(.card-featured)）隐藏
 *   2. 每个领域头注入「展开 N 篇」按钮 → 该领域普通卡片显示为紧凑列表
 *      （只留 期刊+IF+分数+标题+收藏，摘要/元数据/标签隐藏）
 *   3. 紧凑卡片点一下展开完整摘要，再点收回紧凑
 *   4. 领域筛选（chip/侧边栏/底部sheet）时自动展开该领域为紧凑列表
 *   5. 搜索 ≥2 字符时全部展开为完整卡片，清空搜索恢复折叠
 * 用法：</body> 前加 <script src="fold-extra.js"></script>
 */
(function () {
  'use strict';

  var sections = document.querySelectorAll('.timeline-field[data-field]');
  if (!sections.length) return; // 非周报页（日报等）直接跳过

  var searchBox = document.getElementById('search-box');

  /* ── 样式注入 ── */
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.fold-btn {',
    '  margin-left: auto; flex-shrink: 0;',
    '  padding: 3px 10px; border: 1px solid var(--accent, #58a6ff);',
    '  border-radius: 999px; background: transparent;',
    '  color: var(--accent, #58a6ff); font-size: 11.5px; cursor: pointer;',
    '  transition: background .15s, color .15s; white-space: nowrap;',
    '}',
    '.fold-btn:hover { background: var(--accent-soft, rgba(88,166,255,.12)); }',
    '.fold-btn.fold-on { background: var(--accent, #58a6ff); color: #fff; }',
    /* 折叠态：普通卡片隐藏（!important 压过 filter 的 visible 逻辑） */
    '.card.collapsed { display: none !important; }',
    /* 紧凑态：只留头部 + 标题 */
    '.card.compact { padding: 8px 14px; margin-bottom: 6px; cursor: pointer; }',
    '.card.compact .card-head { margin-bottom: 2px; }',
    '.card.compact .card-summary,',
    '.card.compact .card-meta,',
    '.card.compact .card-tags,',
    '.card.compact .card-divider { display: none !important; }',
    '.card.compact .card-title { font-size: 13.5px; line-height: 1.45; margin: 0; }',
    '@media (max-width: 768px) {',
    '  .card.compact { padding: 7px 10px; }',
    '  .card.compact .card-title { font-size: 13px; }',
    '}'
  ].join('\n');
  document.head.appendChild(styleEl);

  /* ── 收集普通卡片（领域区内非精选） ── */
  var normalCards = Array.prototype.slice.call(
    document.querySelectorAll('.timeline-field[data-field] .card:not(.card-featured)')
  );
  if (!normalCards.length) return;

  /* ── 每个领域头注入展开按钮 ── */
  sections.forEach(function (section) {
    var cards = section.querySelectorAll('.card:not(.card-featured)');
    if (!cards.length) return;
    var head = section.querySelector('.timeline-field-head');
    if (!head || head.querySelector('.fold-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'fold-btn';
    btn.dataset.field = section.dataset.field;
    btn.textContent = '展开 ' + cards.length + ' 篇';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var on = !btn.classList.contains('fold-on');
      cards.forEach(function (card) {
        if (on) {
          card.classList.remove('collapsed');
          card.classList.add('compact');
        } else {
          card.classList.add('collapsed');
          card.classList.remove('compact');
        }
      });
      btn.classList.toggle('fold-on', on);
      btn.textContent = on ? '收起' : '展开 ' + cards.length + ' 篇';
    });
    head.appendChild(btn);
  });

  /* ── 紧凑卡片：点一下展开完整，再点收回 ── */
  normalCards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      if (card.classList.contains('collapsed')) return;
      if (e.target.closest('.fav-btn')) return; // 收藏按钮不触发展开
      var link = e.target.closest('a');
      if (card.classList.contains('compact')) {
        if (link) e.preventDefault(); // 紧凑态点标题=展开，不跳 DOI
        card.classList.remove('compact');
      } else {
        if (link) return; // 完整态链接照常跳转
        card.classList.add('compact'); // 点空白收回紧凑
      }
    });
  });

  /* ── 与筛选/搜索联动 ──
   * 注意：领域 chips 是模板 JS 动态创建的，applyFilter 不会 toggle 它们的
   * .active（只 toggle 静态的"全部"chip），所以不能依赖 .filter-chip.active
   * 判断当前筛选领域——由本脚本自己记录点击来源。 */
  var lastField = 'all';

  function syncFoldState() {
    var q = (searchBox && searchBox.value || '').trim().toLowerCase();
    var searching = q.length >= 2;
    var field = lastField;
    var showAll = field === 'all';

    normalCards.forEach(function (card) {
      if (searching) {
        // 搜索中：命中卡片完整显示（collapsed/compact 都去掉）
        card.classList.remove('collapsed', 'compact');
      } else if (!showAll && card.dataset.field === field) {
        // 领域筛选：该领域紧凑展开
        card.classList.remove('collapsed');
        card.classList.add('compact');
      } else {
        // 默认/全部：折叠
        card.classList.add('collapsed');
        card.classList.remove('compact');
      }
    });

    // 按钮文字与状态同步
    sections.forEach(function (section) {
      var btn = section.querySelector('.fold-btn');
      if (!btn) return;
      var cards = section.querySelectorAll('.card:not(.card-featured)');
      var on = !showAll && btn.dataset.field === field && !searching;
      btn.classList.toggle('fold-on', on);
      btn.textContent = on ? '收起' : '展开 ' + cards.length + ' 篇';
    });
  }

  // 任何筛选入口点击后同步折叠状态（内联 applyFilter 先执行，本监听后执行）
  document.addEventListener('click', function (e) {
    var t = e.target;
    var chip = t.closest('.filter-chip');
    var link = t.closest('.side-link[data-field]');
    var sheet = t.closest('.sheet-field');
    var allBtn = t.closest('#filter-all');
    if (chip) {
      lastField = chip.dataset.field;
    } else if (link) {
      lastField = link.dataset.field;
    } else if (sheet) {
      lastField = sheet.dataset.field;
    } else if (allBtn) {
      lastField = 'all';
    } else {
      return;
    }
    syncFoldState();
  });
  if (searchBox) {
    searchBox.addEventListener('input', syncFoldState);
  }

  // 初始默认折叠
  syncFoldState();
})();
