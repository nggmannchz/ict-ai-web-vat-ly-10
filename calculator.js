/**
 * js/calculator.js — Máy tính SI
 * Phụ thuộc: data/calculator.js (load trước)
 *
 * Luồng:
 *   1. Người dùng chọn công thức → renderInputRows() + renderRadioGroup()
 *   2. Người dùng chọn đại lượng cần tìm → đánh dấu ô tương ứng
 *   3. Bấm Tính → convertToSI() → solve() → renderResult() + renderSteps()
 *   4. Nếu đến từ formulas.html qua localStorage → tự chọn công thức đó
 */

/* ── State ────────────────────────────── */
let currentFormulaId = null;
let unknownKey       = null;   // key của đại lượng cần tìm

/* ── Khởi động ──────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildFormulaDropdown();
  checkIncomingFormula();   // từ formulas.html
});

/* ══════════════════════════════════════════
   BUILD DROPDOWN CÔNG THỨC
   ══════════════════════════════════════════ */
function buildFormulaDropdown() {
  const sel = document.getElementById('formulaSelect');
  sel.innerHTML = '<option value="">-- Chọn công thức --</option>';
  CALC_FORMULAS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.display;
    sel.appendChild(opt);
  });
}

/* ══════════════════════════════════════════
   CHỌN CÔNG THỨC
   ══════════════════════════════════════════ */
function onFormulaChange() {
  const sel = document.getElementById('formulaSelect');
  const id  = sel.value;
  if (!id) {
    clearAll();
    return;
  }
  currentFormulaId = id;
  unknownKey = null;

  const formula = CALC_FORMULAS.find(f => f.id === id);

  // Preview công thức
  const prev = document.getElementById('formulaPreview');
  prev.textContent = formula.formula;
  prev.classList.add('show');

  renderInputRows(formula);
  renderRadioGroup(formula);
  clearResult();
}

/* ══════════════════════════════════════════
   RENDER INPUT ROWS
   ══════════════════════════════════════════ */
