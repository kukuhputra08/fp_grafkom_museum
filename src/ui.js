const $ = (selector) => document.querySelector(selector);

const MODE_LABEL = { solid: 'Solid', wire: 'Wireframe', point: 'Point Cloud' };
const fmt = (n) => n.toLocaleString('id-ID');

/** Semua pengaturan elemen HTML (overlay, HUD, panel info) ada di sini. */
export function createUI({ onStart, onModeClick, lights }) {
  const overlay = $('#overlay');
  const hud = $('#hud');
  const prompt = $('#prompt');
  const panel = $('#panel');
  const startBtn = $('#startBtn');
  const lightsPanel = $('#lights');
  const lampList = $('#lampList');
  let panelExhibit = null;

  startBtn.addEventListener('click', onStart);
  panel.querySelectorAll('#pModes button').forEach((btn) =>
    btn.addEventListener('click', () => onModeClick(btn.dataset.mode))
  );

  // ---------- Saklar lampu ----------
  // Daftar dibuat sekali, setelah itu hanya status nyala/mati yang diperbarui.
  const lampButtons = new Map();
  for (const lamp of lights.list()) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lamp';
    btn.dataset.id = lamp.id;
    btn.innerHTML =
      `<span class="led"></span><span class="lname"></span>` + (lamp.key ? `<kbd>${lamp.key}</kbd>` : '');
    btn.querySelector('.lname').textContent = lamp.label;
    btn.addEventListener('click', () => lights.onToggle(lamp.id));
    li.appendChild(btn);
    lampList.appendChild(li);
    lampButtons.set(lamp.id, btn);
  }
  $('#allOn').addEventListener('click', () => lights.onAll(true));
  $('#allOff').addEventListener('click', () => lights.onAll(false));

  function refreshLights() {
    for (const lamp of lights.list()) {
      const btn = lampButtons.get(lamp.id);
      btn.classList.toggle('on', lamp.on);
      btn.setAttribute('aria-pressed', String(lamp.on));
    }
  }
  refreshLights();

  // Saat kursor di atas panel saklar, layar jeda dibuat transparan supaya perubahan cahayanya terlihat
  lightsPanel.addEventListener('mouseenter', () => overlay.classList.add('peek'));
  lightsPanel.addEventListener('mouseleave', () => overlay.classList.remove('peek'));

  function renderPanel() {
    if (!panelExhibit) return;
    const { def, stats, mode, failed } = panelExhibit;
    $('#pName').textContent = def.name;
    $('#pOrigin').textContent = def.origin;
    $('#pDesc').textContent = def.description;
    const rows = failed || !stats
      ? '<div class="err">Model gagal dimuat. Cek file di public/models/.</div>'
      : [
          ['Vertex', fmt(stats.vertices)],
          ['Edge', fmt(stats.edges)],
          ['Face (segitiga)', fmt(stats.faces)],
          ['Mesh', fmt(stats.meshes)],
          ['Material', fmt(stats.materials)],
        ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#pStats').innerHTML = rows;
    panel.querySelectorAll('#pModes button').forEach((btn) =>
      btn.classList.toggle('active', btn.dataset.mode === mode)
    );
  }

  return {
    setProgress(fraction, text) {
      $('#barFill').style.width = `${Math.round(fraction * 100)}%`;
      if (text) $('#loadText').textContent = text;
    },
    ready(text) {
      $('#loadText').textContent = text;
      $('#barFill').style.width = '100%';
      startBtn.disabled = false;
    },
    showOverlay(paused) {
      overlay.classList.remove('hidden');
      hud.classList.add('hidden');
      lightsPanel.classList.remove('compact');
      if (paused) startBtn.textContent = 'Lanjutkan';
    },
    hideOverlay() {
      overlay.classList.add('hidden');
      overlay.classList.remove('peek');
      hud.classList.remove('hidden');
      lightsPanel.classList.add('compact');
    },
    setPrompt(text) {
      prompt.classList.toggle('hidden', !text);
      if (text) prompt.textContent = text;
    },
    openPanel(exhibit) {
      panelExhibit = exhibit;
      panel.classList.remove('hidden');
      renderPanel();
    },
    closePanel() {
      panelExhibit = null;
      panel.classList.add('hidden');
    },
    refreshPanel: renderPanel,
    refreshLights,
    get panelExhibit() {
      return panelExhibit;
    },
    modeLabel: (m) => MODE_LABEL[m],
  };
}
