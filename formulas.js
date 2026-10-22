/**
 * js/formulas.js
 * Logic trang Công thức (formulas.html)
 * Phụ thuộc: data/formulas.js (phải load trước)
 */

/* ── State ────────────────────────────────── */
let currentSubjectId = null;   // chuyên đề đang chọn
let currentTopicId   = null;   // mục con đang chọn (null = tất cả chuyên đề)
let currentTag       = 'all';  // tag lọc đang chọn

/* ── DOM helpers ──────────────────────────── */
const $ = id => document.getElementById(id);

/* ── Khởi động ────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  // Mặc định chọn chuyên đề đầu tiên
  if (SUBJECTS.length > 0) {
    selectSubject(SUBJECTS[0].id);
  }
});

/* ══════════════════════════════════════════
   BUILD SIDEBAR
   ══════════════════════════════════════════ */
function buildSidebar() {
  const container = $('sidebarSubjects');
  if (!container) return;

  container.innerHTML = SUBJECTS.map(subject => `
    <div class="sidebar__subject" id="subject-group-${subject.id}">
      <button
        class="sidebar__subject-btn"
        id="subject-btn-${subject.id}"
        onclick="toggleSubject('${subject.id}')"
        aria-expanded="false"
        aria-controls="topics-${subject.id}"
      >
        <span class="sidebar__subject-icon" aria-hidden="true">${subject.icon}</span>
        ${subject.name}
        <span class="sidebar__subject-chevron" aria-hidden="true">▶</span>
      </button>

      <div class="sidebar__topics" id="topics-${subject.id}" role="list">
        ${subject.topics.map(topic => `
          <button
            class="sidebar__topic-btn"
            id="topic-btn-${topic.id}"
            onclick="selectTopic('${subject.id}', '${topic.id}')"
            role="listitem"
          >
            ${topic.name}
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   CHỌN CHUYÊN ĐỀ (mở accordion + hiện tất cả topic)
   ══════════════════════════════════════════ */
function selectSubject(subjectId) {
  currentSubjectId = subjectId;
  currentTopicId   = null;
  currentTag       = 'all';

  // Cập nhật sidebar UI
  document.querySelectorAll('.sidebar__subject-btn').forEach(btn => {
    btn.classList.remove('active', 'open');
    btn.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.sidebar__topics').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.sidebar__topic-btn').forEach(btn => btn.classList.remove('active'));

  const subjectBtn    = $(`subject-btn-${subjectId}`);
  const topicsSection = $(`topics-${subjectId}`);
  if (subjectBtn)    { subjectBtn.classList.add('active', 'open'); subjectBtn.setAttribute('aria-expanded', 'true'); }
  if (topicsSection) topicsSection.classList.add('open');

  renderContent();
}

/* ══════════════════════════════════════════
   MỞ / ĐÓNG ACCORDION CHUYÊN ĐỀ
   ══════════════════════════════════════════ */
function toggleSubject(subjectId) {
  const isAlreadySelected = currentSubjectId === subjectId;
  if (isAlreadySelected) {
    // Toggle đóng/mở accordion mà không đổi nội dung
    const topicsSection = $(`topics-${subjectId}`);
    const subjectBtn    = $(`subject-btn-${subjectId}`);
    if (topicsSection) {
      const isOpen = topicsSection.classList.contains('open');
      topicsSection.classList.toggle('open', !isOpen);
      subjectBtn?.classList.toggle('open', !isOpen);
      subjectBtn?.setAttribute('aria-expanded', String(!isOpen));
    }
  } else {
    selectSubject(subjectId);
  }
}

/* ══════════════════════════════════════════
   CHỌN TOPIC CỤ THỂ
   ══════════════════════════════════════════ */
function selectTopic(subjectId, topicId) {
  currentSubjectId = subjectId;
  currentTopicId   = topicId;
  currentTag       = 'all';

  // Cập nhật sidebar
  document.querySelectorAll('.sidebar__subject-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.sidebar__topic-btn').forEach(btn => btn.classList.remove('active'));

  const subjectBtn = $(`subject-btn-${subjectId}`);
  const topicBtn   = $(`topic-btn-${topicId}`);
  if (subjectBtn) subjectBtn.classList.add('active', 'open');
  if (topicBtn)   topicBtn.classList.add('active');

  // Đảm bảo accordion mở
  const topicsSection = $(`topics-${subjectId}`);
  if (topicsSection) topicsSection.classList.add('open');

  renderContent();
}

/* ══════════════════════════════════════════
   LỌC THEO TAG
   ══════════════════════════════════════════ */
function filterByTag(tag) {
  currentTag = tag;

  // Cập nhật UI tag buttons
  document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tag === tag);
  });

  applyTagFilter();
}

