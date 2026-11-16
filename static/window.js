(function () {
  'use strict';

  const root = document.documentElement;
  const win = document.querySelector('.window');
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
      x: offsetX,
      y: offsetY,
      max: root.classList.contains('is-maximized'),
      state: currentState(),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {}
  }

  // Dragging

  let offsetX = Number(saved.x) || 0;
  let offsetY = Number(saved.y) || 0;
  let drag = null;

  function applyOffset() {
    if (offsetX || offsetY) {
      root.style.setProperty('--win-offset', `${offsetX}px ${offsetY}px`);
    } else {
      root.style.removeProperty('--win-offset');
    }
  }

  // Keep a restored position reachable if the viewport shrank since it was saved.
  function reclamp() {
    if (currentState()) return;
    [offsetX, offsetY] = clampOffset(offsetX, offsetY);
    applyOffset();
  }

  function clampOffset(x, y) {
    const keep = 80; // how much of the titlebar stays visible
    const minX = -(win.offsetLeft + win.offsetWidth - keep);
    const maxX = window.innerWidth - win.offsetLeft - keep;
    const minY = -win.offsetTop;
    return [Math.min(maxX, Math.max(minX, x)), Math.max(minY, y)];
  }

  titlebar.classList.add('is-draggable');

  titlebar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    if (e.target.closest('button') || root.classList.contains('is-maximized')) return;
    drag = { x: e.clientX - offsetX, y: e.clientY - offsetY };
    try { titlebar.setPointerCapture(e.pointerId); } catch (err) {}
    root.classList.add('is-dragging');
  });

  titlebar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    [offsetX, offsetY] = clampOffset(e.clientX - drag.x, e.clientY - drag.y);
    applyOffset();
  });

  function endDrag() {
    if (!drag) return;
    drag = null;
    root.classList.remove('is-dragging');
    save();
  }

  titlebar.addEventListener('pointerup', endDrag);
  titlebar.addEventListener('pointercancel', endDrag);

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
  let clockTimer = null;

  function makeIcon(cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.setAttribute('aria-hidden', 'true');
    return span;
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

    icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'desktop-icon';
    const iconLabel = document.createElement('span');
    iconLabel.className = 'desktop-icon__label';
    iconLabel.textContent = "Max Poletaev's Corner";
    icon.append(makeIcon('desktop-icon__img'), iconLabel);
    icon.addEventListener('dblclick', reopen);
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') reopen();
    });
    icon.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') reopen();
    });

    document.body.append(icon, taskbar);
  }

  function showDesktop(withTask) {
    buildDesktop();
    taskBtn.hidden = !withTask;
  }

  function hideDesktop() {
    if (!taskbar) return;
    clearInterval(clockTimer);
    taskbar.remove();
    icon.remove();
    taskbar = taskBtn = icon = null;
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
    offsetX = offsetY = 0;
    applyOffset();
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

  titlebar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'minimize') minimize();
    if (action === 'maximize') toggleMaximize();
    if (action === 'close') close();
  });

  // Restore saved state

  if (root.classList.contains('is-maximized')) maxBtn.setAttribute('aria-label', 'Restore');
  const state = currentState();
  if (state) {
    showDesktop(state === 'minimized');
  } else {
    reclamp();
  }
})();
