"""Standalone camera diagnostics, independent of the built bench UI."""

CAMERA_DEBUG_HTML = r'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Diagnóstico da câmera · TedTronics</title>
<style>
body{font:16px system-ui,sans-serif;background:#f5ead8;color:#201e1d;margin:0;padding:16px}
h1{font-size:1.4rem;margin:0 0 8px} .layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,1fr);gap:12px}
section{background:#fffaf1;border:1px solid #c9bba6;border-radius:10px;padding:12px;margin-bottom:12px}
.frame{background:#222;min-height:180px;display:grid;place-items:center;color:white}.frame img{display:block;max-width:100%;max-height:65vh}
button{padding:10px;font:inherit;cursor:pointer} pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px} .bad{color:#a12620} .good{color:#326322} ul{padding-left:20px} @media(max-width:700px){.layout{display:block}}
</style></head><body>
<h1>Diagnóstico da câmera</h1><p>Leitura direta do serviço da bancada. <a href="/">Abrir bancada</a> · <a href="/vision/state">Estado JSON</a></p>
<div class="layout"><div><section><strong>Imagem processada</strong><p id="frame-status" role="status">Aguardando imagem…</p><div class="frame"><img id="frame" alt="Imagem processada da câmera" hidden></div></section>
<section><button id="recalibrate">Recalibrar câmera</button> <span id="action-status" role="status"></span><p>A recalibração procura a placa novamente; ela não reinicia uma câmera indisponível.</p></section></div>
<div><section><strong>Estado da leitura</strong><p id="connection" role="status">Conectando ao serviço…</p><div id="summary"></div></section>
<section><strong>Peças reconhecidas</strong><ul id="pieces"></ul><strong>Não reconhecidas</strong><ul id="unknown"></ul></section>
<section><strong>Todos os dados do serviço</strong><pre id="raw">Aguardando…</pre></section></div></div>
<script>
const $ = id => document.getElementById(id);
let lastFrame = null;
async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {...options, cache:'no-store', signal:controller.signal});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response;
  } finally { clearTimeout(timer); }
}
function showList(id, entries) {
  const list = $(id); list.replaceChildren();
  if (!entries || !entries.length) { const li = document.createElement('li'); li.textContent = 'Nenhuma'; list.append(li); return; }
  entries.forEach(entry => { const li = document.createElement('li'); li.textContent = JSON.stringify(entry); list.append(li); });
}
async function stateLoop() {
  try {
    const data = await (await request('/vision/state')).json();
    $('connection').textContent = data.available ? (data.valid ? 'Câmera disponível · placa lida' : 'Câmera disponível · leitura não válida') : 'Câmera indisponível';
    $('connection').className = data.available && data.valid ? 'good' : 'bad';
    const rows = [ ['Motivo',data.reason], ['Serviço em execução',data.running], ['Recalibrando',data.recalibrating], ['Perfil',data.profile], ['Quadros/s',data.fps], ['Idade do quadro (s)',data.age_s], ['Tamanho do quadro',data.frame_size], ['Calibração',data.calibration], ['Quadros para confirmar',data.stable_frames], ['Peças em confirmação',data.confirming], ['Versão da leitura',data.version] ];
    $('summary').replaceChildren(...rows.map(([name,value]) => { const p = document.createElement('p'); p.textContent = name + ': ' + (value == null ? '—' : Array.isArray(value) ? value.join(' × ') : String(value)); return p; }));
    showList('pieces', data.pieces); showList('unknown', data.unknown);
    $('raw').textContent = JSON.stringify(data, null, 2);
  } catch (error) { $('connection').className = 'bad'; $('connection').textContent = 'Sem resposta do serviço: ' + error.message; }
  setTimeout(stateLoop, 1000);
}
async function frameLoop() {
  try {
    const blob = await (await request('/vision/frame.jpg?t=' + Date.now())).blob();
    const next = URL.createObjectURL(blob); const img = $('frame');
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = next; });
    if (lastFrame) URL.revokeObjectURL(lastFrame); lastFrame = next; img.hidden = false;
    $('frame-status').textContent = 'Imagem recebida às ' + new Date().toLocaleTimeString(); $('frame-status').className = 'good';
  } catch (error) { $('frame-status').textContent = 'Não foi possível atualizar a imagem (' + (error.message || 'imagem inválida') + '). Tentando novamente…'; $('frame-status').className = 'bad'; }
  setTimeout(frameLoop, 500);
}
$('recalibrate').addEventListener('click', async () => {
  const button = $('recalibrate'); button.disabled = true; $('action-status').textContent = 'Enviando…';
  try { await request('/vision/recalibrate', {method:'POST'}); $('action-status').textContent = 'Pedido enviado.'; }
  catch (error) { $('action-status').textContent = 'Falha ao recalibrar: ' + error.message; }
  finally { button.disabled = false; }
});
stateLoop(); frameLoop();
</script></body></html>'''
