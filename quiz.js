/**
 * js/quiz.js — Logic trang Quiz
 * Phụ thuộc: data/quiz.js (shuffledQuestions, QUIZ_DURATION)
 */

/* ── Thời gian: 20 phút ─────────────────────── */
const QUIZ_DURATION = 20 * 60; // giây

/* ── State ──────────────────────────────────── */
let shuffledQuestions = []; // câu hỏi đã xáo trộn
let currentIndex = 0;
let answers      = [];
let timerHandle  = null;
let timeLeft     = QUIZ_DURATION;
let quizFinished = false;

/* ── Xáo trộn mảng (Fisher-Yates) ──────────── */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Khởi động ──────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  shuffledQuestions = shuffleArray(QUIZ_QUESTIONS);
  answers = new Array(shuffledQuestions.length).fill(null);
  buildQuestionMap();
  showQuestion(0);
  startTimer();
});

/* ══════════════════════════════════════════
   ĐỒNG HỒ ĐẾM NGƯỢC
   ══════════════════════════════════════════ */
function startTimer() {
  updateTimerDisplay();
  timerHandle = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerHandle);
      finishQuiz(true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el  = document.getElementById('timerDisplay');
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  el.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  el.classList.remove('warning', 'danger');
  if (timeLeft <= 60)  el.classList.add('danger');
  else if (timeLeft <= 180) el.classList.add('warning');
}

/* ══════════════════════════════════════════
   HIỂN THỊ CÂU HỎI
   ══════════════════════════════════════════ */
function showQuestion(index) {
  if (quizFinished) return;
  currentIndex = index;

  const q = shuffledQuestions[index];
  const LETTERS = ['A', 'B', 'C', 'D'];

  // Meta
  const levelClass = {
    'Nhận biết':  'level-nhan-biet',
    'Thông hiểu': 'level-thong-hieu',
    'Vận dụng':   'level-van-dung'
  }[q.level] || 'level-nhan-biet';

  document.getElementById('questionMeta').innerHTML = `
    <span class="question-meta__num">Câu ${index + 1} / ${shuffledQuestions.length}</span>
    <span class="question-meta__level ${levelClass}">${q.level}</span>
    <span class="question-meta__subject">${q.subject}</span>`;

  // Nội dung câu hỏi
  document.getElementById('questionText').textContent = q.question;

  // Lựa chọn
  const choicesList = document.getElementById('choicesList');
  choicesList.innerHTML = q.choices.map((text, i) => `
    <button class="choice-btn" id="choice-${i}"
            onclick="selectChoice(${i})"
            aria-label="Lựa chọn ${LETTERS[i]}: ${text}">
      <span class="choice-letter">${LETTERS[i]}</span>
      <span>${text}</span>
    </button>`
  ).join('');

  // Ẩn lời giải
  const expBox = document.getElementById('explanationBox');
  expBox.classList.remove('show', 'wrong-answer');

  // Ẩn nút tiếp theo
  document.getElementById('btnNext').classList.remove('show');

  // Nếu câu này đã trả lời → hiện lại trạng thái
  if (answers[index] !== null) {
    revealAnswer(index, answers[index], false);
  }

  // Cập nhật bảng câu hỏi
  updateMapCell(index);
}

/* ══════════════════════════════════════════
   CHỌN ĐÁP ÁN
   ══════════════════════════════════════════ */
function selectChoice(choiceIndex) {
  if (quizFinished) return;
  if (answers[currentIndex] !== null) return; // đã trả lời rồi

  answers[currentIndex] = choiceIndex;
  revealAnswer(currentIndex, choiceIndex, true);
}

function revealAnswer(qIndex, choiceIndex, animate) {
  const q = shuffledQuestions[qIndex];
  const isCorrect = choiceIndex === q.correct;

  // Tô màu các nút
  document.querySelectorAll('.choice-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct)  btn.classList.add('correct');
    if (i === choiceIndex && !isCorrect) btn.classList.add('wrong');
  });

  // Hộp lời giải
  const expBox = document.getElementById('explanationBox');
  if (!isCorrect) expBox.classList.add('wrong-answer');

  document.getElementById('expTitle').textContent  = isCorrect ? '✅ Chính xác!' : '❌ Chưa đúng';
  document.getElementById('expText').textContent   = q.explanation;
  document.getElementById('expFormula').textContent = q.formula;
  expBox.classList.add('show');

  // Nút tiếp theo
  const btnNext = document.getElementById('btnNext');
  btnNext.classList.add('show');
  btnNext.textContent = (qIndex + 1 < shuffledQuestions.length)
    ? '→ Câu tiếp theo'
    : '📋 Xem kết quả';

  // Cập nhật bảng câu hỏi: cần cập nhật lại câu trước (old current) + câu hiện tại
  updateMapCell(qIndex);
  // Cập nhật lại câu đang là "current" hiển thị đúng trạng thái
  if (currentIndex !== qIndex) updateMapCell(currentIndex);
}

