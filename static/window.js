(function () {
  'use strict';

  const root = document.documentElement;
  const win = document.querySelector('.page.win');
  const titlebar = win && win.querySelector('.titlebar');
  if (!win || !titlebar) return;

  const title = titlebar.querySelector('.titlebar__text').textContent;
  const STORAGE_KEY = 'window';

  // <head> already applied the saved state, see base.html.
  let saved = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch (err) {}

  function currentState() {
    if (root.classList.contains('is-minimized')) return 'minimized';
    if (root.classList.contains('is-closed')) return 'closed';
    return '';
  }

  function save() {
    const data = {
      x: winDrag.x,
      y: winDrag.y,
      max: root.classList.contains('is-maximized'),
      state: currentState(),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {}
  }

  // Window controls

  function makeDraggable(el, handle, { x = 0, y = 0, apply, canDrag = () => true, onEnd = () => {} }) {
    const d = { x, y, clamp, set };
    let grab = null;

    function set(nx, ny) {
      d.x = nx;
      d.y = ny;
      apply(nx, ny);
    }

    function clamp() {
      const keep = 80;
      const minX = -(el.offsetLeft + el.offsetWidth - keep);
      const maxX = window.innerWidth - el.offsetLeft - keep;
      let ny = Math.max(-el.offsetTop, d.y);
      if (getComputedStyle(el).position === 'fixed') {
        ny = Math.min(window.innerHeight - el.offsetTop - handle.offsetHeight, ny);
      }
      set(Math.min(maxX, Math.max(minX, d.x)), ny);
    }

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      if (e.target.closest('button') || !canDrag()) return;
      grab = { x: e.clientX - d.x, y: e.clientY - d.y };
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      root.classList.add('is-dragging');
    });

    handle.addEventListener('pointermove', (e) => {
      if (!grab) return;
      d.x = e.clientX - grab.x;
      d.y = e.clientY - grab.y;
      clamp();
    });

    function end() {
      if (!grab) return;
      grab = null;
      root.classList.remove('is-dragging');
      onEnd();
    }

    handle.classList.add('is-draggable');
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);

    return d;
  }

  function bindActions(bar, actions) {
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      const fn = btn && actions[btn.dataset.action];
      if (fn) fn();
    });
  }

  // Main window dragging

  const winDrag = makeDraggable(win, titlebar, {
    x: Number(saved.x) || 0,
    y: Number(saved.y) || 0,
    apply: (x, y) => {
      if (x || y) {
        root.style.setProperty('--win-offset', `${x}px ${y}px`);
      } else {
        root.style.removeProperty('--win-offset');
      }
    },
    canDrag: () => !root.classList.contains('is-maximized'),
    onEnd: save,
  });


  function reclamp() {
    if (!currentState()) winDrag.clamp();
  }

  // Maximize

  const maxBtn = titlebar.querySelector('[data-action="maximize"]');

  function toggleMaximize() {
    const on = root.classList.toggle('is-maximized');
    maxBtn.setAttribute('aria-label', on ? 'Restore' : 'Maximize');
    save();
  }

  titlebar.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button')) toggleMaximize();
  });

  // Taskbar and desktop icon, created on demand

  let taskbar = null;
  let taskBtn = null;
  let icon = null;
  let desktop = null;
  let hlIcon = null;
  let dialog = null;
  let clockTimer = null;

  function makeIcon(cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function makeDesktopIcon(imgClass, text, open) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'desktop-icon';
    const label = document.createElement('span');
    label.className = 'desktop-icon__label';
    label.textContent = text;
    el.append(makeIcon(imgClass), label);
    el.addEventListener('dblclick', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') open();
    });
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') open();
    });
    return el;
  }

  function withCursor(kind, ms, fn) {
    root.classList.add(`is-${kind}`);
    setTimeout(() => {
      root.classList.remove(`is-${kind}`);
      fn();
    }, ms);
  }

  let hlStarting = false;
  function openHalfLife() {
    if (dialog) {
      dialog.querySelector('[data-action="retry"]').focus();
      return;
    }
    if (hlStarting) return;
    hlStarting = true;
    withCursor('busy', 1500, () => {
      hlStarting = false;
      if (taskbar) showDiskError();
    });
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.remove();
    dialog = null;
    if (hlIcon) hlIcon.focus();
  }

  function showDiskError() {
    if (dialog) dialog.remove();
    const tpl = document.getElementById('disk-error');
    const el = (dialog = tpl.content.firstElementChild.cloneNode(true));
    const retry = el.querySelector('[data-action="retry"]');

    makeDraggable(el, el.querySelector('.titlebar'), {
      apply: (x, y) => { el.style.translate = `${x}px ${y}px`; },
    });

    bindActions(el, {
      close: closeDialog,
      retry: () => {
        el.hidden = true;
        withCursor('waiting', 1200, () => {
          if (dialog !== el) return;
          el.hidden = false;
          retry.focus();
        });
      },
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDialog();
    });

    document.body.append(el);
    retry.focus();
  }

  // Winamp (Webamp), loaded from unpkg on first open
  // Plays LukHash, "Digital Memories" (CC BY-NC-ND 3.0)

  const WEBAMP_SRC = 'https://unpkg.com/webamp@2.3.1/built/webamp.bundle.min.js';
  const WEBAMP_SRI = 'sha384-9waE2xOw4VkyDDXbmumm9jR3ovD2w9gGl0+ehyi66rJSOPx9lyNxs8+jSS2HruM6';
  const LUKHASH = 'https://archive.org/download/ShMusic-DigitalMemories/';
  const WEBAMP_TRACKS = [
    ['04-DigitalMemories.mp3', 'Digital Memories', 189],
    ['09-PixelMyHeart.mp3', 'Pixel My Heart', 215],
    ['03-WinterError.mp3', 'Winter Error', 227],
  ].map(([file, title, duration]) => ({
    metaData: { artist: 'LukHash', title },
    url: LUKHASH + file,
    duration,
  }));

  let webamp = null;
  let webampClosed = false;
  let webampStarting = false;

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => {
        s.remove();
        reject(new Error(`failed to load ${src}`));
      };
      document.head.append(s);
    });
  }

  async function openWinamp() {
    if (webamp) {
      if (webampClosed) {
        webampClosed = false;
        webamp.reopen();
      }
      return;
    }
    if (webampStarting) return;
    webampStarting = true;
    root.classList.add('is-busy');

    const anchor = document.createElement('div');
    anchor.className = 'webamp-anchor';
    document.body.append(anchor);

    try {
      if (!window.Webamp) await loadScript(WEBAMP_SRC, WEBAMP_SRI);
      if (!window.Webamp.browserIsSupported()) return;
      const w = new window.Webamp({ initialTracks: WEBAMP_TRACKS, zIndex: 60 });
      w.onClose(() => { webampClosed = true; });
      await w.renderWhenReady(anchor);
      webamp = w;
    } catch (err) {
      console.error(err);
    } finally {
      anchor.remove();
      root.classList.remove('is-busy');
      webampStarting = false;
    }
  }

  function updateClock(el) {
    el.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function buildDesktop() {
    if (taskbar) return;

    taskbar = document.createElement('div');
    taskbar.className = 'taskbar';

    taskBtn = document.createElement('button');
    taskBtn.type = 'button';
    taskBtn.className = 'btn taskbar__task';
    const label = document.createElement('span');
    label.textContent = title;
    taskBtn.append(makeIcon('titlebar__icon'), label);
    taskBtn.addEventListener('click', restore);

    const clock = document.createElement('span');
    clock.className = 'taskbar__clock';
    updateClock(clock);
    clockTimer = setInterval(updateClock, 10000, clock);

    taskbar.append(taskBtn, clock);

    icon = makeDesktopIcon('desktop-icon__img', "Max Poletaev's Corner", reopen);
    hlIcon = makeDesktopIcon('desktop-icon__img desktop-icon__img--hl', 'Half-Life', openHalfLife);
    const winampIcon = makeDesktopIcon('desktop-icon__img desktop-icon__img--winamp', 'Winamp', openWinamp);

    desktop = document.createElement('div');
    desktop.className = 'desktop';
    desktop.append(icon, hlIcon, winampIcon);

    document.body.append(desktop, taskbar);
  }

  function showDesktop(withTask) {
    buildDesktop();
    taskBtn.hidden = !withTask;
  }

  function hideDesktop() {
    if (!taskbar) return;
    clearInterval(clockTimer);
    if (dialog) dialog.remove();
    taskbar.remove();
    desktop.remove();
    taskbar = taskBtn = desktop = icon = hlIcon = dialog = null;
  }

  // Minimize, close, restore

  function minimize() {
    root.classList.add('is-minimized');
    showDesktop(true);
    taskBtn.focus();
    save();
  }

  function close() {
    root.classList.remove('is-minimized', 'is-maximized');
    root.classList.add('is-closed');
    maxBtn.setAttribute('aria-label', 'Maximize');
    winDrag.set(0, 0);
    showDesktop(false);
    icon.focus();
    save();
  }

  function restore() {
    root.classList.remove('is-minimized', 'is-closed');
    hideDesktop();
    reclamp();
    save();
  }

  function reopen() {
    restore();
    window.scrollTo(0, 0);
  }

  bindActions(titlebar, { minimize, maximize: toggleMaximize, close });

  // Restore saved state

  if (root.classList.contains('is-maximized')) maxBtn.setAttribute('aria-label', 'Restore');
  const state = currentState();
  if (state) {
    showDesktop(state === 'minimized');
  } else {
    reclamp();
  }
})();
