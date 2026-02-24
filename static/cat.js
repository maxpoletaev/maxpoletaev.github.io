(function () {
  'use strict';

  const container = document.getElementById('cat');
  if (!container) return;

  const SPRITE_SIZE = 32;
  const SPRITE_URL = '/static/cat.png';
  const SCALE = 2;
  const SCALED_SIZE = SPRITE_SIZE * SCALE;
  const BODY_WIDTH = (SPRITE_SIZE / 2) * SCALE;
  const WALK_SPEED = 65;
  const RUN_SPEED = 120;
  const JUMP_SPEED = 120;
  const RUN_THRESHOLD = BODY_WIDTH * 5;
  const JUMP_THRESHOLD = BODY_WIDTH * 1.7;
  const CURSOR_REACT_DELAY = 500;

  const ANIMS = {
    sitting:   { row: 0, frames: 4, fps: 3 },
    sitting2:  { row: 1, frames: 4, fps: 3 },
    cleaning:  { row: 2, frames: 4, fps: 6 },
    cleaning2: { row: 3, frames: 4, fps: 6 },
    walking:   { row: 4, frames: 8, fps: 10 },
    running:   { row: 5, frames: 8, fps: 14 },
    sleeping:  { row: 6, frames: 4, fps: 2 },
    touching:  { row: 7, frames: 6, fps: 8,  once: true },
    jumping:   { row: 8, frames: 4, fps: 12, once: true },
    scared:    { row: 9, frames: 8, fps: 12, once: true },
  };

  const WANDER_SEQUENCE = [
    'sitting','walking', 'sitting2', 'walking',
    'sitting', 'cleaning', 'cleaning2',
    'cleaning', 'cleaning2', 'sleeping',
  ];

  const IDLE_DURATION = {
    sitting:   [3000, 5000],
    sitting2:  [1000, 2000],
    cleaning:  [2000, 3000],
    cleaning2: [2000, 3000],
    sleeping:  [7000, 15000],
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clampX = (x) => Math.max(0, Math.min(container.offsetWidth - SCALED_SIZE, x));

  // --- Sprite element ---

  const sprite = document.createElement('div');
  sprite.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: ${SPRITE_SIZE}px;
    height: ${SPRITE_SIZE}px;
    image-rendering: pixelated;
    background-image: url(${SPRITE_URL});
    background-repeat: no-repeat;
    pointer-events: none;
    transform-origin: bottom left;
  `;
  container.appendChild(sprite);

  // --- Cursor tracking ---

  let cursorX = null;
  let prevCursorX = null;

  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    document.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right &&
                     e.clientY >= rect.top  && e.clientY <= rect.bottom;
      cursorX = inside ? e.clientX - rect.left : null;
    });
    document.addEventListener('mouseleave', () => { cursorX = null; });
  }

  function catCenterX() {
    return posX + SCALED_SIZE / 2;
  }

  function distToCursor() {
    return cursorX !== null ? Math.abs(cursorX - catCenterX()) : Infinity;
  }

  // --- State ---

  let posX = rand(0, clampX(Infinity));
  let targetX = posX;
  let facing = 1;
  let anim = 'sitting';
  let frame = 0;
  let frameMs = 0;
  let idleMs = 0;
  let moving = false;
  let speed = 0;
  let lastTs = null;
  let wanderIdx = Math.floor(Math.random() * WANDER_SEQUENCE.length);
  let cursorReactMs = 0;

  // --- Behaviour ---

  function startIdle(name) {
    moving  = false;
    anim    = name;
    frame   = 0;
    frameMs = 0;
    if (!ANIMS[name].once) {
      const [min, max] = IDLE_DURATION[name];
      idleMs = rand(min, max);
    }
  }

  function startMoving(gait, tx) {
    tx = clampX(tx);
    const dx = tx - posX;
    if (Math.abs(dx) < BODY_WIDTH / 2) {
      startIdle(distToCursor() < BODY_WIDTH ? 'touching' : 'sitting');
      return;
    }
    anim    = gait;
    speed   = gait === 'running' ? RUN_SPEED : WALK_SPEED;
    facing  = dx > 0 ? 1 : -1;
    targetX = tx;
    frame   = 0;
    frameMs = 0;
    moving  = true;
  }

  function followCursor() {
    const dist = distToCursor();
    if (dist < BODY_WIDTH) {
      startIdle('touching');
      return;
    }
    const side = cursorX > catCenterX() ? 0.75 : 0.25;
    const alreadyRunning = moving && anim === 'running';
    const gait = (alreadyRunning || dist > RUN_THRESHOLD) ? 'running' : 'walking';
    startMoving(gait, cursorX - SCALED_SIZE * side);
  }

  function wander() {
    wanderIdx = (wanderIdx + 1) % WANDER_SEQUENCE.length;
    const action = WANDER_SEQUENCE[wanderIdx];
    if (action === 'walking' || action === 'running') {
      startMoving(action, rand(0, clampX(Infinity)));
    } else {
      if (action === 'jumping') facing = Math.random() < 0.5 ? 1 : -1;
      startIdle(action);
    }
  }

  function next() {
    if (cursorX !== null) {
      followCursor();
    } else {
      wander();
    }
  }

  // --- Animation & movement ---

  function advanceFrame(dt) {
    const def = ANIMS[anim];
    frameMs += dt;
    const frameDur = 1000 / def.fps;
    let cycled = false;
    while (frameMs >= frameDur) {
      frame++;
      if (frame >= def.frames) { frame = 0; cycled = true; }
      frameMs -= frameDur;
    }
    if (cycled && ANIMS[anim].once) next();
  }

  function handleCursorEdges() {
    const justEntered = cursorX !== null && prevCursorX === null;
    const justLeft    = cursorX === null && prevCursorX !== null;

    if (justEntered) cursorReactMs = CURSOR_REACT_DELAY;
    if (justLeft) {
      const hadReacted = cursorReactMs === 0;
      wanderIdx = -1;
      cursorReactMs = 0;
      if (hadReacted && moving) startIdle('sitting');
    }

    prevCursorX = cursorX;
  }

  function updatePosition(dt) {
    if (moving) {
      if (anim === 'running' && cursorX !== null && distToCursor() < JUMP_THRESHOLD) {
        anim = 'jumping';
        frame = 0;
        frameMs = 0;
        moving = false;
        return;
      }
      posX = clampX(posX + facing * speed * dt / 1000);
      const reached = facing === 1 ? posX >= targetX : posX <= targetX;
      if (reached) { posX = targetX; next(); }
    } else {
      if (anim === 'jumping') {
        posX = clampX(posX + facing * JUMP_SPEED * dt / 1000);
      }
      if (!ANIMS[anim].once) {
        idleMs -= dt;
        if (idleMs <= 0) next();
      }
    }
  }

  function render() {
    const def = ANIMS[anim];
    sprite.style.backgroundPosition = `-${frame * SPRITE_SIZE}px -${def.row * SPRITE_SIZE}px`;
    if (facing === 1) {
      sprite.style.transform = `translateX(${posX}px) scale(${SCALE},${SCALE})`;
    } else {
      sprite.style.transform = `translateX(${posX + SCALED_SIZE}px) scale(-${SCALE},${SCALE})`;
    }
  }

  function tick(ts) {
    if (lastTs === null) lastTs = ts;
    const dt = Math.min(ts - lastTs, 100);
    lastTs = ts;

    advanceFrame(dt);
    handleCursorEdges();
    if (cursorReactMs > 0) {
      cursorReactMs -= dt;
      if (cursorReactMs <= 0 && cursorX !== null && !ANIMS[anim].once) {
        cursorReactMs = 0;
        next();
      }
    }
    updatePosition(dt);
    render();

    requestAnimationFrame(tick);
  }

  startIdle('sitting');
  requestAnimationFrame(tick);
})();
