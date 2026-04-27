(function () {
  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function hexToRgb(hex) {
    const clean = String(hex).replace('#', '').trim();
    if (![3, 6].includes(clean.length)) return null;
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const value = Number.parseInt(full, 16);
    if (Number.isNaN(value)) return null;
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function parseColor(value) {
    if (!value) return null;
    const v = String(value).trim();
    if (v.startsWith('#')) return hexToRgb(v);
    const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  }

  function luminance(rgb) {
    if (!rgb) return 1;
    const map = [rgb.r, rgb.g, rgb.b].map((value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * map[0] + 0.7152 * map[1] + 0.0722 * map[2];
  }

  function detectTheme(source) {
    const explicit = source?.dataset?.ccTheme || source?.getAttribute?.('data-cc-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;

    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body || document.documentElement);
    const candidates = [
      source ? getComputedStyle(source).backgroundColor : '',
      bodyStyle.backgroundColor,
      rootStyle.backgroundColor,
      bodyStyle.colorScheme,
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.includes('dark')) return 'dark';
      const rgb = parseColor(value);
      if (rgb) return luminance(rgb) < 0.45 ? 'dark' : 'light';
    }

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  function applyTheme(theme, source) {
    const finalTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-cc-theme', finalTheme);
    if (source) {
      source.dataset.ccAppliedTheme = finalTheme;
    }
    return finalTheme;
  }

  function createCheckoutChampsApp(root, options = {}) {
    const themeSource = options.themeSource || root;
    const state = {
      theme: applyTheme(detectTheme(themeSource), themeSource),
      selectedGame: 'ttt',
      bestDiscount: Number(localStorage.getItem('cc_discount') || 0),
      bestResult: null,
      sessionPlayed: false,
      ttt: {
        board: Array(9).fill(''),
        finished: false,
        result: null,
      },
      timing: {
        running: false,
        marker: 10,
        direction: 1,
        rafId: null,
        result: null,
      },
      reaction: {
        phase: 'idle',
        startTime: null,
        timeoutId: null,
        result: null,
      },
    };

    const savedGame = localStorage.getItem('cc_game');
    const savedSummary = localStorage.getItem('cc_summary');
    const savedCode = localStorage.getItem('cc_discount_code');
    if (state.bestDiscount && savedGame && savedSummary && savedCode) {
      state.bestResult = {
        discount: state.bestDiscount,
        game: savedGame,
        summary: savedSummary,
        code: savedCode,
      };
    }

    const gameMeta = {
      ttt: {
        name: 'Tic Tac Toe',
        desc: 'Beat the house brain in one fast strategy round.',
        badges: ['Strategy', 'Top: 12%'],
      },
      timing: {
        name: 'Timing Bar',
        desc: 'Stop the marker as close to dead center as you can.',
        badges: ['Precision', 'Top: 15%'],
      },
      reaction: {
        name: 'Reaction Rush',
        desc: 'Wait for green, then strike fast without jumping early.',
        badges: ['Reflex', 'Top: 14%'],
      },
    };

    function saveReward(discount, game, summary) {
      if (discount > state.bestDiscount) {
        state.bestDiscount = discount;
        state.bestResult = {
          discount,
          game,
          summary,
          code: 'CHAMPS' + discount,
        };
      }
      state.sessionPlayed = true;
      localStorage.setItem('cc_discount', String(state.bestDiscount));
      localStorage.setItem('cc_game', game);
      localStorage.setItem('cc_summary', summary);
      localStorage.setItem('cc_discount_code', 'CHAMPS' + state.bestDiscount);
    }

    function tttWinningCombo(board, mark) {
      const combos = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6],
      ];
      return combos.some((combo) => combo.every((i) => board[i] === mark));
    }

    function tttEmptyIndices(board) {
      return board.map((v, i) => (v === '' ? i : -1)).filter((i) => i !== -1);
    }

    function findCriticalMove(board, mark) {
      const empties = tttEmptyIndices(board);
      for (const idx of empties) {
        const copy = [...board];
        copy[idx] = mark;
        if (tttWinningCombo(copy, mark)) return idx;
      }
      return null;
    }

    function aiMove() {
      const board = [...state.ttt.board];
      const empties = tttEmptyIndices(board);
      if (!empties.length) return;

      const winMove = findCriticalMove(board, 'O');
      if (winMove !== null) {
        board[winMove] = 'O';
        state.ttt.board = board;
        return;
      }

      const blockMove = findCriticalMove(board, 'X');
      if (blockMove !== null) {
        board[blockMove] = 'O';
        state.ttt.board = board;
        return;
      }

      if (board[4] === '') {
        board[4] = 'O';
        state.ttt.board = board;
        return;
      }

      const corners = [0,2,6,8].filter((i) => board[i] === '');
      if (corners.length) {
        board[corners[Math.floor(Math.random() * corners.length)]] = 'O';
        state.ttt.board = board;
        return;
      }

      board[empties[Math.floor(Math.random() * empties.length)]] = 'O';
      state.ttt.board = board;
    }

    function finalizeTtt(outcome) {
      state.ttt.finished = true;
      state.ttt.result = outcome;
      let discount = 0;
      let summary = '';
      if (outcome === 'win') {
        discount = 12;
        summary = 'You outplayed the house and earned the top reward.';
      } else if (outcome === 'draw') {
        discount = 7;
        summary = 'Solid defense. You held the line and earned a strong reward.';
      } else {
        discount = 3;
        summary = 'No full victory, but effort still earns a reward.';
      }
      saveReward(discount, 'Tic Tac Toe', summary);
      render();
    }

    function playTtt(index) {
      if (state.ttt.finished || state.ttt.board[index]) return;
      state.ttt.board[index] = 'X';

      if (tttWinningCombo(state.ttt.board, 'X')) {
        finalizeTtt('win');
        return;
      }
      if (tttEmptyIndices(state.ttt.board).length === 0) {
        finalizeTtt('draw');
        return;
      }

      aiMove();

      if (tttWinningCombo(state.ttt.board, 'O')) {
        finalizeTtt('lose');
        return;
      }
      if (tttEmptyIndices(state.ttt.board).length === 0) {
        finalizeTtt('draw');
        return;
      }

      render();
    }

    function resetTicTacToe() {
      state.ttt = { board: Array(9).fill(''), finished: false, result: null };
      render();
    }

    function renderTimingOnly() {
      const marker = root.querySelector('.cc-marker');
      if (marker) marker.style.left = `${state.timing.marker}%`;
    }

    function resetTiming() {
      if (state.timing.rafId) cancelAnimationFrame(state.timing.rafId);
      state.timing = { running: false, marker: 10, direction: 1, rafId: null, result: null };
      render();
    }

    function startTiming() {
      if (state.timing.running) return;
      state.timing.running = true;
      state.timing.result = null;
      let marker = 10;
      let direction = 1;
      let last = performance.now();

      function tick(now) {
        const delta = now - last;
        last = now;
        marker += direction * delta * 0.11;
        if (marker >= 98) {
          marker = 98;
          direction = -1;
        }
        if (marker <= 2) {
          marker = 2;
          direction = 1;
        }
        state.timing.marker = marker;
        state.timing.direction = direction;
        renderTimingOnly();
        state.timing.rafId = requestAnimationFrame(tick);
      }

      state.timing.rafId = requestAnimationFrame(tick);
      render();
    }

    function stopTiming() {
      if (!state.timing.running) return;
      cancelAnimationFrame(state.timing.rafId);
      state.timing.running = false;
      const distance = Math.abs(50 - state.timing.marker);
      let discount = 3;
      let rating = 'Good try';
      let summary = 'You got on the board with a baseline reward.';

      if (distance <= 2.5) {
        discount = 15;
        rating = 'Bullseye';
        summary = 'Dead center. That was sniper-grade precision.';
      } else if (distance <= 6) {
        discount = 10;
        rating = 'Sharp';
        summary = 'Very close to center. Strong reward unlocked.';
      } else if (distance <= 12) {
        discount = 6;
        rating = 'Solid';
        summary = 'Clean stop. You still earned a respectable reward.';
      }

      state.timing.result = { distance, discount, rating, summary };
      saveReward(discount, 'Timing Bar', summary);
      render();
    }

    function resetReaction() {
      if (state.reaction.timeoutId) clearTimeout(state.reaction.timeoutId);
      state.reaction = { phase: 'idle', startTime: null, timeoutId: null, result: null };
      render();
    }

    function startReaction() {
      if (state.reaction.phase === 'waiting') return;
      if (state.reaction.timeoutId) clearTimeout(state.reaction.timeoutId);

      state.reaction.phase = 'waiting';
      state.reaction.result = null;
      const delay = 1200 + Math.random() * 1800;
      state.reaction.timeoutId = setTimeout(() => {
        state.reaction.phase = 'go';
        state.reaction.startTime = performance.now();
        state.reaction.timeoutId = null;
        render();
      }, delay);
      render();
    }

    function clickReaction() {
      if (state.reaction.phase === 'waiting') {
        if (state.reaction.timeoutId) clearTimeout(state.reaction.timeoutId);
        state.reaction.phase = 'busted';
        state.reaction.result = {
          label: 'Too early',
          time: null,
          discount: 2,
          summary: 'Trigger discipline failed, but you still get a small save-the-sale reward.',
        };
        saveReward(2, 'Reaction Rush', state.reaction.result.summary);
        render();
        return;
      }

      if (state.reaction.phase !== 'go') return;

      const reactionMs = Math.round(performance.now() - state.reaction.startTime);
      let discount = 3;
      let label = 'Quick';
      let summary = 'Fast enough to claim a small reward.';

      if (reactionMs <= 220) {
        discount = 14;
        label = 'Lightning';
        summary = 'Ridiculous reaction speed. Top-tier reward unlocked.';
      } else if (reactionMs <= 320) {
        discount = 9;
        label = 'Sharp';
        summary = 'Very fast response. Strong reward earned.';
      } else if (reactionMs <= 430) {
        discount = 5;
        label = 'Clean';
        summary = 'Good reflexes. You earned a decent reward.';
      }

      state.reaction.phase = 'done';
      state.reaction.result = { label, time: reactionMs, discount, summary };
      saveReward(discount, 'Reaction Rush', summary);
      render();
    }

    function summaryHtml() {
      if (!state.bestResult) {
        return `
          <div class="cc-summary-card">
            <div class="cc-discount-big">0%</div>
            <div>No reward locked yet.</div>
            <p class="cc-note">Play one of the games to generate a discount code and simulate a checkout reward flow.</p>
          </div>`;
      }

      return `
        <div class="cc-summary-card">
          <div class="cc-discount-big">${state.bestDiscount}% OFF</div>
          <div><strong>${escapeHtml(state.bestResult.game)}</strong></div>
          <p>${escapeHtml(state.bestResult.summary)}</p>
          <div class="cc-code">${escapeHtml(state.bestResult.code)}</div>
          <p class="cc-note">Saved to localStorage as cc_discount, cc_game, cc_summary, and cc_discount_code.</p>
          <div class="cc-trust-line">Theme auto-detected from the host site so the widget feels native instead of bolted on.</div>
        </div>`;
    }

    function tttHtml() {
      const status = state.ttt.finished
        ? (state.ttt.result === 'win'
          ? 'You won the board. That is the top strategy payout.'
          : state.ttt.result === 'draw'
            ? 'Draw secured. You still earned a strong discount.'
            : 'The house got this round, but Checkout Champs still gives you something.')
        : 'Place X. The house answers with O. No dead round, no dead reward.';

      return `
        <div class="cc-stage-title">
          <div>
            <h3>Tic Tac Toe</h3>
            <p>Fast strategy. Clean dopamine. Instant reward.</p>
          </div>
          <div class="cc-pill">Top reward: 12%</div>
        </div>
        <div class="cc-status">${escapeHtml(status)}</div>
        <div class="cc-ttt-board">
          ${state.ttt.board.map((cell, index) => `
            <button class="cc-ttt-cell" data-ttt-index="${index}" ${cell || state.ttt.finished ? 'disabled' : ''}>${cell || ''}</button>
          `).join('')}
        </div>
        <div class="cc-actions">
          <button class="cc-btn secondary" data-action="reset-ttt">Play this round again</button>
        </div>`;
    }

    function timingHtml() {
      const result = state.timing.result;
      const status = result
        ? `${result.rating} — ${result.discount}% unlocked.`
        : state.timing.running
          ? 'Stop the marker as close to the center zone as possible.'
          : 'Precision game. Start the bar, then stop it in the sweet spot.';

      return `
        <div class="cc-stage-title">
          <div>
            <h3>Timing Bar</h3>
            <p>Simple to understand. Hard to nail perfectly.</p>
          </div>
          <div class="cc-pill">Top reward: 15%</div>
        </div>
        <div class="cc-status">${escapeHtml(status)}</div>
        <div class="cc-meter-wrap">
          <div class="cc-meter">
            <div class="cc-center-zone"></div>
            <div class="cc-marker" style="left:${state.timing.marker}%"></div>
          </div>
        </div>
        ${result ? `
          <div class="cc-mini-stats">
            <div class="cc-stat"><span>Rating</span><strong>${escapeHtml(result.rating)}</strong></div>
            <div class="cc-stat"><span>Distance</span><strong>${result.distance.toFixed(1)}</strong></div>
            <div class="cc-stat"><span>Reward</span><strong>${result.discount}%</strong></div>
          </div>` : ''}
        <div class="cc-actions">
          <button class="cc-btn" data-action="${state.timing.running ? 'stop-timing' : 'start-timing'}">${state.timing.running ? 'Stop marker' : 'Start game'}</button>
          <button class="cc-btn secondary" data-action="reset-timing">Reset</button>
        </div>`;
    }

    function reactionHtml() {
      const phase = state.reaction.phase;
      const result = state.reaction.result;
      let light = '';
      let text = 'Click start. Wait for green. Tap too early and you still get a tiny mercy reward.';

      if (phase === 'waiting') {
        light = 'waiting';
        text = 'Wait… do not click yet.';
      } else if (phase === 'go') {
        light = 'go';
        text = 'GO. HIT IT.';
      } else if (phase === 'busted') {
        light = 'busted';
        text = 'Too early. Trigger discipline matters.';
      } else if (phase === 'done' && result) {
        light = 'go';
        text = `${result.label}${result.time ? ` — ${result.time}ms.` : '.'} Reward locked at ${result.discount}%.`;
      }

      return `
        <div class="cc-stage-title">
          <div>
            <h3>Reaction Rush</h3>
            <p>A single clean reflex challenge. Fast, brutal, satisfying.</p>
          </div>
          <div class="cc-pill">Top reward: 14%</div>
        </div>
        <div class="cc-status">${escapeHtml(text)}</div>
        <div class="cc-reaction-stage">
          <div class="cc-light ${light}"></div>
          <div class="cc-actions" style="justify-content:center;">
            <button class="cc-btn" data-action="start-reaction">Start round</button>
            <button class="cc-btn secondary" data-action="click-reaction">Tap</button>
            <button class="cc-btn ghost" data-action="reset-reaction">Reset</button>
          </div>
        </div>
        ${result ? `
          <div class="cc-mini-stats">
            <div class="cc-stat"><span>Tier</span><strong>${escapeHtml(result.label)}</strong></div>
            <div class="cc-stat"><span>Time</span><strong>${result.time !== null ? `${result.time}ms` : '—'}</strong></div>
            <div class="cc-stat"><span>Reward</span><strong>${result.discount}%</strong></div>
          </div>` : ''}`;
    }

    function stageHtml() {
      if (state.selectedGame === 'ttt') return tttHtml();
      if (state.selectedGame === 'timing') return timingHtml();
      return reactionHtml();
    }

    function render() {
      root.innerHTML = `
        <div class="cc-shell">
          <div class="cc-header">
            <div class="cc-kicker">Checkout conversion game layer</div>
            <div class="cc-title-row">
              <div>
                <h1 class="cc-title">Checkout Champs</h1>
                <p class="cc-subtitle">Three fast reward games, one purpose: make checkout feel earned instead of annoying.</p>
              </div>
              <div class="cc-pill-row">
                <div class="cc-theme-badge">Theme: ${state.theme}</div>
                <div class="cc-pill">Wix MVP build</div>
              </div>
            </div>
          </div>
          <div class="cc-body">
            <div class="cc-grid">
              <div class="cc-panel">
                <h2>Pick your challenge</h2>
                <p class="cc-note">Theme is auto-detected from the host site so Checkout Champs feels native by default.</p>
                <div class="cc-game-list">
                  ${Object.entries(gameMeta).map(([key, meta]) => `
                    <div class="cc-game-card ${state.selectedGame === key ? 'active' : ''}" data-game="${key}">
                      <h4>${escapeHtml(meta.name)}</h4>
                      <p>${escapeHtml(meta.desc)}</p>
                      <div class="cc-badges">
                        ${meta.badges.map((badge) => `<span class="cc-badge">${escapeHtml(badge)}</span>`).join('')}
                      </div>
                    </div>`).join('')}
                </div>
              </div>
              <div class="cc-panel">
                <h2>Reward lock</h2>
                ${summaryHtml()}
              </div>
            </div>
            <div class="cc-panel cc-stage" style="margin-top:18px;">
              ${stageHtml()}
            </div>
          </div>
          <div class="cc-footer">Front-end demo build for Checkout Champs. Current session stores reward data in localStorage so you can simulate discount flow before wiring platform checkout rules.</div>
        </div>`;

      root.querySelectorAll('[data-game]').forEach((el) => {
        el.addEventListener('click', () => {
          state.selectedGame = el.getAttribute('data-game');
          render();
        });
      });

      root.querySelectorAll('[data-ttt-index]').forEach((el) => {
        el.addEventListener('click', () => playTtt(Number(el.getAttribute('data-ttt-index'))));
      });

      root.querySelectorAll('[data-action]').forEach((el) => {
        el.addEventListener('click', () => {
          const action = el.getAttribute('data-action');
          if (action === 'reset-ttt') resetTicTacToe();
          if (action === 'start-timing') startTiming();
          if (action === 'stop-timing') stopTiming();
          if (action === 'reset-timing') resetTiming();
          if (action === 'start-reaction') startReaction();
          if (action === 'click-reaction') clickReaction();
          if (action === 'reset-reaction') resetReaction();
        });
      });
    }

    render();
    return { detectTheme, applyTheme };
  }

  const root = document.getElementById('app');
  if (root) createCheckoutChampsApp(root, { themeSource: document.body });
})();
