// Boot: load the game (phones, tablets and desktop browsers).
(async () => {
  try {
    const m = await import('./app.js?v=20261113183615');
    await m.startApp();
  } catch (e) {
    console.error(e);
    document.getElementById('loading').innerHTML = '<p>Something went wrong unpacking the box.<br>Try reloading the page.</p>';
  }
})();
