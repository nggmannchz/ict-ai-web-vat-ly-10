/**
 * js/lab.js — Phòng thí nghiệm mô phỏng 2D
 *
 * Kịch bản 1: Chuyển động thẳng biến đổi đều (CĐTBĐĐ)
 *   - Vật chạy trên mặt phẳng ngang, vẽ trail, vẽ vector v & a
 *   - Xuất đồ thị v-t
 *
 * Kịch bản 2: Ném ngang / ném xiên
 *   - Vật bay theo parabol, vẽ quỹ đạo, phân tích vector vx vy
 *   - Hiện tầm xa, độ cao cực đại, thời gian bay
 */

/* ─────────────────────────────────────────────
   HẰNG SỐ & BIẾN TRẠNG THÁI TOÀN CỤC
───────────────────────────────────────────── */
const G    = 9.8;          // gia tốc trọng trường m/s²
const DT   = 1 / 60;       // bước thời gian mô phỏng (~60fps)
const SCALE_LINEAR  = 40;  // px / m cho kịch bản 1
const SCALE_PROJECTILE = 30; // px / m cho kịch bản 2

let scene        = 'linear'; // 'linear' | 'projectile' | 'friction'
let animId       = null;     // requestAnimationFrame id
let isRunning    = false;

/* State kịch bản 3: Lực ma sát */
const SURFACE_TYPES = [
  { label: 'Gỗ trên Gỗ',        mu_n: 0.50, mu_t: 0.35 },
  { label: 'Cao su trên Bê tông',mu_n: 0.90, mu_t: 0.70 },
  { label: 'Nhựa trên Băng',     mu_n: 0.12, mu_t: 0.07 },
  { label: 'Thép trên Thép',     mu_n: 0.74, mu_t: 0.57 },
  { label: 'Gỗ trên Đá hoa',     mu_n: 0.45, mu_t: 0.30 },
];

let fricState = {
  mass: 5,          // kg
  fApplied: 0,      // N — lực kéo hiện tại
  surfaceIdx: 0,    // chỉ số SURFACE_TYPES
  x: 0,            // vị trí vật (m)
  v: 0,            // vận tốc (m/s)
  t: 0,
  isSliding: false,
  fFric: 0,        // lực ma sát thực tế
  a: 0,            // gia tốc thực tế
};

let fricHistory = []; // [{t, fApplied, fFric}]

/* State kịch bản 1 */
let linState = {
  x: 0, v: 0, t: 0,
  x0: 0, v0: 5, a: 2,
  trail: []          // [{x, y}] vị trí đã qua
};

/* State kịch bản 2 */
let projState = {
  px: 0, py: 0,
  vx: 0, vy: 0,
  t: 0,
  h0: 50, v0: 15, angle: 0,
  trail: [],
  landed: false,
  maxH: 0, range: 0, flightTime: 0
};

/* Lịch sử v-t cho đồ thị */
let vtHistory = [];  // [{t, v}]

/* ─────────────────────────────────────────────
   KHỞI ĐỘNG
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  switchScene('linear');
  syncSliders();
});

function initCanvas() {
  const canvas = document.getElementById('simCanvas');
  // Đặt kích thước pixel thực theo CSS width
  const resize = () => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = 360;
  };
  resize();
  window.addEventListener('resize', () => { resize(); if (!isRunning) drawFrame(); });
}

/* ─────────────────────────────────────────────
   CHUYỂN KỊCH BẢN
───────────────────────────────────────────── */
function switchScene(name) {
  resetSim();
  scene = name;

  // Tab buttons
  document.querySelectorAll('.scene-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scene === name);
  });

  // Input groups
  document.getElementById('inputsLinear').classList.toggle('hidden', name !== 'linear');
  document.getElementById('inputsProjectile').classList.toggle('hidden', name !== 'projectile');
  document.getElementById('inputsFriction').classList.toggle('hidden', name !== 'friction');

  // Readout rows
  document.getElementById('readoutLinear').classList.toggle('hidden', name !== 'linear');
  document.getElementById('readoutProjectile').classList.toggle('hidden', name !== 'projectile');
  document.getElementById('readoutFriction').classList.toggle('hidden', name !== 'friction');

  // Chart (ẩn khi đổi scene)
  document.getElementById('chartWrapper').classList.remove('show');

  // Nút xuất đồ thị: ẩn ở kịch bản friction (không có v-t)
  const exportBtn = document.getElementById('exportChartBtn');
  if (exportBtn) exportBtn.style.display = name === 'friction' ? 'none' : '';

  if (name === 'friction') {
    buildSurfaceDropdown();
    // Re-sync friction sliders để hiện giá trị ban đầu
    const sliderMass = document.getElementById('sliderMassFric');
    const sliderF    = document.getElementById('sliderFApplied');
    if (sliderMass) {
      document.getElementById('valMassFric').textContent = sliderMass.value + ' kg';
    }
    if (sliderF) {
      document.getElementById('valFApplied').textContent = sliderF.value + ' N';
    }
    computeFrictionState();
    updateReadout();
  }

  drawFrame();
}