function renderInputRows(formula) {
  const container = document.getElementById('inputRows');
  container.innerHTML = formula.variables.map(v => {
    const group = UNIT_GROUPS[v.unitGroup];
    const unitOptions = group.units.map(u =>
      `<option value="${u.label}" data-to-si="${u.toSI}">${u.label}</option>`
    ).join('');

    return `
      <div class="input-row" id="row-${v.key}" data-key="${v.key}">
        <label class="input-row__label" for="inp-${v.key}">${v.label}</label>
        <input type="number" id="inp-${v.key}" step="any"
               placeholder="Nhập giá trị"
               aria-label="${v.label}"/>
        <select id="unit-${v.key}" aria-label="Đơn vị của ${v.label}">
          ${unitOptions}
        </select>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   RENDER RADIO CHỌN ĐẠI LƯỢNG CẦN TÌM
   ══════════════════════════════════════════ */
function renderRadioGroup(formula) {
  const container = document.getElementById('radioGroup');
  container.innerHTML = formula.variables.map(v => `
    <label class="radio-btn" id="radio-${v.key}">
      <input type="radio" name="unknown" value="${v.key}"
             onchange="selectUnknown('${v.key}')"/>
      ${v.label}
    </label>
  `).join('');
}

/* ══════════════════════════════════════════
   CHỌN ĐẠI LƯỢNG CẦN TÌM
   ══════════════════════════════════════════ */
function selectUnknown(key) {
  unknownKey = key;

  // Cập nhật radio UI
  document.querySelectorAll('.radio-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.id === `radio-${key}`);
  });

  // Ô của đại lượng cần tìm: disable + highlight
  const formula = CALC_FORMULAS.find(f => f.id === currentFormulaId);
  if (!formula) return;

  formula.variables.forEach(v => {
    const row   = document.getElementById(`row-${v.key}`);
    const input = document.getElementById(`inp-${v.key}`);
    const unit  = document.getElementById(`unit-${v.key}`);
    if (!row || !input) return;

    if (v.key === key) {
      row.classList.add('is-unknown');
      input.value = '';
      input.placeholder = '← Sẽ tính';
      input.classList.add('disabled');
      input.readOnly = true;
      if (unit) unit.disabled = true;
    } else {
      row.classList.remove('is-unknown');
      input.classList.remove('disabled');
      input.readOnly = false;
      input.placeholder = 'Nhập giá trị';
      if (unit) unit.disabled = false;
    }
  });

  clearResult();
}

/* ══════════════════════════════════════════
   TÍNH TOÁN
   ══════════════════════════════════════════ */
function calculate() {
  if (!currentFormulaId) {
    showError('Vui lòng chọn công thức trước.');
    return;
  }
  if (!unknownKey) {
    showError('Vui lòng chọn đại lượng cần tìm.');
    return;
  }

  const formula = CALC_FORMULAS.find(f => f.id === currentFormulaId);
  const steps   = [];   // mảng string diễn giải từng bước
  const valsSI  = {};   // {key: giá trị SI}
  const conversionSteps = [];

  // Thu thập và đổi đơn vị
  let inputError = false;
  formula.variables.forEach(v => {
    if (v.key === unknownKey) return; // bỏ qua ẩn

    const rawInput = document.getElementById(`inp-${v.key}`)?.value.trim();
    const unitSel  = document.getElementById(`unit-${v.key}`);
    const unitLabel = unitSel?.value || v.siUnit;
    const toSI = parseFloat(unitSel?.selectedOptions[0]?.dataset.toSi ?? '1');

    if (rawInput === '' || isNaN(parseFloat(rawInput))) {
      showError(`Vui lòng nhập giá trị cho "${v.label}".`);
      inputError = true;
      return;
    }

    const rawVal = parseFloat(rawInput);
    const siVal  = rawVal * toSI;
    valsSI[v.key] = siVal;

    // Ghi bước đổi đơn vị
    if (unitLabel !== v.siUnit) {
      conversionSteps.push(
        `${v.label}: <strong>${rawVal} ${unitLabel}</strong> × ${toSI} = <strong>${formatNum(siVal)} ${v.siUnit}</strong>`
      );
    } else {
      conversionSteps.push(
        `${v.label}: <strong>${rawVal} ${v.siUnit}</strong> (đã chuẩn SI)`
      );
    }
  });

  if (inputError) return;

  // Tính
  const solver = formula.solve[unknownKey];
  if (!solver) { showError('Không thể tính đại lượng này.'); return; }

  let resultSI;
  try { resultSI = solver(valsSI); }
  catch (e) { showError('Lỗi tính toán: kiểm tra lại số liệu nhập.'); return; }

  if (resultSI === null || !isFinite(resultSI)) {
    showError('Phương trình vô nghiệm hoặc đầu vào không hợp lệ.');
    return;
  }

  const unknownVar = formula.variables.find(v => v.key === unknownKey);

  // Render kết quả
  renderResult(unknownVar, resultSI);

  // Render các bước
  const allSteps = [
    ...conversionSteps.map(s => ({ text: s, highlight: false })),
    {
      text: `Áp dụng công thức: <strong>${formula.formula}</strong>`,
      highlight: false
    },
    {
      text: `→ <strong>${unknownVar.label} = ${formatNum(resultSI)} ${unknownVar.siUnit}</strong>`,
      highlight: true
    }
  ];
  renderSteps(allSteps);
}

/* ══════════════════════════════════════════
   RENDER KẾT QUẢ
   ══════════════════════════════════════════ */
function renderResult(variable, value) {
  const box = document.getElementById('resultBox');
  box.classList.remove('empty', 'error');

  document.getElementById('resultLabel').textContent = variable.label;
  document.getElementById('resultValue').textContent = formatNum(value);
  document.getElementById('resultUnit').textContent  = variable.siUnit;

  const formula = CALC_FORMULAS.find(f => f.id === currentFormulaId);
  document.getElementById('resultFormula').textContent = formula?.formula || '';
}

function showError(msg) {
  const box = document.getElementById('resultBox');
  box.classList.remove('empty');
  box.classList.add('error');

  document.getElementById('resultLabel').textContent  = 'Lỗi';
  document.getElementById('resultValue').textContent  = msg;
  document.getElementById('resultUnit').textContent   = '';
  document.getElementById('resultFormula').textContent = '';

  document.getElementById('stepsList').innerHTML =
    '<div class="steps-empty">Không có bước diễn giải.</div>';
}

function clearResult() {
  const box = document.getElementById('resultBox');
  box.classList.add('empty');
  box.classList.remove('error');

  document.getElementById('resultLabel').textContent  = 'Kết quả';
  document.getElementById('resultValue').textContent  = '—';
  document.getElementById('resultUnit').textContent   = '';
  document.getElementById('resultFormula').textContent = '';

  document.getElementById('stepsList').innerHTML =
    '<div class="steps-empty">Nhập số liệu và bấm "Tính" để xem kết quả.</div>';
}

/* ══════════════════════════════════════════
   RENDER CÁC BƯỚC
   ══════════════════════════════════════════ */
function renderSteps(steps) {
  const list = document.getElementById('stepsList');
  list.innerHTML = steps.map((s, i) => `
    <div class="step-item ${s.highlight ? 'step-highlight' : ''}">
      <span class="step-item__num">${i + 1}</span>
      <span class="step-item__text">${s.text}</span>
    </div>`
  ).join('');
}

/* ══════════════════════════════════════════
   ĐẾN TỪ TRANG CÔNG THỨC (localStorage)
   ══════════════════════════════════════════ */
function checkIncomingFormula() {
  const incoming = localStorage.getItem('newton_selectedFormula');
  if (!incoming) return;
  localStorage.removeItem('newton_selectedFormula');

  // Map: formula id từ formulas.js → id trong CALC_FORMULAS
  // (nhiều id trùng nhau vì đã đặt cùng tên)
  const match = CALC_FORMULAS.find(f => f.id === incoming);
  if (!match) return;

  const sel = document.getElementById('formulaSelect');
  sel.value = match.id;
  onFormulaChange();
}

/* ══════════════════════════════════════════
   XÓA TẤT CẢ
   ══════════════════════════════════════════ */
function clearAll() {
  currentFormulaId = null;
  unknownKey = null;

  document.getElementById('formulaPreview').classList.remove('show');
  document.getElementById('inputRows').innerHTML = '';
  document.getElementById('radioGroup').innerHTML = '';
  clearResult();
}

/* ══════════════════════════════════════════
   TIỆN ÍCH
   ══════════════════════════════════════════ */
/**
 * Format số: tối đa 6 chữ số có nghĩa, bỏ số 0 thừa
 */
function formatNum(n) {
  if (Math.abs(n) >= 1e6 || (Math.abs(n) < 1e-3 && n !== 0)) {
    return n.toExponential(4);
  }
  // Tối đa 6 chữ số có nghĩa
  const str = parseFloat(n.toPrecision(6)).toString();
  return str;
}
