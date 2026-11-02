import { CARDS } from '../shared/rules.js';
import { symbolSvg } from './symbols.js';

/**
 * 카드 짝맞추기
 * deck 은 서버가 매 판 랜덤으로 섞어서 내려줌 → 매번 배치가 달라짐
 * mount 시점엔 뒷면만 보이고, start() (3·2·1 이후) 에 미리보기 → 게임 시작
 */
export function mount(stage, { attempt, onFinish }) {
  const deck = attempt.deck;
  stage.innerHTML = `
    <div class="cards-game">
      <div class="game-hud">
        <div class="hud-item"><span class="hud-label">시간</span><span class="hud-value" data-time>0.00</span></div>
        <div class="hud-msg" data-msg>곧 카드가 공개돼요!</div>
        <div class="hud-item"><span class="hud-label">찾은 짝</span><span class="hud-value" data-pairs>0 / ${CARDS.pairs}</span></div>
      </div>
      <div class="card-grid preview" data-grid>
        ${deck
          .map(
            (sym, i) => `
          <button class="card" data-i="${i}" tabindex="-1" aria-label="카드 ${i + 1}">
            <span class="card-inner">
              <span class="card-face card-back"></span>
              <span class="card-face card-front">${symbolSvg(sym)}</span>
            </span>
          </button>`,
          )
          .join('')}
      </div>
    </div>`;

  const grid = stage.querySelector('[data-grid]');
  const timeEl = stage.querySelector('[data-time]');
  const pairsEl = stage.querySelector('[data-pairs]');
  const msgEl = stage.querySelector('[data-msg]');
  const cards = [...grid.querySelectorAll('.card')];

  const matched = new Array(deck.length).fill(false);
  const flips = [];
  let open = [];
  let locked = true;
  let t0 = 0;
  let found = 0;
  let raf = 0;
  let done = false;
  const timers = [];

  function start() {
    // 미리보기: 전체 공개 + 카운트다운
    cards.forEach((c) => c.classList.add('is-open'));
    const previewEnd = performance.now() + CARDS.previewMs;
    const countdown = () => {
      const left = Math.ceil((previewEnd - performance.now()) / 1000);
      if (left > 0 && !done) {
        msgEl.textContent = `잘 기억하세요! ${left}`;
        raf = requestAnimationFrame(countdown);
      }
    };
    countdown();

    timers.push(
      setTimeout(() => {
        cancelAnimationFrame(raf);
        cards.forEach((c) => c.classList.remove('is-open'));
        grid.classList.remove('preview');
        msgEl.textContent = '같은 그림을 찾으세요!';
        t0 = performance.now();
        locked = false;
        tick();
      }, CARDS.previewMs),
    );
  }

  function tick() {
    timeEl.textContent = ((performance.now() - t0) / 1000).toFixed(2);
    if (!done) raf = requestAnimationFrame(tick);
  }

  function onPointer(e) {
    const card = e.target.closest('.card');
    if (!card || locked || done) return;
    e.preventDefault();
    const i = Number(card.dataset.i);
    if (matched[i] || open.includes(i)) return;

    const t = Math.max(0, Math.round(performance.now() - t0));
    flips.push([i, t]);
    card.classList.add('is-open');
    open.push(i);
    if (open.length < 2) return;

    const [a, b] = open;
    open = [];
    if (deck[a] === deck[b]) {
      matched[a] = matched[b] = true;
      found += 1;
      pairsEl.textContent = `${found} / ${CARDS.pairs}`;
      for (const k of [a, b]) cards[k].classList.add('is-matched');
      if (found === CARDS.pairs) finish(t);
    } else {
      locked = true;
      for (const k of [a, b]) cards[k].classList.add('is-wrong');
      timers.push(
        setTimeout(() => {
          for (const k of [a, b]) cards[k].classList.remove('is-open', 'is-wrong');
          locked = false;
        }, CARDS.mismatchMs),
      );
    }
  }

  function finish(tMs) {
    done = true;
    cancelAnimationFrame(raf);
    timeEl.textContent = (tMs / 1000).toFixed(2);
    msgEl.textContent = '🎉 완료!';
    grid.classList.add('cleared');
    timers.push(setTimeout(() => onFinish({ flips }), 1200));
  }

  grid.addEventListener('pointerdown', onPointer);

  return {
    start,
    destroy() {
      done = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      grid.removeEventListener('pointerdown', onPointer);
    },
  };
}