/* ─────────────────────────────────────────────
   ĐỒNG BỘ SLIDER → hiển thị giá trị
───────────────────────────────────────────── */
function syncSliders() {
  // Kịch bản 1
  bindSlider('sliderV0Lin', 'valV0Lin', v => {
    linState.v0 = v; if (!isRunning) resetSim();
  });
  bindSlider('sliderALin', 'valALin', v => {
    linState.a = v; if (!isRunning) resetSim();
  });
  bindSlider('sliderX0Lin', 'valX0Lin', v => {
    linState.x0 = v; if (!isRunning) resetSim();
  });
  // Kịch bản 2
  bindSlider('sliderH0', 'valH0', v => {
    projState.h0 = v; if (!isRunning) resetSim();
  });
  bindSlider('sliderV0Proj', 'valV0Proj', v => {
    projState.v0 = v; if (!isRunning) resetSim();
  });
  bindSlider('sliderAngle', 'valAngle', v => {
    projState.angle = v; if (!isRunning) resetSim();
  });
  // Kịch bản 3: bind ngay để hiện giá trị khi tab được mở
  bindSlider('sliderMassFric', 'valMassFric', v => {
    fricState.mass = parseFloat(v);
    computeFrictionState();
    if (!isRunning) { updateReadout(); drawFrame(); }
  });
  bindSlider('sliderFApplied', 'valFApplied', v => {
    fricState.fApplied = parseFloat(v);
    computeFrictionState();
    if (!isRunning) { updateReadout(); drawFrame(); }
  });
}
function bindSlider(sliderId, displayId, onChange) {
  const slider  = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (!slider || !display) return;
  const update = () => {
    display.textContent = slider.value + ' ' + (slider.dataset.unit || '');
    onChange(parseFloat(slider.value));
  };
  slider.addEventListener('input', update);
  update(); // khởi tạo ngay
}

/* ─────────────────────────────────────────────
   NÚT ĐIỀU KHIỂN
───────────────────────────────────────────── */
function startSim() {
  if (isRunning) return;
  isRunning = true;
  document.getElementById('simAlert').classList.remove('show');
  document.getElementById('chartWrapper').classList.remove('show');
  vtHistory = [];
  loop();
}

function pauseSim() {
  isRunning = false;
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}

function resetSim() {
  pauseSim();

  // Reset state kịch bản 1
  linState.x = linState.x0;
  linState.v = linState.v0;
  linState.t = 0;
  linState.trail = [];

  // Reset state kịch bản 2
  const rad = projState.angle * Math.PI / 180;
  projState.px = 0;
  projState.py = projState.h0;
  projState.vx = projState.v0 * Math.cos(rad);
  projState.vy = projState.v0 * Math.sin(rad);
  projState.t  = 0;
  projState.trail   = [];
  projState.landed  = false;
  projState.maxH    = projState.h0;
  projState.range   = 0;
  projState.flightTime = 0;

  // Reset state kịch bản 3
  fricState.x = 0;
  fricState.v = 0;
  fricState.t = 0;
  fricState.isSliding = false;
  fricState.fFric = 0;
  fricState.a = 0;
  fricHistory = [];

  vtHistory = [];
  updateReadout();
  drawFrame();
}

/* ─────────────────────────────────────────────
   VÒNG LẶP MÔ PHỎNG
───────────────────────────────────────────── */
function loop() {
  if (!isRunning) return;
  step();
  drawFrame();
  updateReadout();
  animId = requestAnimationFrame(loop);
}

