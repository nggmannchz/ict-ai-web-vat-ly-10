/**
 * js/newton-ai.js — Logic Newton AI Chatbot
 * Phụ thuộc: data/newton-ai.js (AI_RULES, AI_FALLBACK, AI_SUGGESTIONS)
 *
 * Cơ chế: Keyword Matching (không cần API)
 *   1. Người dùng nhập câu hỏi → lowercase
 *   2. Duyệt qua AI_RULES, kiểm tra .includes() từng keyword
 *   3. Lấy response của rule khớp đầu tiên, hoặc AI_FALLBACK
 *   4. Hiện hiệu ứng "đang gõ..." (setTimeout 1s) rồi hiện câu trả lời
 *   5. Lịch sử lưu vào localStorage (key: newton_chatHistory)
 */

/* ── Hằng số ──────────────────────────────── */
const STORAGE_KEY   = 'newton_chatHistory';
const TYPING_DELAY  = 1000; // ms

/* ── State ──────────────────────────────────── */
let chatHistory = [];   // [{role:'user'|'ai', text, tag, time}]
let isBotTyping = false;

/* ── Khởi động ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  buildSuggestions();
  renderHistory();

  // Enter gửi tin nhắn (Shift+Enter xuống dòng)
  const input = document.getElementById('aiInput');
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Giữ focus
  input.focus();
});

/* ══════════════════════════════════════════
   BUILD GỢI Ý SIDEBAR
   ══════════════════════════════════════════ */
function buildSuggestions() {
  const container = document.getElementById('suggestionList');
  container.innerHTML = AI_SUGGESTIONS.map(s => `
    <button class="ai-sidebar__item"
            onclick="sendSuggestion('${s.query.replace(/'/g, "\\'")}')"
            aria-label="Gợi ý: ${s.label}">
      <span class="ai-sidebar__item-icon">💬</span>
      ${s.label}
    </button>`
  ).join('');
}

/* ══════════════════════════════════════════
   GỬI GỢI Ý TỪ SIDEBAR
   ══════════════════════════════════════════ */
function sendSuggestion(query) {
  const input = document.getElementById('aiInput');
  input.value = query;
  sendMessage();
}

/* ══════════════════════════════════════════
   KHUNG CHAT MỚI
   ══════════════════════════════════════════ */
function newChat() {
  if (chatHistory.length === 0) return;
  chatHistory = [];
  saveHistory();
  renderHistory();
  document.getElementById('aiInput').focus();
}

/* ══════════════════════════════════════════
   GỬI TIN NHẮN
   ══════════════════════════════════════════ */
function sendMessage() {
  if (isBotTyping) return;

  const input = document.getElementById('aiInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';

  // Thêm tin học sinh
  const userMsg = { role: 'user', text, time: nowTime() };
  chatHistory.push(userMsg);
  appendMessage(userMsg);

  // Cuộn xuống
  scrollToBottom();

  // Hiện typing indicator
  showTyping();
  isBotTyping = true;
  document.getElementById('aiSendBtn').disabled = true;

  // Tìm câu trả lời
  const { response, tag } = findResponse(text);

  // Sau delay hiện câu trả lời AI
  setTimeout(() => {
    hideTyping();
    isBotTyping = false;
    document.getElementById('aiSendBtn').disabled = false;

    const aiMsg = { role: 'ai', text: response, tag, time: nowTime() };
    chatHistory.push(aiMsg);
    appendMessage(aiMsg);
    saveHistory();
    updateHistoryList();
    scrollToBottom();
    document.getElementById('aiInput').focus();
  }, TYPING_DELAY);
}

/* ══════════════════════════════════════════
   TÌM CÂU TRẢ LỜI (Keyword Matching)
   ══════════════════════════════════════════ */
function findResponse(userText) {
  const lower = userText.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu để so sánh dễ hơn
    .toLowerCase();

  // Bản đồ từ có dấu → không dấu cho từ khóa
  const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  for (const rule of AI_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(normalize(kw))) {
        return { response: rule.response, tag: rule.tag };
      }
    }
  }
  return { response: AI_FALLBACK, tag: '🤔 Chưa rõ' };
}

/* ══════════════════════════════════════════
   RENDER TIN NHẮN
   ══════════════════════════════════════════ */
