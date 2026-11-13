// Shared materials + procedural canvas textures (wood grain, brick, signs, mural).
import * as THREE from 'three';
import { leafPts } from './builder.js?v=20261113183345';

let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function leafPath(g, x, y, s) {
  const p = leafPts(s);
  g.beginPath(); p.forEach(([lx, ly], i) => i ? g.lineTo(x + lx, y - ly) : g.moveTo(x + lx, y - ly)); g.closePath();
}

export function glowTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}

export function makeMaterials(renderer, imgs = {}) {
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const grain = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const y = rnd() * h, amp = 2 + rnd() * 4, k = 1 + Math.floor(rnd() * 3);
      g.strokeStyle = `rgba(125,82,42,${0.03 + rnd() * 0.06})`;
      g.lineWidth = 0.6 + rnd() * 1.8;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin(x / w * Math.PI * 2 * k + i) * amp;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
  }, true);
  grain.anisotropy = aniso;

  const brick = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#efe6da'; g.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows, bw = w / 4;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 5; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), v = 222 + Math.floor(rnd() * 33);
      g.fillStyle = `rgb(${v},${v - 4},${v - 8})`;
      g.fillRect(x + 1.5, r * rh + 1.5, bw - 3, rh - 3);
    }
  }, true);
  brick.anisotropy = aniso;

  const tram = canvasTex(512, 108, (g, w, h) => {
    g.fillStyle = '#161616'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb23e'; g.font = '800 70px Nunito, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('504 JOSELINE', w / 2, h / 2 + 4);
    g.fillStyle = 'rgba(0,0,0,.45)';
    for (let x = 0; x < w; x += 5) g.fillRect(x, 0, 1.5, h);
    for (let y = 0; y < h; y += 5) g.fillRect(0, y, w, 1.5);
  });

  const marquee = canvasTex(1024, 402, (g, w, h) => {
    const bg = g.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.6);
    bg.addColorStop(0, '#8a2420'); bg.addColorStop(1, '#4d1210');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f6c453'; g.lineWidth = 8; g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 2; g.strokeRect(34, 34, w - 68, h - 68);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff1d2'; g.font = '800 74px Nunito, Arial, sans-serif';
    g.fillText('H A P P Y   B I R T H D A Y', w / 2, 112);
    g.font = '900 168px Fraunces, Georgia, serif';
    g.lineWidth = 10; g.strokeStyle = '#3a0c0a'; g.strokeText('Joseline', w / 2, 262);
    g.fillStyle = '#ffcc4d'; g.fillText('Joseline', w / 2, 262);
    g.fillStyle = '#e8432e';
    leafPath(g, 92, 262, 46); g.fill();
    leafPath(g, w - 92, 262, 46); g.fill();
  });

  const mural = canvasTex(1024, 722, (g, w, h) => {
    // a painted facade "hanging" on the wall, with a curled corner
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#9fd3ea'); sky.addColorStop(1, '#e6f2f2');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2e3c6'; g.fillRect(60, 70, w - 120, h - 70);
    g.fillStyle = '#d8c39c'; g.fillRect(60, 70, w - 120, 26);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) {
      const x = 96 + c * 98, y = 126 + r * 116;
      g.fillStyle = '#7fa6c2'; g.fillRect(x, y, 56, 84);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x + 6, y + 6, 14, 72);
      g.fillStyle = '#c9b089'; g.fillRect(x - 6, y + 84, 68, 8);
    }
    // curled corner
    g.fillStyle = '#b8492f';
    g.beginPath(); g.moveTo(w - 60, h - 250); g.lineTo(w - 60, h); g.lineTo(w - 330, h); g.closePath(); g.fill();
    g.fillStyle = '#fbf3e3';
    g.beginPath(); g.moveTo(w - 60, h - 250); g.quadraticCurveTo(w - 210, h - 150, w - 330, h); g.lineTo(w - 230, h - 70); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.beginPath(); g.moveTo(w - 330, h); g.lineTo(w - 230, h - 70); g.lineTo(w - 200, h); g.closePath(); g.fill();
  });

  const bill = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    if (imgs.daga) {
      const im = imgs.daga, k = Math.min(w / im.width, h / im.height) * 0.9;
      g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k);
    }
  });

  const lam = o => new THREE.MeshLambertMaterial({ flatShading: true, ...o });
  return {
    body: lam({ vertexColors: true, map: grain }),
    brick: lam({ vertexColors: true, map: brick }),
    water: new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x4f7486, flatShading: true }),
    glow: lam({ color: 0x3a4b63, emissive: 0xffc46b, emissiveIntensity: 0 }),
    light: lam({ color: 0xfff2d2, emissive: 0xffd88a, emissiveIntensity: 0 }),
    beacon: lam({ color: 0xe8483a, emissive: 0xff3a2a, emissiveIntensity: 0.25 }),
    bulbA: lam({ color: 0xffe7a6, emissive: 0xffc955, emissiveIntensity: 0 }),
    bulbB: lam({ color: 0xffe7a6, emissive: 0xffc955, emissiveIntensity: 0 }),
    letters: lam({ vertexColors: true, map: grain, emissive: 0xffffff, emissiveIntensity: 0 }),
    cnled: lam({ color: 0xece8e0, emissive: 0xffffff, emissiveIntensity: 0 }),
    tramsign: lam({ map: tram, emissive: 0xffffff, emissiveMap: tram, emissiveIntensity: 0.3 }),
    marquee: lam({ map: marquee, emissive: 0xffffff, emissiveMap: marquee, emissiveIntensity: 0.12 }),
    mural: lam({ map: mural }),
    billboard: lam({ map: bill, emissive: 0xffffff, emissiveMap: bill, emissiveIntensity: 0.08 }),
  };
}