function step() {
  if (scene === 'linear') {
    stepLinear();
  } else if (scene === 'projectile') {
    stepProjectile();
  } else if (scene === 'friction') {
    stepFriction();
  }
}

/* -- Kịch bản 1: CĐTBĐĐ -- */
function stepLinear() {
  const canvas = document.getElementById('simCanvas');
  const groundY = canvas.height - 60; // y mặt đất

  // Lưu vị trí vào trail mỗi 0.1s
  if (vtHistory.length === 0 || linState.t - (vtHistory[vtHistory.length-1]?.t || 0) >= 0.1) {
    vtHistory.push({ t: linState.t, v: linState.v });
    linState.trail.push({ x: linState.x, y: groundY - 20 });
  }

  linState.v = linState.v0 + linState.a * linState.t;
  linState.x = linState.x0 + linState.v0 * linState.t + 0.5 * linState.a * linState.t ** 2;
  linState.t += DT;

  // Dừng nếu vật ra khỏi màn hình hoặc v=0 (chậm dần đều)
  const canvasXpx = linState.x * SCALE_LINEAR;
  if (canvasXpx > canvas.width + 200 || (linState.a < 0 && linState.v <= 0)) {
    pauseSim();
    document.getElementById('simAlert').classList.add('show');
  }
}

/* -- Kịch bản 2: ném ngang / ném xiên -- */
function stepProjectile() {
  if (projState.landed) { pauseSim(); return; }

  // Lưu trail
  projState.trail.push({ x: projState.px, y: projState.py });
  vtHistory.push({ t: projState.t, v: Math.hypot(projState.vx, projState.vy) });

  projState.px += projState.vx * DT;
  projState.vy -= G * DT;
  projState.py += projState.vy * DT;
  projState.t  += DT;

  if (projState.py > projState.maxH) projState.maxH = projState.py;

  // Chạm đất
  if (projState.py <= 0) {
    projState.py = 0;
    projState.landed    = true;
    projState.range     = projState.px;
    projState.flightTime = projState.t;
    pauseSim();
    document.getElementById('simAlert').classList.add('show');
  }
}

/* ─────────────────────────────────────────────
   VẼ FRAME
───────────────────────────────────────────── */
function drawFrame() {
  const canvas = document.getElementById('simCanvas');
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  if (scene === 'linear') {
    drawLinearScene(ctx, W, H);
  } else if (scene === 'projectile') {
    drawProjectileScene(ctx, W, H);
  } else {
    drawFrictionScene(ctx, W, H);
  }
}

