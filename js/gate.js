// Phones and tablets only. A desktop can be unlocked once with ?key=... (stored in this browser).
// This is a friendly gate, not security: it just keeps the gift a phone experience.
const KEY_HASH = '09f236e1c83d01bb62d18d214195df66b52c5685a19c723533066ef89fd9dda7';
const LS = 'lt.desk';

function isMobile() {
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPadOS
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function showGate() {
  document.getElementById('loading').hidden = true;
  const gate = document.getElementById('gate');
  gate.hidden = false;
  const url = location.origin + location.pathname;
  document.getElementById('gateUrl').textContent = url.replace(/^https?:\/\//, '');
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  s.onload = () => {
    try {
      const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
      document.getElementById('gateQr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch { /* QR is optional */ }
  };
  document.head.appendChild(s);
}

(async () => {
  const url = new URL(location.href);
  const k = url.searchParams.get('key');
  if (k !== null) {
    try {
      if (k === 'lock') localStorage.removeItem(LS);
      else if (await sha(k) === KEY_HASH) localStorage.setItem(LS, '1');
    } catch { /* storage or crypto unavailable */ }
    url.searchParams.delete('key');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  let ok = isMobile();
  try { if (localStorage.getItem(LS) === '1') ok = true; } catch { /* ignore */ }
  if (!ok) { showGate(); return; }
  try {
    const m = await import('./app.js');
    await m.startApp();
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML = '<p>Something went wrong unpacking the box.<br>Try reloading the page.</p>';
  }
})();
