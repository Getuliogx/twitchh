'use strict';

const el = {
  setupForm: document.querySelector('#setup-form'),
  loginForm: document.querySelector('#login-form'),
  dashboard: document.querySelector('#dashboard'),
  notice: document.querySelector('#notice'),
  setupChannel: document.querySelector('#setup-channel'),
  setupTitle: document.querySelector('#setup-title'),
  setupPassword: document.querySelector('#setup-password'),
  loginPassword: document.querySelector('#login-password'),
  channel: document.querySelector('#channel'),
  title: document.querySelector('#title'),
  rtmpServer: document.querySelector('#rtmp-server'),
  streamKey: document.querySelector('#stream-key'),
  adminLive: document.querySelector('#admin-live'),
  settingsForm: document.querySelector('#settings-form'),
  regenerate: document.querySelector('#regenerate'),
  logout: document.querySelector('#logout')
};

function showNotice(message, error = false) {
  el.notice.textContent = message;
  el.notice.classList.remove('hidden', 'notice-error', 'notice-ok');
  el.notice.classList.add(error ? 'notice-error' : 'notice-ok');
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}

function setLive(live) {
  el.adminLive.textContent = live ? 'AO VIVO' : 'OFFLINE';
  el.adminLive.classList.toggle('badge-live', live);
  el.adminLive.classList.toggle('badge-off', !live);
}

async function showDashboard() {
  const info = await api('/api/admin/info');
  el.setupForm.classList.add('hidden');
  el.loginForm.classList.add('hidden');
  el.dashboard.classList.remove('hidden');
  el.channel.value = info.channel;
  el.title.value = info.title;
  el.rtmpServer.textContent = `rtmp://${location.hostname}/live`;
  el.streamKey.textContent = info.streamKey;
  setLive(Boolean(info.live));
}

async function init() {
  const publicInfo = await api('/api/public');
  if (!publicInfo.configured) {
    el.setupForm.classList.remove('hidden');
    return;
  }

  try {
    await showDashboard();
  } catch {
    el.loginForm.classList.remove('hidden');
  }
}

el.setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/setup', {
      method: 'POST',
      body: JSON.stringify({
        channel: el.setupChannel.value,
        title: el.setupTitle.value,
        password: el.setupPassword.value
      })
    });
    showNotice('Configuração criada. Agora é só usar os dados do OBS abaixo.');
    await showDashboard();
  } catch (error) {
    showNotice(error.message, true);
  }
});

el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: el.loginPassword.value })
    });
    await showDashboard();
  } catch (error) {
    showNotice(error.message, true);
  }
});

el.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ channel: el.channel.value, title: el.title.value })
    });
    showNotice('Informações salvas.');
  } catch (error) {
    showNotice(error.message, true);
  }
});

el.regenerate.addEventListener('click', async () => {
  if (!confirm('A chave antiga vai parar de funcionar. Continuar?')) return;
  try {
    const result = await api('/api/admin/regenerate-key', { method: 'POST', body: '{}' });
    el.streamKey.textContent = result.streamKey;
    showNotice('Nova chave criada. Atualize a chave no OBS.');
  } catch (error) {
    showNotice(error.message, true);
  }
});

el.logout.addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST', body: '{}' });
  location.reload();
});

document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    const target = document.querySelector(`#${button.dataset.copy}`);
    await navigator.clipboard.writeText(target.textContent);
    const old = button.textContent;
    button.textContent = 'Copiado';
    setTimeout(() => { button.textContent = old; }, 1200);
  });
});

setInterval(async () => {
  if (el.dashboard.classList.contains('hidden')) return;
  try {
    const data = await api('/api/live');
    setLive(Boolean(data.live));
  } catch {}
}, 3000);

init().catch((error) => showNotice(error.message, true));