/* ── Kịch bản 1 ── */
function drawLinearScene(ctx, W, H) {
  const groundY = H - 60;

  // Nền tối
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, H);

  // Lưới dọc (thước đo)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let m = 0; m * SCALE_LINEAR < W + linState.x * SCALE_LINEAR; m += 5) {
    const px = m * SCALE_LINEAR - (linState.x * SCALE_LINEAR - W / 2) + W * 0.1;
    if (px < 0 || px > W) continue;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '11px monospace';
    ctx.fillText(m + 'm', px + 3, groundY - 6);
  }

  // Mặt đất
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

  // Vạch chia dưới đất
  ctx.strokeStyle = '#1e3a5f';
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, groundY);
    ctx.lineTo(i + 10, groundY + 10);
    ctx.stroke();
  }

  // Trail (vết chấm)
  const camOffX = linState.x * SCALE_LINEAR - W / 2;
  linState.trail.forEach((pt, i) => {
    const alpha = 0.15 + 0.6 * (i / Math.max(linState.trail.length, 1));
    ctx.fillStyle = `rgba(56,189,248,${alpha})`;
    ctx.beginPath();
    ctx.arc(pt.x * SCALE_LINEAR - camOffX, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // Vật (hình chữ nhật)
  const objW = 50, objH = 30;
  const objX = W / 2 - objW / 2;
  const objY = groundY - objH;

  // Bóng
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(W / 2, groundY + 4, objW * 0.6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân vật
  const grad = ctx.createLinearGradient(objX, objY, objX, objY + objH);
  grad.addColorStop(0, '#38BDF8');
  grad.addColorStop(1, '#0284C7');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(objX, objY, objW, objH, 6);
  ctx.fill();

  // Nhãn "Vật"
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Vật', W / 2, objY + 19);
  ctx.textAlign = 'left';

  // Vector vận tốc (mũi tên xanh dương)
  const vScale = 4;
  drawArrow(ctx, W / 2, objY + objH / 2,
    W / 2 + linState.v * vScale, objY + objH / 2,
    '#38BDF8', `v=${linState.v.toFixed(1)} m/s`);

  // Vector gia tốc (mũi tên cam)
  if (linState.a !== 0) {
    const aScale = 6;
    drawArrow(ctx, W / 2, objY - 8,
      W / 2 + linState.a * aScale, objY - 8,
      '#F97316', `a=${linState.a.toFixed(1)} m/s²`);
  }

  // Thời gian (góc trên phải)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`t = ${linState.t.toFixed(2)} s`, W - 12, 22);
  ctx.textAlign = 'left';
}

/* ── Kịch bản 2 ── */
function drawProjectileScene(ctx, W, H) {
  const S = SCALE_PROJECTILE;
  // Camera: gốc tọa độ vật lý (0,0) → pixel (60, H-60)
  const originX = 60;
  const originY = H - 60;

  const toPixX = x => originX + x * S;
  const toPixY = y => originY - y * S;

  // Nền
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, H);

  // Lưới ngang (mỗi 10m)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let y = 0; y * S < H; y += 10) {
    const py = toPixY(y);
    if (py < 0) break;
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px monospace';
    ctx.fillText(y + 'm', 2, py - 2);
  }
  // Lưới dọc
  for (let x = 0; x * S < W; x += 10) {
    const px = toPixX(x);
    if (px > W) break;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
    if (x > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.font = '10px monospace';
      ctx.fillText(x + 'm', px + 2, H - 2);
    }
  }

  // Mặt đất
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(W, originY); ctx.stroke();

  // Bệ phóng (trái)
  const pedH = projState.h0 * S;
  ctx.fillStyle = '#1E3A5F';
  ctx.fillRect(originX - 15, originY - pedH, 15, pedH);
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(originX - 18, originY - pedH - 6, 21, 8);

  // Quỹ đạo (trail)
  if (projState.trail.length > 1) {
    ctx.strokeStyle = 'rgba(56,189,248,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    projState.trail.forEach((pt, i) => {
      const px = toPixX(pt.x), py = toPixY(pt.y);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Vật (quả bóng)
  const bx = toPixX(projState.px);
  const by = toPixY(projState.py);
  if (bx >= 0 && bx <= W && by >= 0 && by <= H) {
    // Bóng
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(bx, originY + 4, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const ballGrad = ctx.createRadialGradient(bx - 4, by - 4, 2, bx, by, 14);
    ballGrad.addColorStop(0, '#7DD3FC');
    ballGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.fill();

    // Vector vx (ngang, xanh lá)
    const vxPx = projState.vx * 3;
    if (Math.abs(vxPx) > 4) {
      drawArrow(ctx, bx, by, bx + vxPx, by, '#10B981',
        `vx=${projState.vx.toFixed(1)}`);
    }

    // Vector vy (dọc, cam)
    const vyPx = -projState.vy * 3;
    if (Math.abs(vyPx) > 4) {
      drawArrow(ctx, bx, by, bx, by + vyPx, '#F97316',
        `vy=${projState.vy.toFixed(1)}`);
    }
  }

  // Thời gian
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`t = ${projState.t.toFixed(2)} s`, W - 12, 22);
  ctx.textAlign = 'left';

  // Kết quả cuối khi đã chạm đất
  if (projState.landed) {
    ctx.fillStyle = 'rgba(16,185,129,0.15)';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(W - 200, 30, 185, 90, 8);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
    ctx.fillText(`Tầm xa L = ${projState.range.toFixed(2)} m`, W - 192, 52);
    ctx.fillText(`H_max = ${(projState.maxH - projState.h0).toFixed(2)} m`, W - 192, 72);
    ctx.fillText(`t bay = ${projState.flightTime.toFixed(2)} s`, W - 192, 92);
    ctx.fillText(`v₀ = ${projState.v0} m/s  α = ${projState.angle}°`, W - 192, 112);
  }
}

/* ─────────────────────────────────────────────
   VẼ MŨI TÊN
───────────────────────────────────────────── */
function drawArrow(ctx, x1, y1, x2, y2, color, label) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 4) return;

  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(12, len * 0.4);

  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = 2.5;

  // Thân mũi tên
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Đầu mũi tên
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6),
             y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6),
             y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  // Nhãn
  if (label) {
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = color;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - 8;
    ctx.fillText(label, midX, midY);
  }
}