/* ══════════════════════════════════════════
   CÂU TIẾP THEO / KẾT QUẢ
   ══════════════════════════════════════════ */
function nextQuestion() {
  if (currentIndex + 1 < shuffledQuestions.length) {
    showQuestion(currentIndex + 1);
  } else {
    finishQuiz(false);
  }
}

/* ══════════════════════════════════════════
   KẾT THÚC BÀI
   ══════════════════════════════════════════ */
function finishQuiz(timeout) {
  quizFinished = true;
  clearInterval(timerHandle);

  const total    = shuffledQuestions.length;
  const answered = answers.filter(a => a !== null).length;
  const correct  = answers.filter((a, i) => a === shuffledQuestions[i].correct).length;
  const wrong    = answered - correct;
  const skipped  = total - answered;
  const score    = Math.round((correct / total) * 10 * 10) / 10; // /10 điểm

  // Ẩn khu vực câu hỏi
  document.getElementById('questionArea').style.display = 'none';

  // Hiện kết quả
  const resultEl = document.getElementById('quizResult');
  resultEl.classList.add('show');

  const icon  = score >= 8 ? '🎉' : score >= 5 ? '📝' : '📖';
  const grade = score >= 8 ? 'Xuất sắc!' : score >= 6.5 ? 'Khá tốt!' : score >= 5 ? 'Trung bình' : 'Cần ôn thêm';

  document.getElementById('resultIcon').textContent  = icon;
  document.getElementById('resultTitle').textContent = grade;
  document.getElementById('resultScore').textContent = `${score} / 10`;
  document.getElementById('resultDetail').textContent =
    timeout
      ? `Hết giờ! Bạn đã trả lời ${answered}/${total} câu.`
      : `Hoàn thành bài thi trong ${formatTime(QUIZ_DURATION - timeLeft)}.`;

  document.getElementById('statCorrect').textContent  = correct;
  document.getElementById('statWrong').textContent    = wrong;
  document.getElementById('statSkipped').textContent  = skipped;

  // Cập nhật toàn bộ bảng câu hỏi
  shuffledQuestions.forEach((_, i) => updateMapCell(i));
}

function formatTime(secs) {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m} phút ${s} giây`;
}

/* ══════════════════════════════════════════
   XÂY DỰNG BẢNG CÂU HỎI
   ══════════════════════════════════════════ */
function buildQuestionMap() {
  const grid = document.getElementById('questionMapGrid');
  grid.innerHTML = shuffledQuestions.map((_, i) => `
    <button class="map-cell" id="mapCell-${i}"
            onclick="jumpToQuestion(${i})"
            aria-label="Câu ${i + 1}">
      ${i + 1}
    </button>`
  ).join('');

  // Đánh dấu câu đầu tiên
  updateMapCell(0);
}

function updateMapCell(index) {
  const cell = document.getElementById(`mapCell-${index}`);
  if (!cell) return;

  cell.classList.remove('current', 'correct', 'wrong');

  // Ưu tiên: nếu đã trả lời → hiện đúng/sai (kể cả câu đang làm)
  if (answers[index] !== null) {
    const isCorrect = answers[index] === shuffledQuestions[index].correct;
    cell.classList.add(isCorrect ? 'correct' : 'wrong');
    return;
  }

  // Chưa trả lời: nếu đang là câu hiện tại → highlight "current"
  if (index === currentIndex && !quizFinished) {
    cell.classList.add('current');
  }
  // Còn lại: giữ nguyên màu xám (chưa làm)
}

function jumpToQuestion(index) {
  if (quizFinished) return;
  // Cập nhật ô hiện tại cũ
  updateMapCell(currentIndex);
  showQuestion(index);
}

/* ══════════════════════════════════════════
   NÚT NỘP BÀI
   ══════════════════════════════════════════ */
function submitQuiz() {
  if (quizFinished) return;
  const unanswered = answers.filter(a => a === null).length;
  if (unanswered > 0) {
    const ok = confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài không?`);
    if (!ok) return;
  }
  finishQuiz(false);
}

/* ══════════════════════════════════════════
   LÀM LẠI
   ══════════════════════════════════════════ */
function restartQuiz() {
  quizFinished = false;
  currentIndex = 0;
  shuffledQuestions = shuffleArray(QUIZ_QUESTIONS);
  answers      = new Array(shuffledQuestions.length).fill(null);
  timeLeft     = QUIZ_DURATION;

  document.getElementById('quizResult').classList.remove('show');
  document.getElementById('questionArea').style.display = '';

  buildQuestionMap();
  showQuestion(0);
  startTimer();
}
