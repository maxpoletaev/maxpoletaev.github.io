(function () {
  'use strict';

  const BASE = '/static/dendy/';
  const WASM_URL = 'https://maxpoletaev.github.io/dendy/dendy.wasm';
  const SAMPLES = {
    thwaite: { url: BASE + 'thwaite.nes', title: 'Thwaite' },
  };

  const WIDTH = 256;
  const HEIGHT = 240;
  const FRAME_MS = 1000 / 60;

  const BTN = { A: 1, B: 2, SELECT: 4, START: 8, UP: 16, DOWN: 32, LEFT: 64, RIGHT: 128 };
  const KEYS = {
    KeyW: BTN.UP, KeyS: BTN.DOWN, KeyA: BTN.LEFT, KeyD: BTN.RIGHT,
    Enter: BTN.START, ShiftLeft: BTN.SELECT, ShiftRight: BTN.SELECT,
    KeyJ: BTN.B, KeyK: BTN.A,
  };

  let go = null;
  let audioCtx = null;
  let audioNode = null;
  let booting = null;
  let canvas = null;
  let ctx2d = null;
  let running = false;
  let pressed = 0;
  let lastFrame = 0;
  let acc = 0;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => {
        s.remove();
        reject(new Error(`failed to load ${src}`));
      };
      document.head.append(s);
    });
  }

  async function boot() {
    await loadScript(BASE + 'wasm_exec.js');
    window.go = go = new Go();
    const { instance } = await WebAssembly.instantiateStreaming(fetch(WASM_URL), go.importObject);
    go.run(instance);

    audioCtx = new AudioContext({ sampleRate: go.AudioSampleRate });
    await audioCtx.audioWorklet.addModule(BASE + 'audio.js');
    audioNode = new AudioWorkletNode(audioCtx, 'audio-processor');
    audioNode.connect(audioCtx.destination);
  }

  function gamepad() {
    const pad = navigator.getGamepads && navigator.getGamepads()[0];
    if (!pad) return 0;
    const b = (i) => pad.buttons[i]?.pressed;
    const x = pad.axes[0] || 0;
    const y = pad.axes[1] || 0;
    let m = 0;
    if (b(12) || y < -0.5) m |= BTN.UP;
    if (b(13) || y > 0.5) m |= BTN.DOWN;
    if (b(14) || x < -0.5) m |= BTN.LEFT;
    if (b(15) || x > 0.5) m |= BTN.RIGHT;
    if (b(0)) m |= BTN.A;
    if (b(2)) m |= BTN.B;
    if (b(8)) m |= BTN.SELECT;
    if (b(9)) m |= BTN.START;
    return m;
  }

  function memory() {
    return go._inst.exports.mem?.buffer || go._inst.exports.memory.buffer;
  }

  function runFrame() {
    for (;;) {
      if (go.RunFrame(pressed | gamepad())) {
        const px = new Uint8ClampedArray(memory(), go.GetFrameBufferPtr(), WIDTH * HEIGHT * 4);
        ctx2d.putImageData(new ImageData(px, WIDTH, HEIGHT), 0, 0);
        return;
      }
      const buf = new Float32Array(memory(), go.GetAudioBufferPtr(), go.AudioBufferSize);
      audioNode.port.postMessage(buf.slice());
    }
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    acc = Math.min(acc + (now - lastFrame), FRAME_MS * 3);
    lastFrame = now;
    if (!document.hasFocus() || document.visibilityState !== 'visible') {
      acc = 0;
      return;
    }
    for (let n = 0; acc >= FRAME_MS - 2 && n < 2; n++) {
      acc = Math.max(0, acc - FRAME_MS);
      runFrame();
    }
  }

  function onKey(e) {
    const mask = KEYS[e.code];
    if (!mask || e.target.closest('button, input')) return;
    e.preventDefault();
    if (e.type === 'keydown') pressed |= mask;
    else pressed &= ~mask;
  }

  const api = {
    async start(screen) {
      canvas = screen;
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      ctx2d = canvas.getContext('2d');
      ctx2d.imageSmoothingEnabled = false;
      booting = booting || boot();
      try {
        await booting;
      } catch (err) {
        booting = null;
        throw err;
      }
      audioCtx.resume();
      if (running) return;
      running = true;
      pressed = 0;
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKey);
      acc = 0;
      requestAnimationFrame((t) => { lastFrame = t; loop(t); });
    },

    stop() {
      running = false;
      pressed = 0;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKey);
      if (audioCtx) audioCtx.suspend();
    },

    load(bytes) {
      return Boolean(go.LoadROM(new Uint8Array(bytes)));
    },

    async loadSample(name) {
      const sample = SAMPLES[name];
      const res = await fetch(sample.url);
      if (!res.ok) return '';
      return api.load(await res.arrayBuffer()) ? sample.title : '';
    },
  };

  window.Dendy = api;
})();