/* ─────────────────────────────────────────────
   CẬP NHẬT READOUT
───────────────────────────────────────────── */
function updateReadout() {
  if (scene === 'linear') {
    setVal('rdDist', linState.x.toFixed(2) + ' m');
    setVal('rdVel',  linState.v.toFixed(2) + ' m/s');
    setVal('rdTime', linState.t.toFixed(2) + ' s');
  } else if (scene === 'projectile') {
    setVal('rdProjX',  projState.px.toFixed(2) + ' m');
    setVal('rdProjY',  projState.py.toFixed(2) + ' m');
    setVal('rdProjVx', projState.vx.toFixed(2) + ' m/s');
    setVal('rdProjVy', projState.vy.toFixed(2) + ' m/s');
    setVal('rdProjT',  projState.t.toFixed(2)  + ' s');
  } else {
    const surf = SURFACE_TYPES[fricState.surfaceIdx];
    const N = fricState.mass * G;
    setVal('rdFricStatus', fricState.isSliding ? '🟢 Đang trượt' : '🔴 Đứng yên');
    setVal('rdFricFapply', fricState.fApplied.toFixed(1) + ' N');
    setVal('rdFricFms',    fricState.fFric.toFixed(1) + ' N');
    setVal('rdFricA',      fricState.a.toFixed(2) + ' m/s²');
    setVal('rdFricN',      N.toFixed(1) + ' N');
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ─────────────────────────────────────────────
   XUẤT ĐỒ THỊ v-t
───────────────────────────────────────────── */
function exportChart() {
  const wrapper = document.getElementById('chartWrapper');
  wrapper.classList.add('show');

  const canvas = document.getElementById('vtChart');
  const ctx    = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = 200;

  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 20, bottom: 40, left: 50 };

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, W, H);

  if (vtHistory.length < 2) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chưa có dữ liệu — bấm Bắt đầu trước', W / 2, H / 2);
    return;
  }

  const maxT = vtHistory[vtHistory.length - 1].t;
  const allV = vtHistory.map(p => p.v);
  const minV = Math.min(...allV);
  const maxV = Math.max(...allV);
  const vRange = maxV - minV || 1;

  const toX = t => PAD.left + (t / (maxT || 1)) * (W - PAD.left - PAD.right);
  const toY = v => PAD.top + (1 - (v - minV) / vRange) * (H - PAD.top - PAD.bottom);

  // Axes
  ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, H - PAD.bottom);
  ctx.lineTo(W - PAD.right, H - PAD.bottom);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#64748B'; ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('t (s)', W / 2, H - 4);
  ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('v (m/s)', 0, 0); ctx.restore();

  // Grid & tick labels
  const tSteps = 5;
  for (let i = 0; i <= tSteps; i++) {
    const t = (maxT / tSteps) * i;
    const px = toX(t);
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, H - PAD.bottom); ctx.stroke();
    ctx.fillStyle = '#94A3B8'; ctx.textAlign = 'center';
    ctx.fillText(t.toFixed(1), px, H - PAD.bottom + 14);
  }
  for (let i = 0; i <= 4; i++) {
    const v = minV + (vRange / 4) * i;
    const py = toY(v);
    ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(W - PAD.right, py); ctx.stroke();
    ctx.fillStyle = '#94A3B8'; ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(1), PAD.left - 4, py + 4);
  }

  // Đường v-t
  ctx.strokeStyle = '#0284C7'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  vtHistory.forEach((pt, i) => {
    const px = toX(pt.t), py = toY(pt.v);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Điểm đầu cuối
  [[vtHistory[0], '#10B981'], [vtHistory[vtHistory.length-1], '#EF4444']].forEach(([pt, c]) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(toX(pt.t), toY(pt.v), 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

/* ─────────────────────────────────────────────
   KỊCH BẢN 3: LỰC MA SÁT
───────────────────────────────────────────── */

/* Xây dropdown chọn bề mặt */
function buildSurfaceDropdown() {
  const sel = document.getElementById('surfaceSelect');
  if (!sel || sel.options.length > 1) return; // đã build
  sel.innerHTML = SURFACE_TYPES.map((s, i) =>
    `<option value="${i}">${s.label}  (μₙ=${s.mu_n}, μₜ=${s.mu_t})</option>`
  ).join('');
  sel.value = fricState.surfaceIdx;
}

/* Cập nhật surface từ dropdown */
function onSurfaceChange(idx) {
  fricState.surfaceIdx = parseInt(idx);
  if (!isRunning) resetSim();
}

/* Cập nhật lực kéo từ slider */
function onFAppliedChange(val) {
  fricState.fApplied = parseFloat(val);
  setVal('valFApplied', val + ' N');
  // Cập nhật ngay cả khi không chạy
  computeFrictionState();
  if (!isRunning) { updateReadout(); drawFrame(); }
}

/* Cập nhật khối lượng */
function onMassChange(val) {
  fricState.mass = parseFloat(val);
  setVal('valMassFric', val + ' kg');
  if (!isRunning) resetSim();
}

/* Tính trạng thái ma sát tại F_applied hiện tại */
function computeFrictionState() {
  const surf = SURFACE_TYPES[fricState.surfaceIdx];
  const N    = fricState.mass * G;
  const fMax = surf.mu_n * N;   // ma sát nghỉ cực đại
  const fSlide = surf.mu_t * N; // ma sát trượt

  if (fricState.v > 0 || fricState.fApplied > fMax) {
    // Đang trượt hoặc lực kéo vượt ngưỡng
    fricState.isSliding = true;
    fricState.fFric = fSlide;
    fricState.a = (fricState.fApplied - fSlide) / fricState.mass;
    if (fricState.a < 0 && fricState.v <= 0) {
      fricState.a = 0; fricState.isSliding = false; fricState.fFric = fricState.fApplied;
    }
  } else {
    // Đứng yên: ma sát nghỉ = F_kéo (cân bằng)
    fricState.isSliding = false;
    fricState.fFric = fricState.fApplied;
    fricState.a = 0;
  }
}

/* Bước mô phỏng kịch bản 3 */
function stepFriction() {
  computeFrictionState();

  fricHistory.push({
    t: fricState.t,
    fApplied: fricState.fApplied,
    fFric: fricState.fFric
  });

  fricState.v += fricState.a * DT;
  if (fricState.v < 0) fricState.v = 0; // không lùi
  fricState.x += fricState.v * DT;
  fricState.t += DT;

  // Vật ra khỏi màn hình → dừng
  const canvas = document.getElementById('simCanvas');
  if (fricState.x * 50 > canvas.width + 100) {
    pauseSim();
    document.getElementById('simAlert').classList.add('show');
    document.getElementById('simAlertText').textContent =
      'Vật đã trượt ra ngoài! Bấm Đặt lại để thử lại.';
  }
}

/* Vẽ kịch bản 3 */
function drawFrictionScene(ctx, W, H) {
  const groundY = H - 60;
  const SCALE = 50; // px/m

  // Nền
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, H);

  // Chọn màu mặt sàn theo vật liệu
  const surfColors = ['#92400E', '#475569', '#BAE6FD', '#64748B', '#A3A3A3'];
  ctx.fillStyle = surfColors[fricState.surfaceIdx] + '55';
  ctx.fillRect(0, groundY, W, H - groundY);

  // Mặt sàn
  ctx.strokeStyle = surfColors[fricState.surfaceIdx];
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(W, groundY); ctx.stroke();

  // Nhãn vật liệu
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '11px monospace';
  ctx.fillText(SURFACE_TYPES[fricState.surfaceIdx].label, 10, groundY - 8);

  // Vật (hình chữ nhật)
  const objW = 60, objH = 40;
  const objX = Math.max(10, fricState.x * SCALE + 80);
  const objY = groundY - objH;

  // Bóng mờ
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(objX + objW / 2, groundY + 4, objW * 0.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thân vật
  const grad = ctx.createLinearGradient(objX, objY, objX, objY + objH);
  grad.addColorStop(0, '#7DD3FC');
  grad.addColorStop(1, '#0284C7');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(objX, objY, objW, objH, 6);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Be Vietnam Pro",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${fricState.mass} kg`, objX + objW / 2, objY + objH / 2 + 5);
  ctx.textAlign = 'left';

  const cx = objX + objW / 2;
  const cy = objY + objH / 2;
  const N  = fricState.mass * G;

  // --- Vẽ các vector lực ---
  const VEC_SCALE_F = 3.5; // px/N

  // P (trọng lực) ↓ — cam
  drawArrow(ctx, cx, groundY - objH / 2, cx, groundY - objH / 2 + N * VEC_SCALE_F,
    '#F97316', `P=${N.toFixed(0)}N`);

  // N (phản lực) ↑ — xanh lá
  drawArrow(ctx, cx, groundY - objH / 2, cx, groundY - objH / 2 - N * VEC_SCALE_F,
    '#10B981', `N=${N.toFixed(0)}N`);

  // F_kéo → — xanh dương
  if (fricState.fApplied > 0) {
    drawArrow(ctx, objX + objW, cy, objX + objW + fricState.fApplied * VEC_SCALE_F, cy,
      '#38BDF8', `F=${fricState.fApplied.toFixed(1)}N`);
  }

  // F_ms ← — đỏ
  if (fricState.fFric > 0) {
    drawArrow(ctx, objX, cy, objX - fricState.fFric * VEC_SCALE_F, cy,
      '#F87171', `Fms=${fricState.fFric.toFixed(1)}N`);
  }

  // --- Badge trạng thái ---
  const badgeColor = fricState.isSliding ? '#10B981' : '#EF4444';
  const badgeText  = fricState.isSliding ? '⚡ ĐANG TRƯỢT' : '🔒 ĐỨNG YÊN';
  ctx.fillStyle = badgeColor + 'CC';
  ctx.beginPath();
  ctx.roundRect(W - 148, 12, 136, 28, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Be Vietnam Pro",sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, W - 80, 31);
  ctx.textAlign = 'left';

  // Thời gian
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`t = ${fricState.t.toFixed(2)} s`, W - 12, H - 8);
  ctx.textAlign = 'left';
}

/* Đồ thị F_kéo vs F_ms (khi bấm Xuất) */
function exportFrictionChart() {
  const wrapper = document.getElementById('chartWrapper');
  wrapper.classList.add('show');
  document.getElementById('chartWrapper').querySelector('.chart-wrapper__title').textContent =
    'Đồ thị F_kéo – F_ms';

  const canvas = document.getElementById('vtChart');
  const ctx    = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = 200;
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 20, bottom: 40, left: 55 };

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, W, H);

  if (fricHistory.length < 2) {
    ctx.fillStyle = '#94A3B8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Bấm Bắt đầu và kéo slider để lấy dữ liệu', W / 2, H / 2);
    return;
  }

  const surf = SURFACE_TYPES[fricState.surfaceIdx];
  const N    = fricState.mass * G;
  const fMax = surf.mu_n * N;
  const maxF = Math.max(fMax * 1.2, ...fricHistory.map(p => p.fApplied));

  const toX = v => PAD.left + (v / (maxF || 1)) * (W - PAD.left - PAD.right);
  const toY = v => PAD.top  + (1 - v / (maxF || 1)) * (H - PAD.top  - PAD.bottom);

  // Axes
  ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, H - PAD.bottom);
  ctx.lineTo(W - PAD.right, H - PAD.bottom); ctx.stroke();

  ctx.fillStyle = '#64748B'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('F_kéo (N)', W / 2, H - 4);
  ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('F_ms (N)', 0, 0); ctx.restore();

  // Đường lý thuyết ma sát nghỉ (45°) → gãy → nằm ngang
  ctx.strokeStyle = '#CBD5E1'; ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(0));
  ctx.lineTo(toX(fMax), toY(fMax));
  ctx.lineTo(toX(maxF), toY(surf.mu_t * N));
  ctx.stroke();
  ctx.setLineDash([]);

  // Điểm gãy
  ctx.fillStyle = '#F97316';
  ctx.beginPath(); ctx.arc(toX(fMax), toY(fMax), 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillText(`μₙN=${fMax.toFixed(1)}`, toX(fMax) + 6, toY(fMax) - 6);

  // Đường thực tế
  ctx.strokeStyle = '#0284C7'; ctx.lineWidth = 2;
  ctx.beginPath();
  fricHistory.forEach((pt, i) => {
    const px = toX(pt.fApplied), py = toY(pt.fFric);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.stroke();
}
