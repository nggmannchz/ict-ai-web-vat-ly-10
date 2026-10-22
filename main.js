/**
 * main.js — Code chung cho toàn bộ website Newton
 * Bao gồm: navbar active state, thanh tìm kiếm
 */

// ── Dữ liệu tĩnh: trang
const SEARCH_PAGES = [
  { type: 'page', label: 'Trang chủ',        url: 'index.html' },
  { type: 'page', label: 'Công thức',         url: 'formulas.html' },
  { type: 'page', label: 'Phòng thí nghiệm', url: 'lab.html' },
  { type: 'page', label: 'Máy tính SI',       url: 'calculator.html' },
  { type: 'page', label: 'Quiz',              url: 'quiz.html' },
  { type: 'page', label: 'Newton AI',         url: 'newton-ai.html' },
];

/**
 * Xây dựng SEARCH_DATA từ SUBJECTS (data/formulas.js) nếu có,
 * kết hợp với SEARCH_PAGES.
 */
function buildSearchData() {
  const formulaItems = [];
  if (typeof SUBJECTS !== 'undefined') {
    SUBJECTS.forEach(subject => {
      subject.topics.forEach(topic => {
        topic.formulas.forEach(f => {
          formulaItems.push({
            type: 'formula',
            label: `${f.name}: ${f.formula}`,
            url: `formulas.html`,
            id: f.id
          });
        });
      });
    });
  }
  return [...SEARCH_PAGES, ...formulaItems];
}

// Lazy-init: xây khi cần lần đầu
let _searchData = null;
function getSearchData() {
  if (!_searchData) _searchData = buildSearchData();
  return _searchData;
}

/**
 * Đánh dấu link navbar tương ứng với trang hiện tại.
 */
function initNavbarActiveLink() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === current) {
      link.classList.add('active');
    }
  });
}

/**
 * Khởi tạo thanh tìm kiếm trên navbar.
 */
function initSearch() {
  const input    = document.getElementById('navSearchInput');
  const dropdown = document.getElementById('navSearchDropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    renderDropdown(q);
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim().toLowerCase();
    if (q) renderDropdown(q);
  });

  // Đóng dropdown khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar__search')) {
      dropdown.classList.remove('show');
    }
  });

  // Phím Enter → đến kết quả đầu tiên
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.search-dropdown__item');
      if (first) first.click();
    }
  });
}

/**
 * Vẽ kết quả tìm kiếm vào dropdown.
 * @param {string} query - từ khóa đã lowercase
 */
function renderDropdown(query) {
  const dropdown = document.getElementById('navSearchDropdown');
  if (!dropdown) return;

  if (!query) {
    dropdown.classList.remove('show');
    dropdown.innerHTML = '';
    return;
  }

  const results = getSearchData().filter(item =>
    item.label.toLowerCase().includes(query)
  );

  if (results.length === 0) {
    dropdown.innerHTML = `<div class="search-dropdown__empty">Không tìm thấy kết quả</div>`;
    dropdown.classList.add('show');
    return;
  }

  // Tách thành 2 nhóm: trang và công thức
  const pages    = results.filter(r => r.type === 'page');
  const formulas = results.filter(r => r.type === 'formula');

  let html = '';

  if (pages.length) {
    html += `<div class="search-dropdown__section">
      <div class="search-dropdown__label">Trang</div>`;
    pages.forEach(item => {
      html += `<div class="search-dropdown__item" onclick="window.location.href='${item.url}'">
        <span>🔗</span>
        <span>${highlight(item.label, query)}</span>
        <span class="search-dropdown__item-tag">Trang</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (formulas.length) {
    html += `<div class="search-dropdown__section">
      <div class="search-dropdown__label">Công thức</div>`;
    formulas.forEach(item => {
      html += `<div class="search-dropdown__item" onclick="window.location.href='${item.url}'">
        <span>📐</span>
        <span>${highlight(item.label, query)}</span>
        <span class="search-dropdown__item-tag">CT</span>
      </div>`;
    });
    html += `</div>`;
  }

  dropdown.innerHTML = html;
  dropdown.classList.add('show');
}

/**
 * Bôi vàng phần khớp với từ khóa.
 * @param {string} text - văn bản gốc
 * @param {string} query - từ khóa
 * @returns {string} HTML với <mark>
 */
function highlight(text, query) {
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark style="background:#FEF9C3;border-radius:2px;">$1</mark>');
}

// ── Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  initNavbarActiveLink();
  initSearch();
});
