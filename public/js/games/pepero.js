import { PEPERO, peperoLength, peperoHoldMsFor } from '../shared/rules.js';

/**
 * 11.11km 빼빼로 만들기
 *  1) 멀리서 전체 코스와 목표선(11.11km)을 보여줌
 *  2) 출발점으로 확대
 *  3) 스페이스바(또는 버튼)를 누르고 있으면 가속하며 길어지고, 카메라가 횡스크롤로 따라감
 *  4) 떼는 순간 멈추고 길이를 공개
 */
const OVERVIEW = { left: -0.8, width: 13.8 };
const CLOSE_WIDTH = 4; // 확대 시 화면에 보이는 길이(km)
const TIP_RATIO = 0.6; // 빼빼로 끝이 화면 가로 60% 지점에 오도록 따라감
const CLOSE = { left: -CLOSE_WIDTH * 0.15, width: CLOSE_WIDTH };
const HANDLE_KM = 0.45; // 초콜릿이 안 묻은 손잡이 부분
const OVERVIEW_MS = 2600;
const ZOOM_MS = 1300;
const MAX_HOLD_MS = peperoHoldMsFor(PEPERO.maxKm);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

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

  let phase = 'overview'; // overview → zoom → ready → growing → stopped → result
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

  function setPhase(p) {
    phase = p;
    phaseStart = performance.now();
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

  // ── 그리기 ──
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffe3ec');
    g.addColorStop(1, '#fff6ea');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function groundY() {
    return H * 0.72;
  }

  function drawRuler() {
    const gy = groundY();
    ctx.fillStyle = '#f3d9b1';
    ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#c99b63';
    ctx.fillRect(0, gy, W, 3);

    const pxPerKm = W / cam.width;
    const step = pxPerKm * 0.1 >= 7 ? 0.1 : pxPerKm * 0.5 >= 7 ? 0.5 : 1;
    const first = Math.ceil(cam.left / step) * step;
    ctx.strokeStyle = '#7a5530';
    ctx.fillStyle = '#5b3a1e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${Math.max(11, Math.min(15, H * 0.035))}px system-ui, sans-serif`;
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
    }
  }

  function drawStartAndTarget() {
    const gy = groundY();
    // 출발선
    const sx = x(0);
    ctx.strokeStyle = '#5b3a1e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, H * 0.3);
    ctx.lineTo(sx, gy);
    ctx.stroke();
    ctx.fillStyle = '#5b3a1e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 ${Math.max(12, H * 0.035)}px system-ui, sans-serif`;
    ctx.fillText('START', sx, H * 0.3 - 4);

    // 목표선
    const tx = x(PEPERO.targetKm);
    ctx.save();
    ctx.strokeStyle = '#e53935';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(tx, H * 0.16);
    ctx.lineTo(tx, gy + 26);
    ctx.stroke();
    ctx.restore();
    // 깃발
    const fy = H * 0.16;
    ctx.fillStyle = '#e53935';
    ctx.beginPath();
    ctx.moveTo(tx, fy);
    ctx.lineTo(tx + 34, fy + 11);
    ctx.lineTo(tx, fy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = `800 ${Math.max(13, H * 0.042)}px system-ui, sans-serif`;
    ctx.fillText('11.11km', tx + 4, fy - 4);
  }

  function drawPepero(len) {
    const cy = H * 0.52;
    const th = Math.max(16, Math.min(34, H * 0.07));
    const x0 = x(0);
    const xe = x(len);
    if (xe - x0 < 1) return;
    const xh = x(Math.min(len, HANDLE_KM));
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
      // 하이라이트 + 토핑
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(Math.max(xh, 0), cy - th / 2 + 2, Math.min(xe, W) - Math.max(xh, 0), 3);
      const pxPerKm = W / cam.width;
      const gap = 0.12;
      const from = Math.max(HANDLE_KM + 0.05, Math.floor(cam.left / gap) * gap);
      const to = Math.min(len - 0.05, cam.left + cam.width);
      if (pxPerKm * gap > 6) {
        for (let k = from; k <= to; k += gap) {
          const i = Math.round(k / gap);
          const px = x(k);
          const py = cy + ((i * 7) % 5 - 2) * (th / 7);
          ctx.fillStyle = ['#ff8fb1', '#fff3c4', '#9be7ff', '#ffd180'][i % 4];
          ctx.fillRect(px - 2, py - 1.5, 5, 3);
        }
      }
    }
    // 속도선
    if (phase === 'growing') {
      const speed = PEPERO.v0 + PEPERO.accel * (holdMs / 1000);
      const n = Math.min(10, Math.round(speed * 3));
      ctx.strokeStyle = 'rgba(91,58,30,0.35)';
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
    r = Math.min(r, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
  }

  function drawResultLabel() {
    const xe = x(lengthKm);
    const cy = H * 0.52;
    ctx.fillStyle = '#1e1e1e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${Math.max(14, H * 0.045)}px system-ui, sans-serif`;
    ctx.fillText(`${lengthKm.toFixed(3)}km`, xe, cy + H * 0.06);
  }

  function frame(now) {
    const t = now - phaseStart;
    if (phase === 'overview') {
      cam = { ...OVERVIEW };
      if (t >= OVERVIEW_MS) {
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

    drawBackground();
    drawRuler();
    drawStartAndTarget();
    drawPepero(lengthKm);
    if (phase === 'stopped') drawResultLabel();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
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
