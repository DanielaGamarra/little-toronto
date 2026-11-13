// Little Toronto: the game. Scene, camera, puzzle tray, tutorial, hints and the birthday finale.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Builder } from './builder.js';
import { PIECES, CHAPTERS, LAST_ID, TRAM_IDS } from './pieces.js';
import { makeMaterials, glowTexture } from './materials.js';
import { Sound } from './sound.js';

const $ = s => document.querySelector(s);
const V3 = THREE.Vector3;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const PI = Math.PI, THETA0 = PI / 4, PHI0 = 0.98, SLOTS = 4;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const store = {
  get(k, d) { try { const v = localStorage.getItem('lt.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lt.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { Object.keys(localStorage).filter(k => k.startsWith('lt.') && k !== 'lt.desk' && k !== 'lt.muted').forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ } },
};

export async function startApp() {
  const byId = Object.fromEntries(PIECES.map(p => [p.id, p]));
  const TOTAL = PIECES.length;
  const sound = new Sound();
  const DEV = new URLSearchParams(location.search).has('dev');
  try {
    await Promise.race([
      Promise.all([document.fonts.load('900 64px Fraunces'), document.fonts.load('800 64px Nunito')]),
      new Promise(r => setTimeout(r, 1800)),
    ]);
  } catch { /* fonts optional */ }

  // ---------- renderer / scene ----------
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.75; controls.screenSpacePanning = true;
  controls.minZoom = 0.8; controls.maxZoom = 4.5;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.38;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const DAY = { sky: new THREE.Color('#fff3e2'), gnd: new THREE.Color('#b39675'), hemi: 1.75, sunC: new THREE.Color('#fff0d8'), sun: 2.5, shadow: 0.17 };
  const NIGHT = { sky: new THREE.Color('#5d6fb8'), gnd: new THREE.Color('#2c2546'), hemi: 0.8, sunC: new THREE.Color('#9fb2ff'), sun: 0.6, shadow: 0.1 };
  const hemi = new THREE.HemisphereLight(DAY.sky, DAY.gnd, DAY.hemi);
  const sun = new THREE.DirectionalLight(DAY.sunC, DAY.sun);
  sun.position.set(9, 22, 12); sun.target.position.set(0, 4, 0);
  sun.castShadow = true;
  const small = Math.min(screen.width, screen.height) < 500;
  sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const shadowMat = new THREE.ShadowMaterial({ opacity: DAY.shadow, color: 0x5a3b22 });
  const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-PI / 2), shadowMat);
  table.position.y = -0.76; table.receiveShadow = true; scene.add(table);

  // ---------- pieces ----------
  const mats = makeMaterials(renderer);
  const gTex = glowTexture();
  const spriteMats = {};
  const glowSprites = [];
  for (const p of PIECES) {
    const b = new Builder(); p.make(b);
    const geos = b.build();
    const box = new THREE.Box3();
    for (const g of Object.values(geos)) { g.computeBoundingBox(); box.union(g.boundingBox); }
    const c = box.getCenter(new V3());
    const grp = new THREE.Group(); grp.name = p.id;
    for (const [ch, g] of Object.entries(geos)) {
      g.translate(-c.x, -c.y, -c.z); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mats[ch]);
      m.castShadow = ch !== 'water'; m.receiveShadow = true;
      grp.add(m);
    }
    for (const gl of b.glows) {
      const sm = spriteMats[gl.color] ||= new THREE.SpriteMaterial({ map: gTex, color: gl.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(sm); s.position.set(gl.x - c.x, gl.y - c.y, gl.z - c.z); s.scale.setScalar(gl.size);
      grp.add(s); glowSprites.push(s);
    }
    grp.position.copy(c); grp.visible = false;
    p.home = c.clone(); p.group = grp; p.box = box;
    scene.add(grp);
  }

  // ---------- thumbnails (one throwaway renderer) ----------
  {
    const T = 192;
    const tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    tr.setPixelRatio(1); tr.setSize(T, T, false);
    const ts = new THREE.Scene();
    ts.add(new THREE.HemisphereLight(0xfff6ea, 0x9a8a7a, 2.0));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(4, 8, 6); ts.add(d);
    const tc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    tc.position.setFromSphericalCoords(60, 1.0, THETA0); tc.lookAt(0, 0, 0); tc.updateMatrixWorld();
    const inv = tc.matrixWorldInverse, v = new V3();
    for (const p of PIECES) {
      const g = p.group; ts.add(g); g.position.set(0, 0, 0); g.visible = true;
      let hw = 0.01;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? p.box.max.x : p.box.min.x, i & 2 ? p.box.max.y : p.box.min.y, i & 4 ? p.box.max.z : p.box.min.z).sub(p.home).applyMatrix4(inv);
        hw = Math.max(hw, Math.abs(v.x), Math.abs(v.y));
      }
      hw *= 1.08;
      Object.assign(tc, { left: -hw, right: hw, top: hw, bottom: -hw }); tc.updateProjectionMatrix();
      tr.render(ts, tc);
      p.thumb = tr.domElement.toDataURL('image/png');
      scene.add(g); g.position.copy(p.home); g.visible = false;
    }
    tr.dispose(); tr.forceContextLoss();
  }

  // ---------- framing ----------
  const FULL = { target: new V3(), hw: 1, up: 1, dn: 1 };
  {
    const pts = [];
    for (const p of PIECES) for (let i = 0; i < 8; i++) pts.push(new V3(i & 1 ? p.box.max.x : p.box.min.x, i & 2 ? p.box.max.y : p.box.min.y, i & 4 ? p.box.max.z : p.box.min.z));
    const cam = new THREE.OrthographicCamera(), v = new V3();
    const ext = (t, th) => {
      cam.position.setFromSphericalCoords(50, PHI0, th).add(t); cam.lookAt(t); cam.updateMatrixWorld();
      let hw = 0, up = -1e9, dn = 1e9;
      for (const p of pts) { v.copy(p).applyMatrix4(cam.matrixWorldInverse); hw = Math.max(hw, Math.abs(v.x)); up = Math.max(up, v.y); dn = Math.min(dn, v.y); }
      return { hw, up, dn: -dn };
    };
    const e0 = ext(FULL.target, THETA0);
    FULL.target.y += (e0.up - e0.dn) / 2 / Math.sin(PHI0);
    FULL.hw = 0; FULL.up = 0; FULL.dn = 0;
    for (let th = 0; th < 2 * PI; th += PI / 8) {
      const e = ext(FULL.target, th);
      FULL.hw = Math.max(FULL.hw, e.hw); FULL.up = Math.max(FULL.up, e.up); FULL.dn = Math.max(FULL.dn, e.dn);
    }
  }
  let trayVisible = true;
  function setFrustum() {
    const W = innerWidth, H = innerHeight;
    const top = $('#hud').hidden ? 0 : $('#hud').getBoundingClientRect().bottom;
    let bot = trayVisible && !$('#tray').hidden ? $('#tray').getBoundingClientRect().top : H;
    if (!$('#finale').hidden) bot = Math.min(bot, $('#finale .card-box').getBoundingClientRect().top - 8);
    const free = Math.max(120, bot - top), cy = top + free / 2;
    const s = Math.max(FULL.hw * 2 / (W * 0.94), FULL.up / (free / 2 * 0.94), FULL.dn / (free / 2 * 0.94));
    Object.assign(camera, { left: -W / 2 * s, right: W / 2 * s, top: cy * s, bottom: -(H - cy) * s });
    camera.updateProjectionMatrix();
  }
  function onResize() {
    renderer.setSize(innerWidth, innerHeight, false);
    setFrustum(); dirty = true;
  }

  // ---------- state ----------
  const placed = new Set(store.get('placed', []).filter(id => byId[id]));
  let slots = new Array(SLOTS).fill(null);
  let dirty = true, lastAction = performance.now(), hintShownAt = 0;
  let done = placed.size === TOTAL;
  const anims = [];
  let camTween = null, userTouched = false;

  const chapterIndex = () => { const p = PIECES.find(q => !placed.has(q.id)); return p ? p.ch : CHAPTERS.length - 1; };
  let curChapter = chapterIndex();

  function setCam(th, ph, target, zoom) {
    controls.target.copy(target);
    camera.position.setFromSphericalCoords(60, ph, th).add(target);
    camera.zoom = zoom; camera.lookAt(target); camera.updateProjectionMatrix();
    controls.update(); dirty = true;
  }
  function chapterView(i) {
    const c = CHAPTERS[i];
    return c && c.focus ? { target: new V3(...c.focus), zoom: c.zoom } : { target: FULL.target.clone(), zoom: 1 };
  }
  function tweenCam(to, dur = 1.0) {
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    let dth = (to.theta ?? sph.theta) - sph.theta;
    dth = ((dth + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
    camTween = {
      t0: performance.now(), dur: dur * 1000, r: sph.radius,
      from: { target: controls.target.clone(), zoom: camera.zoom, theta: sph.theta, phi: sph.phi },
      to: { target: to.target ? to.target.clone() : controls.target.clone(), zoom: to.zoom ?? camera.zoom, theta: sph.theta + dth, phi: to.phi ?? sph.phi },
      done: to.done,
    };
  }
  function stepCam(now) {
    const k = Math.min(1, (now - camTween.t0) / camTween.dur), e = ease.inOut(k), { from, to } = camTween;
    controls.target.lerpVectors(from.target, to.target, e);
    camera.position.setFromSphericalCoords(camTween.r, lerp(from.phi, to.phi, e), lerp(from.theta, to.theta, e)).add(controls.target);
    camera.zoom = lerp(from.zoom, to.zoom, e); camera.lookAt(controls.target); camera.updateProjectionMatrix();
    if (k >= 1) { const cb = camTween.done; camTween = null; cb && cb(); }
  }
  controls.addEventListener('start', () => { camTween = null; userTouched = true; lastAction = performance.now(); tut.onDrag(); });
  controls.addEventListener('change', () => { dirty = true; });

  // ---------- HUD + tray ----------
  const ui = {
    hud: $('#hud'), tray: $('#tray'), slots: $('#slots'), count: $('#count'), chapNum: $('#chapNum'), chapName: $('#chapName'),
    bar: $('#barFill'), toast: $('#toast'), banner: $('#banner'), coach: $('#coach'), coachText: $('#coachText'),
    coachBtn: $('#coachBtn'), hand: $('#hand'), intro: $('#intro'), finale: $('#finale'), menu: $('#menu'),
  };
  const slotEls = [];
  for (let i = 0; i < SLOTS; i++) {
    const el = document.createElement('button');
    el.className = 'card'; el.type = 'button';
    el.innerHTML = '<span class="cut"><img alt="" draggable="false"></span><span class="lbl"></span>';
    el.addEventListener('click', () => onCard(i));
    ui.slots.appendChild(el); slotEls.push(el);
  }
  function refill(shuffle) {
    const win = PIECES.filter(p => !placed.has(p.id)).slice(0, SLOTS).map(p => p.id);
    slots = slots.map(id => (id && win.includes(id) ? id : null));
    const add = win.filter(id => !slots.includes(id));
    if (shuffle) add.sort((a, b) => ((a.charCodeAt(1) * 7 + a.length) % 5) - ((b.charCodeAt(1) * 7 + b.length) % 5));
    for (const id of add) {
      const i = slots.indexOf(null); if (i < 0) break;
      slots[i] = id; slotEls[i].classList.remove('enter'); void slotEls[i].offsetWidth; slotEls[i].classList.add('enter');
    }
    renderTray();
  }
  function renderTray() {
    slots.forEach((id, i) => {
      const el = slotEls[i], p = id && byId[id];
      el.classList.toggle('empty', !p);
      el.querySelector('img').src = p ? p.thumb : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
      el.querySelector('.lbl').textContent = p ? p.name : '';
      el.dataset.id = id || '';
    });
  }
  function updateHUD() {
    const ci = chapterIndex();
    ui.chapNum.textContent = `Chapter ${ci + 1} of ${CHAPTERS.length}`;
    ui.chapName.textContent = CHAPTERS[ci].name;
    ui.bar.style.width = `${(placed.size / TOTAL) * 100}%`;
    ui.count.textContent = `${placed.size} / ${TOTAL}`;
  }
  let toastTimer = 0;
  function toast(msg, ms = 2400) {
    ui.toast.textContent = msg; ui.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
  }
  let bannerTimer = 0;
  function banner(i) {
    const c = CHAPTERS[i];
    ui.banner.innerHTML = `<small>Chapter ${i + 1}</small><b>${c.name}</b><p>${c.fact}</p>`;
    ui.banner.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => ui.banner.classList.remove('show'), 3200);
  }
  ui.banner.addEventListener('click', () => ui.banner.classList.remove('show'));

  const validIds = () => slots.filter(id => id && byId[id].needs.every(n => placed.has(n)));

  // ---------- placing ----------
  function onCard(i) {
    const id = slots[i]; if (!id) return;
    const p = byId[id], el = slotEls[i];
    lastAction = performance.now(); clearHint();
    sound.tap();
    const missing = p.needs.filter(n => !placed.has(n));
    if (missing.length) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      sound.nope();
      if (id === LAST_ID) toast('Save this one for the very end!');
      else {
        const m = byId[missing[0]];
        toast(missing.length > 1 && p.needs.length > 2 ? 'Not yet. Finish the pieces around it first.' : `This one snaps onto the ${m.name.toLowerCase()}. Place that first.`);
      }
      tut.onWrong();
      return;
    }
    placed.add(id); store.set('placed', [...placed]);
    const r = el.querySelector('img').getBoundingClientRect();
    flyIn(p, r.left + r.width / 2, r.top + r.height / 2);
    slots[i] = null; refill(false); updateHUD();
    tut.onPlaced(p);
  }

  function flyIn(p, sx, sy) {
    const g = p.group, ndc = p.home.clone().project(camera);
    const start = new V3((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1, ndc.z).unproject(camera);
    const camUp = new V3(0, 1, 0).applyQuaternion(camera.quaternion);
    g.visible = true; g.position.copy(start); g.scale.setScalar(0.3);
    const back = p.view != null;
    const prev = back ? { theta: new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target)).theta, target: controls.target.clone(), zoom: camera.zoom } : null;
    if (back) { userTouched = false; tweenCam({ theta: p.view, target: p.home.clone(), zoom: Math.max(camera.zoom, 1.8) }, 0.85); }
    const dur = back ? 1000 : 650, arc = 2.2 / camera.zoom;
    anims.push({
      t0: performance.now() + (back ? 250 : 0), dur,
      step(k) {
        const e = ease.outCubic(k);
        g.position.lerpVectors(start, p.home, e).addScaledVector(camUp, Math.sin(PI * k) * arc);
        g.scale.setScalar(0.3 + 0.7 * ease.outBack(k));
        g.rotation.set((1 - e) * 0.35, (1 - e) * 0.9, 0);
      },
      end() {
        g.position.copy(p.home); g.rotation.set(0, 0, 0); g.scale.setScalar(1);
        land(p);
        if (back) setTimeout(() => { if (!userTouched && !camTween && !done) tweenCam(prev, 1.0); }, 1500);
      },
    });
  }
  function land(p) {
    const g = p.group;
    sound.place();
    try { navigator.vibrate && navigator.vibrate(12); } catch { /* ignore */ }
    anims.push({
      t0: performance.now(), dur: 220,
      step(k) { const s = Math.sin(PI * k); g.scale.set(1 + 0.05 * s, 1 - 0.09 * s, 1 + 0.05 * s); },
      end() { g.scale.setScalar(1); },
    });
    puff(p);
    renderer.shadowMap.needsUpdate = true;
    const ci = chapterIndex();
    if (placed.size === TOTAL) { if (!done) { done = true; setTimeout(finale, 500); } return; }
    if (ci !== curChapter) {
      curChapter = ci;
      sound.chime();
      setTimeout(() => { banner(ci); if (!tut.active()) tweenCam({ ...chapterView(ci), theta: THETA0, phi: PHI0 }, 1.2); }, 350);
    }
  }
  // little sawdust ring where a piece lands
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0, depthWrite: false });
  const ringGeo = new THREE.RingGeometry(0.75, 1, 28).rotateX(-PI / 2);
  function puff(p) {
    const m = new THREE.Mesh(ringGeo, ringMat.clone());
    const size = p.box.getSize(new V3());
    const r0 = Math.max(0.4, Math.min(3.5, Math.max(size.x, size.z) * 0.6));
    m.position.set(p.home.x, p.box.min.y + 0.03, p.home.z); scene.add(m);
    anims.push({
      t0: performance.now(), dur: 520,
      step(k) { m.scale.setScalar(r0 * (0.6 + 0.8 * ease.outCubic(k))); m.material.opacity = 0.7 * (1 - k); },
      end() { scene.remove(m); m.material.dispose(); },
    });
  }

  // ---------- hints ----------
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  let ghost = null, ghostT0 = 0;
  function clearHint() {
    slotEls.forEach(e => e.classList.remove('hint'));
    if (ghost) { scene.remove(ghost); ghost = null; }
  }
  function showHint(withGhost) {
    clearHint();
    const v = validIds(); if (!v.length) return;
    const id = v[0], p = byId[id];
    slotEls[slots.indexOf(id)].classList.add('hint');
    hintShownAt = performance.now();
    if (!withGhost) return;
    ghost = new THREE.Group();
    p.group.children.forEach(m => { if (m.isMesh) ghost.add(new THREE.Mesh(m.geometry, ghostMat)); });
    ghost.position.copy(p.home); scene.add(ghost); ghostT0 = performance.now();
    if (p.view != null) tweenCam({ theta: p.view, target: p.home.clone(), zoom: Math.max(camera.zoom, 1.6) }, 0.9);
    else {
      const ndc = p.home.clone().project(camera);
      if (Math.abs(ndc.x) > 0.85 || Math.abs(ndc.y) > 0.85) tweenCam(chapterView(chapterIndex()), 0.9);
    }
    setTimeout(() => { if (ghost && performance.now() - ghostT0 > 3800) { scene.remove(ghost); ghost = null; dirty = true; } }, 4000);
  }

  // ---------- tutorial ----------
  const tut = (() => {
    let step = store.get('tut', 0); // 0 intro, 1 first piece, 2 second piece, 3 rotate, 4 done
    let handTarget = null, wrongs = 0;
    function save() { store.set('tut', step); }
    function coach(text, btn) {
      ui.coachText.innerHTML = text; ui.coach.hidden = false;
      ui.coachBtn.hidden = !btn; if (btn) ui.coachBtn.textContent = btn;
    }
    function pointAtCard(id) { handTarget = id; ui.hand.hidden = false; ui.hand.className = 'tap'; positionHand(); }
    function positionHand() {
      if (ui.hand.hidden) return;
      if (handTarget === 'drag') { ui.hand.style.left = `${innerWidth / 2 - 24}px`; ui.hand.style.top = `${innerHeight * 0.38}px`; return; }
      const i = slots.indexOf(handTarget); if (i < 0) { ui.hand.hidden = true; return; }
      const r = slotEls[i].getBoundingClientRect();
      ui.hand.style.left = `${r.left + r.width / 2 - 18}px`; ui.hand.style.top = `${r.top + r.height * 0.35}px`;
    }
    function hide() { ui.coach.hidden = true; ui.hand.hidden = true; handTarget = null; }
    function show() {
      if (step === 1) { coach('Every piece snaps onto something already built.<br><b>Start with the bottom board.</b> Tap it!'); pointAtCard('base1'); }
      else if (step === 2) { coach('Nice! Look at the model, then <b>pick the piece that sits on top of it.</b>'); pointAtCard('base2'); }
      else if (step === 3) {
        coach(TOUCH ? '<b>Drag</b> to turn the city around and <b>pinch</b> to zoom. Some pieces hide on the back!' : '<b>Drag</b> to turn the city around and <b>scroll</b> to zoom. Some pieces hide on the back!', 'Got it');
        handTarget = 'drag'; ui.hand.hidden = false; ui.hand.className = 'swipe'; positionHand();
      } else hide();
    }
    ui.coachBtn.addEventListener('click', () => { if (step === 3) { step = 4; save(); hide(); finishTut(); } });
    function finishTut() { tweenCam({ ...chapterView(chapterIndex()), theta: THETA0, phi: PHI0 }, 1.1); }
    return {
      active: () => step > 0 && step < 4,
      begin() { if (step < 4) { step = Math.max(1, Math.min(step, placed.size ? 3 : 1)); if (placed.has('base1') && step < 2) step = 2; if (placed.has('base2')) step = 3; save(); show(); } },
      replay() { step = 1; save(); show(); },
      onPlaced(p) {
        if (step === 1 && p.id === 'base1') { step = 2; save(); setTimeout(show, 450); hide(); }
        else if (step === 2 && p.id === 'base2') { step = 3; save(); hide(); setTimeout(show, 700); }
        else positionHand();
      },
      onWrong() { if (step === 1 || step === 2) { wrongs++; if (wrongs === 1) ui.coachText.innerHTML += '<br><small>Pieces only fit onto parts already in the model.</small>'; } },
      onDrag() { if (step === 3) setTimeout(() => { if (step === 3) { step = 4; save(); hide(); finishTut(); } }, 1200); },
      positionHand,
    };
  })();

  // ---------- night / finale ----------
  let nightK = 0, nightTarget = 0, tramT = 0;
  const tramGroups = TRAM_IDS.map(id => byId[id]);
  function applyNight(k) {
    hemi.color.lerpColors(DAY.sky, NIGHT.sky, k); hemi.groundColor.lerpColors(DAY.gnd, NIGHT.gnd, k);
    hemi.intensity = lerp(DAY.hemi, NIGHT.hemi, k);
    sun.color.lerpColors(DAY.sunC, NIGHT.sunC, k); sun.intensity = lerp(DAY.sun, NIGHT.sun, k);
    shadowMat.opacity = lerp(DAY.shadow, NIGHT.shadow, k);
    mats.glow.emissiveIntensity = 1.25 * k;
    mats.light.emissiveIntensity = 1.6 * k;
    mats.beacon.emissiveIntensity = 0.25 + 1.4 * k;
    mats.tramsign.emissiveIntensity = 0.3 + 0.9 * k;
    mats.marquee.emissiveIntensity = 0.12 + 0.75 * k;
    for (const sm of Object.values(spriteMats)) sm.opacity = 0.85 * k;
    document.body.classList.toggle('night', k > 0.5);
  }
  function animateNight(now, dt) {
    const t = now / 1000;
    const hue = (t * 0.07) % 1;
    mats.cnled.emissive.setHSL(hue, 0.85, 0.55); mats.cnled.emissiveIntensity = 1.2 * nightK;
    mats.letters.emissive.setHSL((hue + 0.5) % 1, 0.8, 0.55); mats.letters.emissiveIntensity = 0.75 * nightK;
    const on = Math.floor(t * 3) % 2;
    mats.bulbA.emissiveIntensity = (on ? 1.7 : 0.25) * nightK;
    mats.bulbB.emissiveIntensity = (on ? 0.25 : 1.7) * nightK;
    mats.beacon.emissiveIntensity = (0.25 + 1.4 * nightK) * (Math.sin(t * 3) > 0 ? 1 : 0.35);
    if (done) {
      tramT += dt;
      const dx = 2.6 * Math.sin(tramT * 0.32);
      for (const p of tramGroups) p.group.position.x = p.home.x + dx;
    }
  }

  // maple leaf confetti
  const confetti = (() => {
    const N = 110, shp = new THREE.Shape();
    const pts = [[0, 1], [0.2, 0.6], [0.42, 0.72], [0.34, 0.28], [0.72, 0.5], [0.66, 0.3], [0.95, 0.2], [0.55, -0.12], [0.62, -0.34], [0.1, -0.26], [0.05, -0.62], [-0.05, -0.62], [-0.1, -0.26], [-0.62, -0.34], [-0.55, -0.12], [-0.95, 0.2], [-0.66, 0.3], [-0.72, 0.5], [-0.34, 0.28], [-0.42, 0.72], [-0.2, 0.6]];
    pts.forEach(([x, y], i) => (i ? shp.lineTo(x * 0.22, y * 0.22) : shp.moveTo(x * 0.22, y * 0.22)));
    const mesh = new THREE.InstancedMesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N);
    mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    const cols = ['#e8432e', '#f07b2d', '#f6b23c', '#ff7aa8', '#ffffff'].map(c => new THREE.Color(c));
    const st = []; const o = new THREE.Object3D();
    for (let i = 0; i < N; i++) { mesh.setColorAt(i, cols[i % cols.length]); st.push({}); }
    let t0 = 0, active = false;
    function reset(s, initial) {
      s.x = (Math.random() - 0.5) * 18; s.z = (Math.random() - 0.5) * 14;
      s.y = initial ? 8 + Math.random() * 16 : 20 + Math.random() * 4;
      s.v = 1.4 + Math.random() * 1.6; s.r = Math.random() * 6; s.w = (Math.random() - 0.5) * 5; s.ph = Math.random() * 6;
    }
    return {
      start() { st.forEach(s => reset(s, true)); t0 = performance.now(); active = true; mesh.visible = true; },
      get active() { return active; },
      step(now, dt) {
        const age = (now - t0) / 1000;
        for (let i = 0; i < N; i++) {
          const s = st[i];
          s.y -= s.v * dt; s.r += s.w * dt;
          if (s.y < -1) { if (age < 9) reset(s, false); else s.y = -50; }
          o.position.set(s.x + Math.sin(now / 700 + s.ph) * 0.6, s.y, s.z);
          o.rotation.set(s.r, s.r * 0.7, s.ph); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (age > 22) { active = false; mesh.visible = false; }
      },
    };
  })();

  function finale(fromLoad) {
    trayVisible = false; ui.tray.classList.add('gone');
    clearHint(); ui.coach.hidden = true; ui.hand.hidden = true;
    setTimeout(setFrustum, fromLoad ? 0 : 450);
    tweenCam({ target: FULL.target.clone(), zoom: 1.0, theta: 0.14 * PI, phi: 1.05 }, fromLoad ? 0.01 : 2.2);
    nightTarget = 1;
    store.set('done', true);
    if (fromLoad) { showFinaleCard(); return; }
    setTimeout(() => { confetti.start(); sound.birthday(); }, 900);
    setTimeout(showFinaleCard, 2600);
  }
  function showFinaleCard() {
    ui.finale.hidden = false;
    requestAnimationFrame(() => { setFrustum(); dirty = true; });
  }

  // ---------- photo ----------
  async function photo() {
    renderer.render(scene, camera);
    const c2 = document.createElement('canvas'); c2.width = canvas.width; c2.height = canvas.height;
    const g = c2.getContext('2d');
    const night = nightK > 0.5;
    const bg = g.createRadialGradient(c2.width / 2, c2.height * 0.35, 10, c2.width / 2, c2.height * 0.4, c2.height * 0.8);
    bg.addColorStop(0, night ? '#2a3566' : '#fdf8f0'); bg.addColorStop(1, night ? '#0b1024' : '#e3c7a3');
    g.fillStyle = bg; g.fillRect(0, 0, c2.width, c2.height);
    g.drawImage(canvas, 0, 0);
    const s = c2.width / 400;
    g.fillStyle = night ? '#ffe7b0' : '#5a3a22'; g.textAlign = 'center';
    g.font = `900 ${22 * s}px Fraunces, Georgia, serif`; g.fillText('Little Toronto', c2.width / 2, c2.height - 54 * s);
    g.font = `700 ${12 * s}px Nunito, Arial, sans-serif`; g.fillText('built by Joseline, piece by piece', c2.width / 2, c2.height - 34 * s);
    const blob = await new Promise(r => c2.toBlob(r, 'image/png'));
    const file = new File([blob], 'little-toronto.png', { type: 'image/png' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Little Toronto' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'little-toronto.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // ---------- buttons ----------
  const soundBtn = $('#btnSound');
  const syncSoundBtn = () => soundBtn.classList.toggle('off', sound.muted);
  syncSoundBtn();
  soundBtn.addEventListener('click', () => { sound.setMuted(!sound.muted); syncSoundBtn(); if (!sound.muted) sound.tap(); });
  $('#btnHint').addEventListener('click', () => { lastAction = performance.now(); showHint(true); });
  $('#btnMenu').addEventListener('click', () => { ui.menu.hidden = false; });
  $('#menuClose').addEventListener('click', () => { ui.menu.hidden = true; });
  $('#menu').addEventListener('click', e => { if (e.target.id === 'menu') ui.menu.hidden = true; });
  $('#menuRecenter').addEventListener('click', () => { ui.menu.hidden = true; tweenCam({ ...chapterView(done ? 7 : chapterIndex()), theta: THETA0, phi: PHI0 }, 0.9); });
  $('#menuTutorial').addEventListener('click', () => { ui.menu.hidden = true; if (!done) tut.replay(); });
  $('#menuPhoto').addEventListener('click', () => { ui.menu.hidden = true; photo(); });
  function ask(text) {
    return new Promise(res => {
      const box = $('#ask'); $('#askText').textContent = text; box.hidden = false;
      const close = v => { box.hidden = true; $('#askYes').onclick = $('#askNo').onclick = box.onclick = null; res(v); };
      $('#askYes').onclick = () => close(true);
      $('#askNo').onclick = () => close(false);
      box.onclick = e => { if (e.target === box) close(false); };
    });
  }
  function rebuild() {
    const tutDone = store.get('tut', 0);
    store.clear(); if (tutDone >= 4) store.set('tut', 4);
    location.reload();
  }
  $('#menuReset').addEventListener('click', async () => { ui.menu.hidden = true; if (await ask('Take the whole city apart and build it again?')) rebuild(); });
  $('#finPhoto').addEventListener('click', photo);
  $('#finLights').addEventListener('click', () => { nightTarget = nightTarget > 0.5 ? 0 : 1; });
  $('#finClose').addEventListener('click', () => { ui.finale.hidden = true; setFrustum(); $('#btnParty').hidden = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.5; });
  $('#btnParty').addEventListener('click', () => { $('#btnParty').hidden = true; showFinaleCard(); });
  $('#finAgain').addEventListener('click', async () => { if (await ask('Take the whole city apart and build it again?')) rebuild(); });
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });
  document.addEventListener('gesturestart', e => e.preventDefault());

  // ---------- boot ----------
  for (const id of placed) byId[id].group.visible = true;
  renderer.shadowMap.needsUpdate = true;
  $('#loading').hidden = true;
  ui.hud.hidden = false; ui.tray.hidden = false;
  setFrustum();
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 250));
  refill(true); updateHUD();

  if (done) {
    setCam(0.14 * PI, 1.05, FULL.target, 1);
    nightK = 1; applyNight(1); finale(true);
  } else {
    const v = chapterView(placed.size ? curChapter : 0);
    setCam(THETA0, PHI0, v.target, v.zoom);
    ui.intro.hidden = false;
    $('#introGo').textContent = placed.size ? 'Keep building' : 'Open the box';
    $('#introMeta').textContent = placed.size ? `${placed.size} of ${TOTAL} pieces placed` : `${TOTAL} wooden pieces · about 10 minutes`;
    $('#introGo').addEventListener('click', () => {
      ui.intro.hidden = true; sound.tap(); lastAction = performance.now();
      if (!placed.size) banner(0);
      setTimeout(() => tut.begin(), placed.size ? 0 : 900);
    }, { once: true });
  }

  if (DEV) window.__lt = {
    PIECES, placed, camera, controls,
    placeAll(n = TOTAL) { for (const p of PIECES.slice(0, n)) { placed.add(p.id); p.group.visible = true; } store.set('placed', [...placed]); refill(false); updateHUD(); renderer.shadowMap.needsUpdate = true; dirty = true; },
    finale() { done = true; finale(false); },
    view(th, ph, zoom, target) { setCam(th, ph ?? PHI0, target ? new V3(...target) : FULL.target, zoom ?? 1); },
    night(k) { nightK = nightTarget = k; applyNight(k); animateNight(performance.now(), 0); dirty = true; },
    chapter(i) { const v = chapterView(i); setCam(THETA0, PHI0, v.target, v.zoom); },
  };

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let active = false;
    if (camTween) { stepCam(now); active = true; }
    if (controls.update()) active = true;
    if (anims.length) {
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i], k = (now - a.t0) / a.dur;
        if (k < 0) continue;
        if (k >= 1) { a.end(); anims.splice(i, 1); } else a.step(k);
      }
      renderer.shadowMap.needsUpdate = true; active = true;
    }
    if (nightK !== nightTarget) {
      nightK = nightTarget > nightK ? Math.min(nightTarget, nightK + dt / 2.5) : Math.max(nightTarget, nightK - dt / 1.5);
      applyNight(nightK); active = true;
    }
    if (nightK > 0 || done) { animateNight(now, dt); active = true; }
    if (confetti.active) { confetti.step(now, dt); active = true; }
    if (ghost) { ghostMat.opacity = 0.3 + 0.25 * Math.sin((now - ghostT0) / 180); active = true; }
    if (!done && !tut.active() && ui.intro.hidden && now - lastAction > 14000 && now - hintShownAt > 14000) showHint(false);
    if (active || dirty) { renderer.render(scene, camera); dirty = false; }
  }
  requestAnimationFrame(loop);
  addEventListener('resize', () => tut.positionHand());
}
