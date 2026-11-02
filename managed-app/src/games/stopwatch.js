import { STOPWATCH } from '../shared/rules.js';

/**
 * 11초 11 맞추기
 * 3·2·1 이 끝나면(start) 시간이 흐르기 시작 → 3초 뒤 가려짐 → 감으로 정지
 */
export function mount(stage, { onFinish }) {
  stage.innerHTML = `
    <div class="sw-game">
      <p class="sw-guide" data-guide>시간이 흐르다가 <b>3초 뒤 가려져요.</b><br/>정확히 <b>11.11초</b>에 멈추세요!</p>
      <div class="sw-display" data-display>
        <span class="sw-num" data-num>0.00</span><span class="sw-unit">초</span>
        <div class="sw-curtain" data-curtain><span>?? . ??</span></div>
      </div>
      <div class="sw-target">목표 <b>11.11</b>초</div>
      <button class="btn btn-xl btn-stop" data-btn tabindex="-1" disabled>정지!</button>
      <p class="hint">버튼 또는 스페이스바로 정지</p>
    </div>`;

  const num = stage.querySelector('[data-num]');
  const curtain = stage.querySelector('[data-curtain]');
  const btn = stage.querySelector('[data-btn]');
  const guide = stage.querySelector('[data-guide]');
  let phase = 'ready';
  let t0 = 0;
  let raf = 0;
  const timers = [];

  function start() {
    if (phase !== 'ready') return;
    phase = 'running';
    t0 = performance.now();
    btn.disabled = false;
    guide.innerHTML = '두근두근… 감으로 <b>11.11초</b>에 정지!';
    const loop = () => {
      const e = performance.now() - t0;
      if (e >= STOPWATCH.revealMs) {
        num.textContent = (STOPWATCH.revealMs / 1000).toFixed(2);
        curtain.classList.add('show');
      } else {
        num.textContent = (e / 1000).toFixed(2);
      }
      if (e >= STOPWATCH.timeoutMs) return stop(t0 + STOPWATCH.timeoutMs);
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function stop(ts) {
    if (phase !== 'running') return;
    phase = 'stopped';
    cancelAnimationFrame(raf);
    const stoppedMs = Math.max(1, Math.round(ts - t0));
    btn.disabled = true;
    btn.textContent = '멈춤!';
    curtain.classList.remove('show');
    num.textContent = (stoppedMs / 1000).toFixed(3);
    const diff = (stoppedMs - STOPWATCH.targetMs) / 1000;
    guide.innerHTML = `오차 <b>${diff >= 0 ? '+' : ''}${diff.toFixed(3)}초</b>`;
    stage.querySelector('[data-display]').classList.add('revealed');
    timers.push(setTimeout(() => onFinish({ stoppedMs }), 1800));
  }

  const onKey = (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!e.repeat) stop(e.timeStamp);
  };
  const onBtn = (e) => {
    e.preventDefault();
    stop(e.timeStamp);
  };
  window.addEventListener('keydown', onKey);
  btn.addEventListener('pointerdown', onBtn);

  return {
    start,
    destroy() {
      phase = 'destroyed';
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
    },
  };
}
