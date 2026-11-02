import { PEPERO, peperoLength, peperoHoldMsFor } from '../shared/rules.js';

/**
 * 11.11km 빼빼로 만들기
 *  0) (3·2·1 카운트다운 동안) 멀리서 전체 코스와 목표선(11.11km)을 보여줌
 *  1) start() 후 잠시 더 보여주고 출발점으로 확대
 *  2) 스페이스바(또는 버튼)를 누르고 있으면 가속하며 길어지고, 카메라가 횡스크롤로 따라감
 *  3) 떼는 순간 멈추고 길이를 공개
 * 배경: 하늘·구름·해 / 먼 빌딩 / 가까운 빌딩 / 가로수·가로등 / 인도·도로 (시차 스크롤)
 */
const OVERVIEW = { left: -0.8, width: 13.8 };
const CLOSE_WIDTH = 4; // 확대 시 화면에 보이는 길이(km)
const TIP_RATIO = 0.6; // 빼빼로 끝이 화면 가로 60% 지점에 오도록 따라감
const CLOSE = { left: -CLOSE_WIDTH * 0.15, width: CLOSE_WIDTH };
const HANDLE_KM = 0.45; // 초콜릿이 안 묻은 손잡이 부분
const OVERVIEW_MS = 1500;
const ZOOM_MS = 1300;
const MAX_HOLD_MS = peperoHoldMsFor(PEPERO.maxKm);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// 위치(타일 번호)별로 항상 같은 값을 주는 의사난수 → 스크롤해도 배경이 바뀌지 않음
function rand(i, seed) {
  let t = (Math.imul(i | 0, 374761393) + Math.imul(seed, 668265263)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

const FAR_COLORS = ['#f2c3d3', '#eebfd8', '#f5cfc6', '#e9c4e0'];
const NEAR_COLORS = ['#b39ddb', '#90caf9', '#ffcc80', '#f48fb1', '#a5d6a7', '#ffab91', '#80deea', '#ce93d8'];
const LEAF_COLORS = ['#ffca28', '#ff8a65', '#ffb300', '#e57373', '#9ccc65', '#ffa726'];

export function mount(stage, { onFinish }) {
  stage.innerHTML = `
    <div class="pp-game">
      <div class="pp-top">
        <div class="pp-goal">🏁 목표 <b>11.11km</b></div>
        <div class="pp-msg" data-msg>목표 지점을 확인하세요!</div>
      </div>
      <canvas class="pp-canvas" data-canvas></canvas>
      <button class="btn btn-xl btn-primary pp-hold" data-hold tabindex="-1" disabled>누르고 있기</button>
      <p class="hint">스페이스바를 <b>누르고 있으면</b> 길어지고, <b>떼면</b> 멈춰요. 점점 빨라지니 조심!</p>
    </div>`;

  const canvas = stage.querySelector('[data-canvas]');
  const ctx = canvas.getContext('2d');
  const msg = stage.querySelector('[data-msg]');
  const holdBtn = stage.querySelector('[data-hold]');

  let phase = 'idle'; // idle → overview → zoom → ready → growing → stopped
  let phaseStart = performance.now();
  let holdStart = 0;
  let holdMs = 0;
  let lengthKm = 0;
  let cam = { ...OVERVIEW };
  let resultCam = null;
  let raf = 0;
  let W = 0;
  let H = 0;
  const timers = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const x = (km) => ((km - cam.left) / cam.width) * W;
  const groundY = () => H * 0.74;
  // 배경 레이어 스크롤량(px). factor 1 = 확대 상태에서 땅(눈금)과 같은 속도
  const scrollPx = (factor) => (cam.left + cam.width / 2) * (W / CLOSE_WIDTH) * factor;

  function setPhase(p) {
    phase = p;
    phaseStart = performance.now();
  }

  function start() {
    if (phase === 'idle') setPhase('overview');
  }

  // ── 입력 ──
  function press(ts) {
    if (phase !== 'ready') return;
    holdStart = ts;
    setPhase('growing');
    msg.textContent = '쭈우우욱…';
    holdBtn.classList.add('pressed');
  }
  function release(ts) {
    if (phase !== 'growing') return;
    holdMs = Math.min(MAX_HOLD_MS, Math.max(1, ts - holdStart));
    lengthKm = peperoLength(holdMs);
    holdBtn.classList.remove('pressed');
    holdBtn.disabled = true;
    setPhase('stopped');
    const failed = lengthKm >= PEPERO.maxKm;
    const diff = lengthKm - PEPERO.targetKm;
    msg.innerHTML = failed
      ? '너무 길어졌어요! 💥'
      : `<b>${lengthKm.toFixed(3)}km</b> (${diff >= 0 ? '+' : ''}${diff.toFixed(3)}km)`;
    const lo = Math.min(lengthKm, PEPERO.targetKm);
    const hi = Math.max(lengthKm, PEPERO.targetKm);
    const width = Math.max(1.2, (hi - lo) * 2.2);
    resultCam = { left: (lo + hi) / 2 - width / 2, width };
    timers.push(setTimeout(() => onFinish({ holdMs: Math.round(holdMs) }), 2600));
  }

  const onKeyDown = (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!e.repeat) press(e.timeStamp);
  };
  const onKeyUp = (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    release(e.timeStamp);
  };
  const onDown = (e) => {
    e.preventDefault();
    press(e.timeStamp);
  };
  const onUp = (e) => release(e.timeStamp);
  const onBlur = () => release(performance.now());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  holdBtn.addEventListener('pointerdown', onDown);
  holdBtn.addEventListener('pointerup', onUp);
  holdBtn.addEventListener('pointercancel', onUp);
  holdBtn.addEventListener('pointerleave', onUp);
  holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── 배경 ──
  function drawSky(now) {
    const gy = groundY();
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, '#ffd3e2');
    g.addColorStop(0.65, '#ffe9df');
    g.addColorStop(1, '#fff4e6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, gy);

    // 해
    const sx = W * 0.84;
    const sy = H * 0.2;
    const r = Math.max(18, H * 0.075);
    const glow = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 2.4);
    glow.addColorStop(0, 'rgba(255, 214, 120, 0.55)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r * 2.4, sy - r * 2.4, r * 4.8, r * 4.8);
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // 구름 (아주 느린 시차 + 바람)
    const slot = 280;
    const off = scrollPx(0.08) + now * 0.008;
    for (let i = Math.floor(off / slot) - 1; i <= Math.ceil((off + W) / slot); i++) {
      if (rand(i, 11) < 0.35) continue;
      const cx = i * slot - off + rand(i, 12) * slot * 0.6;
      const cy = H * (0.07 + rand(i, 13) * 0.2);
      const s = 0.7 + rand(i, 14) * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      blobs([
        [cx, cy, 34 * s, 13 * s],
        [cx + 22 * s, cy - 9 * s, 22 * s, 15 * s],
        [cx - 16 * s, cy - 6 * s, 18 * s, 12 * s],
      ]);
    }
  }

  function drawBuildings({ factor, slot, seed, colors, minH, maxH, detail }) {
    const gy = groundY();
    const off = scrollPx(factor);
    for (let i = Math.floor(off / slot) - 1; i <= Math.ceil((off + W) / slot) + 1; i++) {
      const bw = slot * (0.62 + rand(i, seed) * 0.36);
      const bh = H * (minH + (maxH - minH) * rand(i, seed + 1));
      const bx = i * slot - off + (slot - bw) * rand(i, seed + 2);
      const by = gy - bh;
      const color = colors[Math.floor(rand(i, seed + 3) * colors.length)];
      const roof = rand(i, seed + 4);

      ctx.fillStyle = color;
      ctx.fillRect(bx, by, bw, bh);
      if (roof < 0.22) {
        // 뾰족 지붕
        ctx.beginPath();
        ctx.moveTo(bx - 3, by);
        ctx.lineTo(bx + bw / 2, by - bw * 0.32);
        ctx.lineTo(bx + bw + 3, by);
        ctx.closePath();
        ctx.fill();
      } else if (roof > 0.78) {
        // 안테나
        ctx.fillRect(bx + bw * 0.7, by - bh * 0.18, 3, bh * 0.18);
        ctx.fillRect(bx + bw * 0.2, by - 8, bw * 0.25, 8);
      }
      if (!detail) continue;

      // 창문
      const cols = Math.max(2, Math.floor((bw - 12) / 15));
      const rows = Math.max(2, Math.floor((bh - 30) / 18));
      const gapX = (bw - 12) / cols;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const lit = rand(i * 131 + r * 17 + c, seed + 5) > 0.5;
          ctx.fillStyle = lit ? '#fff6c8' : 'rgba(255,255,255,0.4)';
          ctx.fillRect(bx + 6 + c * gapX + gapX * 0.22, by + 10 + r * 18, gapX * 0.56, 10);
        }
      }
      // 1층 문 / 가게 차양
      if (rand(i, seed + 6) < 0.45) {
        const aw = Math.min(bw - 10, 60);
        const ax = bx + (bw - aw) / 2;
        const ay = gy - 26;
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 ? '#ffffff' : '#ff6b8f';
          ctx.fillRect(ax + (aw / 6) * k, ay, aw / 6 + 0.5, 8);
        }
        ctx.fillStyle = 'rgba(90,50,26,0.55)';
        ctx.fillRect(ax + aw * 0.35, ay + 8, aw * 0.3, 18);
      } else {
        ctx.fillStyle = 'rgba(90,50,26,0.45)';
        ctx.fillRect(bx + bw / 2 - 7, gy - 20, 14, 20);
      }
      // 옥상 하트 간판
      if (roof > 0.45 && roof < 0.55) heart(bx + bw / 2, by - 14, 10, '#ff4f7b');
    }
  }

  // 겹친 타원 여러 개를 한 번에 채우기 (각각 moveTo 로 시작해야 쐐기 모양이 안 생김)
  function blobs(list) {
    ctx.beginPath();
    for (const [bx, by, rx, ry] of list) {
      ctx.moveTo(bx + rx, by);
      ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  function heart(cx, cy, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.4, cy, cx - s * 0.8, cy - s, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.8, cy - s, cx + s * 1.4, cy, cx, cy + s * 0.9);
    ctx.fill();
  }

  function drawStreet() {
    const gy = groundY();
    const off = scrollPx(1);
    const slot = 170;
    const treeH = H * 0.2;
    for (let i = Math.floor(off / slot) - 1; i <= Math.ceil((off + W) / slot) + 1; i++) {
      const tx = i * slot - off + 40;
      // 가로수 (가을 단풍)
      const leaf = LEAF_COLORS[Math.floor(rand(i, 31) * LEAF_COLORS.length)];
      const s = 0.85 + rand(i, 32) * 0.3;
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(tx - 4, gy - treeH * 0.45 * s, 8, treeH * 0.45 * s);
      ctx.fillStyle = leaf;
      const fr = treeH * 0.24 * s;
      const fy = gy - treeH * 0.62 * s;
      blobs([
        [tx, fy - fr * 0.5, fr, fr],
        [tx - fr * 0.75, fy + fr * 0.15, fr * 0.8, fr * 0.8],
        [tx + fr * 0.75, fy + fr * 0.15, fr * 0.8, fr * 0.8],
      ]);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(tx - fr * 0.3, fy - fr * 0.8, fr * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // 가로등
      const lx = tx + slot / 2;
      const lh = H * 0.19;
      ctx.fillStyle = '#6d6875';
      ctx.fillRect(lx - 2, gy - lh, 4, lh);
      ctx.fillRect(lx - 2, gy - lh, 16, 3);
      ctx.fillStyle = '#fff1a8';
      ctx.beginPath();
      ctx.arc(lx + 14, gy - lh + 7, 6, 0, Math.PI * 2);
      ctx.fill();
      // 화단
      ctx.fillStyle = '#7cb342';
      ctx.beginPath();
      ctx.ellipse(tx, gy - 2, 18, 6, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawGround() {
    const gy = groundY();
    // 인도(눈금자)
    ctx.fillStyle = '#f0dcc4';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#c99b63';
    ctx.fillRect(0, gy, W, 3);
    // 도로
    const ry = gy + Math.max(46, (H - gy) * 0.45);
    ctx.fillStyle = '#c2b8c9';
    ctx.fillRect(0, ry - 4, W, 4);
    ctx.fillStyle = '#8f8a9c';
    ctx.fillRect(0, ry, W, H - ry);
    const off = scrollPx(1.15);
    const dash = 60;
    ctx.fillStyle = '#fff';
    const my = ry + (H - ry) / 2 - 2;
    for (let i = Math.floor(off / dash) - 1; i <= Math.ceil((off + W) / dash); i++) {
      ctx.fillRect(i * dash - off, my, dash * 0.55, 4);
    }
  }

  function drawRuler() {
    const gy = groundY();
    const pxPerKm = W / cam.width;
    const step = pxPerKm * 0.1 >= 7 ? 0.1 : pxPerKm * 0.5 >= 7 ? 0.5 : 1;
    const first = Math.ceil(cam.left / step) * step;
    ctx.strokeStyle = '#7a5530';
    ctx.fillStyle = '#5b3a1e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${Math.max(11, Math.min(15, H * 0.035))}px system-ui, sans-serif`;
    for (let km = first; km <= cam.left + cam.width + step; km += step) {
      const k = Math.round(km * 10) / 10;
      if (k < 0) continue;
      const major = Math.abs(k - Math.round(k)) < 1e-6;
      const half = !major && Math.abs(k * 2 - Math.round(k * 2)) < 1e-6;
      const len = major ? 18 : half ? 11 : 6;
      const px = x(k);
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(px, gy);
      ctx.lineTo(px, gy + len);
      ctx.stroke();
      if (major && (pxPerKm >= 40 || k % 2 === 0)) ctx.fillText(`${k}km`, px, gy + 22);
      else if (!major && step === 0.1 && pxPerKm * 0.1 >= 55) {
        ctx.save();
        ctx.fillStyle = '#9a7a5c';
        ctx.font = `600 ${Math.max(10, Math.min(13, H * 0.03))}px system-ui, sans-serif`;
        ctx.fillText(k.toFixed(1), px, gy + 22);
        ctx.restore();
      }
    }
  }

  function outlinedText(text, tx, ty, fill) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeText(text, tx, ty);
    ctx.fillStyle = fill;
    ctx.fillText(text, tx, ty);
  }

  function drawStartAndTarget() {
    const gy = groundY();
    // 출발선
    const sx = x(0);
    ctx.strokeStyle = '#5b3a1e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, H * 0.34);
    ctx.lineTo(sx, gy);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `800 ${Math.max(12, H * 0.035)}px system-ui, sans-serif`;
    outlinedText('START', sx, H * 0.34 - 4, '#5b3a1e');

    // 목표선
    const tx = x(PEPERO.targetKm);
    const fy = H * 0.14;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(tx, fy);
    ctx.lineTo(tx, gy + 26);
    ctx.stroke();
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(tx, fy);
    ctx.lineTo(tx + 34, fy + 11);
    ctx.lineTo(tx, fy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = `900 ${Math.max(13, H * 0.042)}px system-ui, sans-serif`;
    outlinedText('11.11km', tx + 4, fy - 4, '#e53935');
  }

  function peperoY() {
    const th = Math.max(16, Math.min(32, H * 0.065));
    return { cy: groundY() - th / 2 - 6, th };
  }

  function drawPepero(len) {
    const { cy, th } = peperoY();
    const x0 = x(0);
    const xe = x(len);
    if (xe - x0 < 1) return;
    const xh = x(Math.min(len, HANDLE_KM));
    // 그림자
    ctx.fillStyle = 'rgba(90,50,26,0.18)';
    roundRect(x0 + 4, cy + th / 2 + 2, xe - x0, 5, 2.5);
    ctx.fill();
    // 비스킷 막대
    ctx.fillStyle = '#e9bf78';
    roundRect(x0, cy - th / 2, xe - x0, th, th / 2);
    ctx.fill();
    // 초콜릿
    if (len > HANDLE_KM) {
      const cg = ctx.createLinearGradient(0, cy - th / 2, 0, cy + th / 2);
      cg.addColorStop(0, '#7b4a26');
      cg.addColorStop(0.45, '#5a321a');
      cg.addColorStop(1, '#3d2010');
      ctx.fillStyle = cg;
      roundRect(xh, cy - th / 2 - 2, xe - xh, th + 4, (th + 4) / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(Math.max(xh, 0), cy - th / 2 + 2, Math.max(0, Math.min(xe, W) - Math.max(xh, 0)), 3);
      // 토핑
      const pxPerKm = W / cam.width;
      const gap = 0.12;
      if (pxPerKm * gap > 6) {
        const from = Math.max(HANDLE_KM + 0.05, Math.floor(cam.left / gap) * gap);
        const to = Math.min(len - 0.05, cam.left + cam.width);
        for (let k = from; k <= to; k += gap) {
          const i = Math.round(k / gap);
          const py = cy + (((i * 7) % 5) - 2) * (th / 7);
          ctx.fillStyle = ['#ff8fb1', '#fff3c4', '#9be7ff', '#ffd180'][i % 4];
          ctx.fillRect(x(k) - 2, py - 1.5, 5, 3);
        }
      }
    }
    // 속도선
    if (phase === 'growing') {
      const speed = PEPERO.v0 + PEPERO.accel * (holdMs / 1000);
      const n = Math.min(10, Math.round(speed * 3));
      ctx.strokeStyle = 'rgba(91,58,30,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < n; i++) {
        const oy = ((i * 37) % 60) - 30;
        const lx = xe - 20 - ((performance.now() / 3 + i * 53) % 80);
        ctx.beginPath();
        ctx.moveTo(lx, cy + oy * (th / 25));
        ctx.lineTo(lx - 30 - speed * 10, cy + oy * (th / 25));
        ctx.stroke();
      }
    }
  }

  function roundRect(rx, ry, rw, rh, r) {
    r = Math.max(0, Math.min(r, rw / 2, rh / 2));
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
  }

  function drawResultLabel() {
    const { cy, th } = peperoY();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `900 ${Math.max(15, H * 0.05)}px system-ui, sans-serif`;
    outlinedText(`${lengthKm.toFixed(3)}km`, x(lengthKm), cy - th / 2 - 10, '#3d2010');
  }

  function frame(now) {
    const t = now - phaseStart;
    if (phase === 'idle' || phase === 'overview') {
      cam = { ...OVERVIEW };
      if (phase === 'overview' && t >= OVERVIEW_MS) {
        setPhase('zoom');
        msg.textContent = '출발점으로 이동!';
      }
    } else if (phase === 'zoom') {
      const p = ease(Math.min(1, t / ZOOM_MS));
      const lw = Math.log(OVERVIEW.width) + (Math.log(CLOSE.width) - Math.log(OVERVIEW.width)) * p;
      cam = { left: OVERVIEW.left + (CLOSE.left - OVERVIEW.left) * p, width: Math.exp(lw) };
      if (t >= ZOOM_MS) {
        cam = { ...CLOSE };
        setPhase('ready');
        holdBtn.disabled = false;
        msg.innerHTML = '준비 완료! <b>스페이스바를 꾹</b> 누르세요';
      }
    } else if (phase === 'growing') {
      holdMs = now - holdStart;
      lengthKm = peperoLength(holdMs);
      if (holdMs >= MAX_HOLD_MS) release(holdStart + MAX_HOLD_MS);
      cam = { left: Math.max(CLOSE.left, lengthKm - CLOSE_WIDTH * TIP_RATIO), width: CLOSE_WIDTH };
    } else if (phase === 'stopped' && resultCam) {
      const p = ease(Math.min(1, Math.max(0, (t - 500) / 900)));
      const from = { left: Math.max(CLOSE.left, lengthKm - CLOSE_WIDTH * TIP_RATIO), width: CLOSE_WIDTH };
      cam = {
        left: from.left + (resultCam.left - from.left) * p,
        width: from.width + (resultCam.width - from.width) * p,
      };
    }

    drawSky(now);
    drawBuildings({ factor: 0.2, slot: 72, seed: 100, colors: FAR_COLORS, minH: 0.22, maxH: 0.46, detail: false });
    drawBuildings({ factor: 0.5, slot: 118, seed: 200, colors: NEAR_COLORS, minH: 0.16, maxH: 0.36, detail: true });
    drawStreet();
    drawGround();
    drawRuler();
    drawStartAndTarget();
    drawPepero(lengthKm);
    if (phase === 'stopped') drawResultLabel();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    start,
    destroy() {
      phase = 'destroyed';
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
