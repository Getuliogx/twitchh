'use strict';

const el = {
  brand: document.querySelector('#brand-name'),
  title: document.querySelector('#stream-title'),
  badge: document.querySelector('#live-badge'),
  viewers: document.querySelector('#viewer-count'),
  video: document.querySelector('#video'),
  message: document.querySelector('#player-message'),
  chat: document.querySelector('#chat'),
  setupWarning: document.querySelector('#setup-warning')
};

let hls = null;
let nativeSourceSet = false;
let currentlyLive = false;

function setBadge(live) {
  currentlyLive = live;
  el.badge.textContent = live ? 'AO VIVO' : 'OFFLINE';
  el.badge.classList.toggle('badge-live', live);
  el.badge.classList.toggle('badge-off', !live);
  el.message.classList.toggle('hidden', live);
}

function stopPlayer() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (nativeSourceSet) {
    el.video.removeAttribute('src');
    el.video.load();
    nativeSourceSet = false;
  }
}

function startPlayer() {
  if (hls || nativeSourceSet) return;
  const source = `/hls/principal.m3u8?t=${Date.now()}`;

  if (el.video.canPlayType('application/vnd.apple.mpegurl')) {
    el.video.src = source;
    nativeSourceSet = true;
    el.video.play().catch(() => {});
    return;
  }

  if (window.Hls?.isSupported()) {
    hls = new window.Hls({
      lowLatencyMode: true,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 5,
      enableWorker: true
    });
    hls.loadSource(source);
    hls.attachMedia(el.video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => el.video.play().catch(() => {}));
    hls.on(window.Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      stopPlayer();
      setTimeout(() => {
        if (currentlyLive) startPlayer();
      }, 2000);
    });
  }
}

async function refreshLive() {
  try {
    const response = await fetch('/api/live', { cache: 'no-store' });
    const data = await response.json();
    setBadge(Boolean(data.live));
    if (data.live) startPlayer();
    else stopPlayer();
  } catch {
    setBadge(false);
    stopPlayer();
  }
}

async function init() {
  const response = await fetch('/api/public', { cache: 'no-store' });
  const config = await response.json();

  if (!config.configured) {
    el.setupWarning.classList.remove('hidden');
    setBadge(false);
    return;
  }

  el.brand.textContent = config.channel;
  el.title.textContent = config.title;
  document.title = `${config.channel} — ${config.title}`;
  el.chat.src = `https://www.twitch.tv/embed/${encodeURIComponent(config.channel)}/chat?parent=${encodeURIComponent(location.hostname)}&darkpopout`;

  setBadge(Boolean(config.live));
  if (config.live) startPlayer();
  setInterval(refreshLive, 3000);

  const viewerEvents = new EventSource('/api/viewers');
  viewerEvents.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const count = Number(data.viewers || 0);
    el.viewers.textContent = `${count} ${count === 1 ? 'neste site' : 'neste site'}`;
  };
}

init().catch(() => {
  el.setupWarning.textContent = 'Não foi possível carregar o site.';
  el.setupWarning.classList.remove('hidden');
});
