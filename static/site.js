(function () {
  'use strict';

  // Obfuscated contacts

  for (const el of document.querySelectorAll('.obf[data-href]')) {
    const link = document.createElement('a');
    link.href = atob(el.dataset.href);
    link.textContent = atob(el.dataset.text);
    if (link.protocol !== 'mailto:') link.target = '_blank';
    el.replaceChildren(link);
  }

  // Status bar

  const status = document.querySelector('.statusbar__field--main');
  if (status) {
    const idle = status.textContent;
    const show = (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      status.textContent = a ? a.href : idle;
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('focusin', show);
  }

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
})();
