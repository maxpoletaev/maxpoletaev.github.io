(function () {
  'use strict';

  const root = document.documentElement;
  const win = document.querySelector('.page.window');
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
        setTimeout(() => {
          if (dialog !== el) return;
          el.hidden = false;
          retry.focus();
        }, 600);
      },
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDialog();
    });

    document.body.append(el);
    retry.focus();
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
    hlIcon = makeDesktopIcon('desktop-icon__img desktop-icon__img--hl', 'Half-Life', showDiskError);
    hlIcon.classList.add('desktop-icon--second');

    document.body.append(icon, hlIcon, taskbar);
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
    icon.remove();
    hlIcon.remove();
    taskbar = taskBtn = icon = hlIcon = dialog = null;
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