/* Áp dụng filter lên các thẻ công thức đã render */
function applyTagFilter() {
  const cards = document.querySelectorAll('.formula-card');
  let anyVisible = false;

  cards.forEach(card => {
    const tags = (card.dataset.tags || '').split(',');
    const show = currentTag === 'all' || tags.includes(currentTag);
    card.classList.toggle('hidden', !show);
    if (show) anyVisible = true;
  });

  // Ẩn/hiện tiêu đề topic nếu không có thẻ nào visible
  document.querySelectorAll('.formula-topic-header').forEach(header => {
    const nextCards = [];
    let el = header.nextElementSibling;
    while (el && !el.classList.contains('formula-topic-header')) {
      if (el.classList.contains('formula-card')) nextCards.push(el);
      el = el.nextElementSibling;
    }
    const hasVisible = nextCards.some(c => !c.classList.contains('hidden'));
    header.classList.toggle('hidden', !hasVisible);
  });

  // Hiện thông báo nếu không có kết quả
  const emptyEl = $('formulasEmpty');
  if (emptyEl) emptyEl.classList.toggle('hidden', anyVisible);
}

/* ══════════════════════════════════════════
   RENDER NỘI DUNG CHÍNH
   ══════════════════════════════════════════ */
function renderContent() {
  const subject = SUBJECTS.find(s => s.id === currentSubjectId);
  if (!subject) return;

  // Xác định topics sẽ hiển thị
  const topics = currentTopicId
    ? subject.topics.filter(t => t.id === currentTopicId)
    : subject.topics;

  // --- Header ---
  const topicName = currentTopicId
    ? (subject.topics.find(t => t.id === currentTopicId)?.name || '')
    : '';

  $('contentBreadcrumb').innerHTML =
    `Vật Lý 10 &rsaquo; <span>${subject.name}</span>${topicName ? ` &rsaquo; <span>${topicName}</span>` : ''}`;

  $('contentTitle').textContent =
    topicName ? topicName.toUpperCase() : subject.name.toUpperCase();

  $('contentSubtitle').textContent =
    `${countFormulas(topics)} công thức`;

  // --- Tags ---
  renderTagBar(topics);

  // --- Danh sách công thức ---
  renderFormulaList(topics);
}

/* Đếm tổng số công thức trong mảng topics */
function countFormulas(topics) {
  return topics.reduce((sum, t) => sum + t.formulas.length, 0);
}

/* Build tag bar dựa trên các tag có trong topics hiện tại */
function renderTagBar(topics) {
  const tagBar = $('tagBar');
  if (!tagBar) return;

  // Gom tất cả tags
  const tagSet = new Set(['all']);
  topics.forEach(topic => {
    topic.formulas.forEach(f => {
      (f.tags || []).forEach(tag => tagSet.add(tag));
    });
  });

  // Map hiển thị
  const TAG_LABELS = {
    all: 'Tất cả', v: 'Vận tốc (v)', s: 'Quãng đường (s)',
    a: 'Gia tốc (a)', t: 'Thời gian (t)', F: 'Lực (F)',
    m: 'Khối lượng (m)', E: 'Năng lượng (E)', p: 'Động lượng (p)'
  };

  tagBar.innerHTML = [...tagSet].map(tag => `
    <button
      class="tag-btn${currentTag === tag ? ' active' : ''}"
      data-tag="${tag}"
      onclick="filterByTag('${tag}')"
    >${TAG_LABELS[tag] || tag}</button>
  `).join('');
}