function appendMessage(msg) {
  const container = document.getElementById('aiMessages');

  // Xóa welcome message nếu còn
  const welcome = container.querySelector('.welcome-msg');
  if (welcome) welcome.remove();

  const el = document.createElement('div');
  el.className = `msg ${msg.role}`;
  el.setAttribute('role', 'article');

  if (msg.role === 'ai') {
    el.innerHTML = `
      <div class="msg__avatar" aria-hidden="true">🤖</div>
      <div>
        ${msg.tag ? `<div class="msg__tag">${msg.tag}</div>` : ''}
        <div class="msg__bubble">${msg.text}</div>
      </div>
      <span class="msg__time" aria-label="Thời gian">${msg.time}</span>`;
  } else {
    el.innerHTML = `
      <span class="msg__time" aria-label="Thời gian">${msg.time}</span>
      <div class="msg__bubble">${escapeHtml(msg.text)}</div>
      <div class="msg__avatar" aria-hidden="true">👤</div>`;
  }

  container.appendChild(el);
}

function renderHistory() {
  const container = document.getElementById('aiMessages');
  container.innerHTML = '';

  if (chatHistory.length === 0) {
    container.innerHTML = `
      <div class="welcome-msg" role="region" aria-label="Màn hình chào">
        <div class="welcome-msg__icon">🤖</div>
        <div class="welcome-msg__title">Xin chào! Thầy là Newton AI</div>
        <div class="welcome-msg__sub">
          Hỏi thầy về bất kỳ chủ đề Vật lý 10 nào,<br>
          hoặc bấm vào gợi ý bên trái để bắt đầu.
        </div>
      </div>`;
    return;
  }

  chatHistory.forEach(msg => appendMessage(msg));
  scrollToBottom();
}

/* ══════════════════════════════════════════
   TYPING INDICATOR
   ══════════════════════════════════════════ */
function showTyping() {
  const container = document.getElementById('aiMessages');
  const el = document.createElement('div');
  el.className = 'typing-indicator msg ai';
  el.id = 'typingIndicator';
  el.setAttribute('aria-label', 'Newton AI đang trả lời');
  el.innerHTML = `
    <div class="msg__avatar" aria-hidden="true">🤖</div>
    <div class="msg__bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  container.appendChild(el);
  scrollToBottom();
}

function hideTyping() {
  document.getElementById('typingIndicator')?.remove();
}

/* ══════════════════════════════════════════
   LỊCH SỬ CHAT (localStorage)
   ══════════════════════════════════════════ */
function saveHistory() {
  try {
    // Chỉ lưu 50 tin nhắn gần nhất
    const toSave = chatHistory.slice(-50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (_) { /* quota vượt → bỏ qua */ }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) chatHistory = JSON.parse(raw);
  } catch (_) { chatHistory = []; }
}

function updateHistoryList() {
  const container = document.getElementById('historyList');
  // Lấy các tin nhắn của học sinh (tối đa 6 gần nhất)
  const userMsgs = chatHistory
    .filter(m => m.role === 'user')
    .slice(-6)
    .reverse();

  if (userMsgs.length === 0) {
    container.innerHTML = `<div style="padding:8px 16px;font-size:0.8rem;color:var(--gray-400)">Chưa có lịch sử</div>`;
    return;
  }

  container.innerHTML = userMsgs.map(m => `
    <button class="ai-sidebar__item"
            onclick="sendSuggestion('${m.text.replace(/'/g, "\\'").substring(0, 60)}')"
            title="${m.text}">
      <span class="ai-sidebar__item-icon">🕐</span>
      ${escapeHtml(m.text.substring(0, 32))}${m.text.length > 32 ? '…' : ''}
    </button>`
  ).join('');
}

/* ══════════════════════════════════════════
   TÌM KIẾM TRONG SIDEBAR
   ══════════════════════════════════════════ */
function searchSidebar(query) {
  const q = query.trim().toLowerCase();
  const container = document.getElementById('suggestionList');

  if (!q) {
    buildSuggestions();
    return;
  }

  const matches = AI_SUGGESTIONS.filter(s =>
    s.label.toLowerCase().includes(q) || s.query.toLowerCase().includes(q)
  );

  if (matches.length === 0) {
    container.innerHTML = `<div style="padding:8px 16px;font-size:0.8rem;color:var(--gray-400)">Không tìm thấy</div>`;
    return;
  }

  container.innerHTML = matches.map(s => `
    <button class="ai-sidebar__item"
            onclick="sendSuggestion('${s.query.replace(/'/g, "\\'")}')"
    ><span class="ai-sidebar__item-icon">💬</span>${s.label}</button>`
  ).join('');
}

/* ══════════════════════════════════════════
   TIỆN ÍCH
   ══════════════════════════════════════════ */
function scrollToBottom() {
  const el = document.getElementById('aiMessages');
  if (el) el.scrollTop = el.scrollHeight;
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/\n/g,'<br>');
}
