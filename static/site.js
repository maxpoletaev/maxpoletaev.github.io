(function () {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Visitor counter

  const counterBox = document.querySelector('.counter-box');
  if (counterBox) {
    fetch('https://mxp.goatcounter.com/counter/TOTAL.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        const digits = String(data.count).replace(/\D/g, '').padStart(6, '0');
        const el = counterBox.querySelector('.counter');
        el.setAttribute('aria-label', `${Number(digits)} visitors`);
        for (const d of digits) {
          const span = document.createElement('span');
          span.textContent = d;
          el.appendChild(span);
        }
        counterBox.hidden = false;
      })
      .catch(() => {});
  }

  // Poll

  const POLL_KEY = 'poll-game';
  const POLL_SEED = { Tetris: 3, Doom: 27, 'Heroes III': 29, 'Half-Life': 34 };
  const form = document.querySelector('.poll__form');
  const results = document.querySelector('.poll__results');

  function showResults(choice) {
    const options = Array.from(form.querySelectorAll('input')).map((i) => i.value);
    const counts = {};
    let total = 0;
    for (const opt of options) {
      counts[opt] = (POLL_SEED[opt] || 0) + (opt === choice ? 1 : 0);
      total += counts[opt];
    }


    const exact = options.map((opt) => (counts[opt] / total) * 100);
    const pcts = exact.map(Math.floor);
    const missing = 100 - pcts.reduce((a, b) => a + b, 0);

    exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac)
      .slice(0, missing)
      .forEach(({ i }) => (pcts[i] += 1));

    results.textContent = '';
    options.forEach((opt, i) => {
      const row = document.createElement('div');
      row.className = 'poll__row';
      row.innerHTML = `<span></span> <b>${pcts[i]}%</b><div class="poll__bar"><span style="width:${pcts[i]}%"></span></div>`;
      row.firstChild.textContent = opt;
      results.appendChild(row);
    });
    const totalEl = document.createElement('div');
    totalEl.className = 'small';
    totalEl.textContent = `Total votes: ${total}. Thank you for voting!`;
    results.appendChild(totalEl);
    form.hidden = true;
    results.hidden = false;
  }

  if (form && results) {
    const saved = localStorage.getItem(POLL_KEY);
    if (saved) showResults(saved);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const checked = form.querySelector('input:checked');
      if (!checked) return;
      localStorage.setItem(POLL_KEY, checked.value);
      showResults(checked.value);
    });
  }

  // Snow, in winter (or with ?snow)

  const month = new Date().getMonth();
  const winter = month === 11 || month === 0 || month === 1;
  if (reduceMotion || !(winter || /[?&]snow\b/.test(location.search))) return;

  const FLAKES = 40;
  const flakes = [];
  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  function reset(f, top) {
    f.x = Math.random() * W();
    f.y = top ? -20 : Math.random() * H();
    f.speed = 20 + Math.random() * 40;
    f.sway = 10 + Math.random() * 25;
    f.phase = Math.random() * Math.PI * 2;
  }

  for (let i = 0; i < FLAKES; i++) {
    const el = document.createElement('div');
    el.className = 'snowflake';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = Math.random() < 0.5 ? '*' : '❄';
    el.style.fontSize = 8 + Math.random() * 12 + 'px';
    el.style.opacity = 0.6 + Math.random() * 0.4;
    document.body.appendChild(el);
    const f = { el };
    reset(f, false);
    flakes.push(f);
  }

  let last = null;
  function tick(ts) {
    const dt = last === null ? 0 : Math.min(ts - last, 100) / 1000;
    last = ts;
    for (const f of flakes) {
      f.y += f.speed * dt;
      f.phase += dt;
      if (f.y > H() + 20) reset(f, true);
      const x = f.x + Math.sin(f.phase) * f.sway;
      f.el.style.transform = `translate(${x}px, ${f.y}px)`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