/* Build danh sách thẻ công thức */
function renderFormulaList(topics) {
  const listEl = $('formulaList');
  if (!listEl) return;

  if (topics.length === 0 || topics.every(t => t.formulas.length === 0)) {
    listEl.innerHTML = `
      <div class="formulas-empty" id="formulasEmpty">
        <div class="formulas-empty__icon">📭</div>
        <div class="formulas-empty__text">Không có công thức nào</div>
        <div class="formulas-empty__sub">Hãy chọn chuyên đề khác ở thanh bên trái.</div>
      </div>`;
    return;
  }

  const showTopicHeaders = topics.length > 1;

  listEl.innerHTML = topics.map(topic => `
    ${showTopicHeaders
      ? `<div class="formula-topic-header" id="header-${topic.id}">${topic.name}</div>`
      : ''}
    ${topic.formulas.map(f => renderFormulaCard(f)).join('')}
  `).join('') + `
    <div class="formulas-empty hidden" id="formulasEmpty">
      <div class="formulas-empty__icon">🔍</div>
      <div class="formulas-empty__text">Không tìm thấy công thức</div>
      <div class="formulas-empty__sub">Thử chọn tag khác hoặc xem tất cả.</div>
    </div>`;

  // Áp dụng tag filter hiện tại
  applyTagFilter();
}

/* Render một thẻ công thức */
function renderFormulaCard(formula) {
  // Escape HTML cơ bản
  const safe = str => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Chú thích: tách theo ";" mỗi phần tử một dòng
  const varLines = formula.variables
    .split(';')
    .map(v => v.trim())
    .filter(Boolean)
    .map(v => {
      // In đậm phần trước dấu ":"
      const colonIdx = v.indexOf(':');
      if (colonIdx !== -1) {
        return `<strong>${safe(v.slice(0, colonIdx + 1))}</strong>${safe(v.slice(colonIdx + 1))}`;
      }
      return safe(v);
    })
    .join('<br>');

  return `
    <div class="formula-card" data-tags="${formula.tags.join(',')}" id="card-${formula.id}">
      <div class="formula-card__body">
        <div class="formula-card__name">${safe(formula.name)}</div>
        <div class="formula-card__formula" aria-label="Công thức: ${safe(formula.formula)}">${safe(formula.formula)}</div>
        <div class="formula-card__variables">${varLines}</div>
        <div class="formula-card__note">${safe(formula.note)}</div>
      </div>
      <div class="formula-card__action">
        <button
          class="btn btn-primary"
          onclick="goToCalculator('${formula.id}')"
          title="Chuyển sang Máy tính SI với công thức này"
        >
          🧮 Máy tính SI
        </button>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   CHUYỂN SANG MÁY TÍNH SI
   Lưu formulaId vào localStorage để calculator.html đọc
   ══════════════════════════════════════════ */
function goToCalculator(formulaId) {
  localStorage.setItem('newton_selectedFormula', formulaId);
  window.location.href = 'calculator.html';
}

/* ══════════════════════════════════════════
   TÌM KIẾM TEXT TRONG TẤT CẢ CÔNG THỨC
   (Tính năng Nice-to-have 6)
   ══════════════════════════════════════════ */

let searchQuery = ''; // từ khóa tìm kiếm hiện tại

/**
 * Gọi khi người dùng gõ vào ô search.
 * @param {string} raw - giá trị input thô
 */
function searchFormulas(raw) {
  searchQuery = raw.trim();

  const clearBtn  = $('formulaSearchClear');
  const hintEl    = $('formulaSearchHint');
  const tagBarEl  = $('tagBar');

  if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';

  if (!searchQuery) {
    // Trở lại chế độ bình thường
    if (tagBarEl) tagBarEl.classList.remove('search-active');
    renderContent();
    return;
  }

  // Mờ tag bar khi đang search
  if (tagBarEl) tagBarEl.classList.add('search-active');

  // Gom tất cả công thức từ toàn bộ SUBJECTS
  const allFormulas = [];
  SUBJECTS.forEach(subject => {
    subject.topics.forEach(topic => {
      topic.formulas.forEach(f => {
        allFormulas.push({ formula: f, subjectName: subject.name, topicName: topic.name });
      });
    });
  });

  // Chuẩn hóa để so sánh (bỏ dấu, lowercase)
  const normalizeStr = s => s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const q = normalizeStr(searchQuery);

  const matches = allFormulas.filter(({ formula }) => {
    const haystack = normalizeStr(
      formula.name + ' ' + formula.formula + ' ' + formula.variables + ' ' + formula.note
    );
    return haystack.includes(q);
  });

  // Cập nhật header
  if ($('contentBreadcrumb')) $('contentBreadcrumb').innerHTML = `Vật Lý 10 &rsaquo; <span>Tìm kiếm</span>`;
  if ($('contentTitle'))      $('contentTitle').textContent = `KẾT QUẢ TÌM KIẾM`;
  if ($('contentSubtitle'))   $('contentSubtitle').textContent = `${matches.length} công thức khớp với "${raw}"`;

  // Hint
  if (hintEl) {
    hintEl.textContent = matches.length
      ? `Tìm thấy ${matches.length} công thức`
      : 'Không tìm thấy kết quả. Thử từ khóa khác.';
  }

  // Render kết quả
  renderSearchResults(matches, raw);
}

/**
 * Render danh sách kết quả tìm kiếm.
 */
function renderSearchResults(matches, raw) {
  const listEl = $('formulaList');
  if (!listEl) return;

  if (matches.length === 0) {
    listEl.innerHTML = `
      <div class="formulas-empty">
        <div class="formulas-empty__icon">🔍</div>
        <div class="formulas-empty__text">Không tìm thấy công thức nào</div>
        <div class="formulas-empty__sub">Thử gõ: "vận tốc", "F = ma", "động năng"...</div>
      </div>`;
    return;
  }

  listEl.innerHTML = matches.map(({ formula, subjectName, topicName }) => {
    // Render card với highlight từ khóa
    return renderFormulaCardHighlighted(formula, raw, `${subjectName} › ${topicName}`);
  }).join('');
}

/**
 * Render thẻ công thức có highlight từ khớp.
 */
function renderFormulaCardHighlighted(formula, query, breadcrumb) {
  const safe = str => str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const highlight = str => {
    const safeStr = safe(str);
    const safeQ   = safe(query);
    // Tìm không phân biệt dấu — dùng regex đơn giản trên bản đã safe
    const regex = new RegExp(`(${safeQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return safeStr.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  const varLines = formula.variables
    .split(';').map(v => v.trim()).filter(Boolean)
    .map(v => {
      const ci = v.indexOf(':');
      if (ci !== -1) {
        return `<strong>${safe(v.slice(0, ci + 1))}</strong>${safe(v.slice(ci + 1))}`;
      }
      return safe(v);
    }).join('<br>');

  return `
    <div class="formula-card" data-tags="${formula.tags.join(',')}" id="card-${formula.id}">
      <div class="formula-card__body">
        <div class="formula-card__name" style="display:flex;align-items:center;gap:8px;">
          ${highlight(formula.name)}
          <span style="font-size:0.72rem;color:var(--gray-400);font-weight:400;margin-left:auto;">${safe(breadcrumb)}</span>
        </div>
        <div class="formula-card__formula">${highlight(formula.formula)}</div>
        <div class="formula-card__variables">${varLines}</div>
        <div class="formula-card__note">${safe(formula.note)}</div>
      </div>
      <div class="formula-card__action">
        <button class="btn btn-primary"
                onclick="goToCalculator('${formula.id}')"
                title="Chuyển sang Máy tính SI với công thức này">
          🧮 Máy tính SI
        </button>
      </div>
    </div>`;
}

/**
 * Xóa ô tìm kiếm và trở về trạng thái bình thường.
 */
function clearSearch() {
  const input = $('formulaSearchInput');
  if (input) input.value = '';
  searchFormulas('');
}
