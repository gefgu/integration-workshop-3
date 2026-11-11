#!/usr/bin/env bash
# Fast update of an existing installation. Run from an extracted, new bundle.
set -euo pipefail

PREFIX=/opt/tedtronics-bancada
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVICE=tedtronics-bancada.service
DROPIN_DIR=/etc/systemd/system/$SERVICE.d
DROPIN=$DROPIN_DIR/tedtronics-source.conf

if [ "$(id -u)" -ne 0 ]; then
  echo 'Rode com sudo: sudo ./update.sh' >&2; exit 1
fi
if [ "$#" -ne 0 ]; then
  echo 'Uso: sudo ./update.sh (mantém as opções da instalação atual)' >&2; exit 1
fi
if [ ! -x "$PREFIX/venv/bin/python" ] || [ ! -d "$PREFIX/app" ] || [ ! -d "$PREFIX/ui" ] ||
   ! systemctl cat "$SERVICE" >/dev/null 2>&1; then
  echo 'Instalação existente não encontrada. Use sudo ./install.sh para instalar primeiro.' >&2; exit 1
fi
for project in graph_validator bench_service; do
  old="$PREFIX/app/$project/pyproject.toml"
  new="$HERE/app/$project/pyproject.toml"
  if [ ! -f "$old" ] || [ ! -f "$new" ] || ! cmp -s "$old" "$new"; then
    echo "Dependências ou metadados de $project mudaram; atualização rápida cancelada." >&2
    echo 'Use sudo ./install.sh com as mesmas opções da instalação atual.' >&2
    exit 1
  fi
done
if [ ! -f "$HERE/ui/bench.html" ] || [ ! -f "$HERE/app/visao/pipeline_atual.py" ]; then
  echo 'Pacote incompleto. Extraia novamente o arquivo da bancada.' >&2; exit 1
fi

STAGE="$(mktemp -d "$PREFIX/.update.XXXXXX")"
rollback=0
had_dropin=0
cleanup() {
  status=$?
  trap - EXIT
  if [ "$rollback" = 1 ]; then
    echo 'Atualização falhou; restaurando a versão anterior.' >&2
    systemctl stop "$SERVICE" || true
    if [ -d "$STAGE/old-app" ]; then rm -rf "$PREFIX/app"; mv "$STAGE/old-app" "$PREFIX/app"; fi
    if [ -d "$STAGE/old-ui" ]; then rm -rf "$PREFIX/ui"; mv "$STAGE/old-ui" "$PREFIX/ui"; fi
    if [ "$had_dropin" = 1 ]; then cp "$STAGE/old-dropin" "$DROPIN"; else rm -f "$DROPIN"; fi
    systemctl daemon-reload || true
    systemctl start "$SERVICE" || echo 'Não foi possível reiniciar o serviço anterior; veja journalctl.' >&2
  fi
  rm -rf "$STAGE"
  exit "$status"
}
trap cleanup EXIT

echo 'Preparando arquivos; dependências e configurações serão mantidas.'
cp -a "$HERE/app" "$STAGE/app"
cp -a "$HERE/ui" "$STAGE/ui"
# Keep any audio generated locally as well as the files in the new bundle.
if [ -d "$PREFIX/app/graph_validator/audio" ]; then
  mkdir -p "$STAGE/app/graph_validator/audio"
  cp -an "$PREFIX/app/graph_validator/audio/." "$STAGE/app/graph_validator/audio/"
  chown -R --reference="$PREFIX/app/graph_validator/audio" "$STAGE/app/graph_validator/audio"
fi
mkdir -p "$DROPIN_DIR"
if [ -f "$DROPIN" ]; then cp -p "$DROPIN" "$STAGE/old-dropin"; had_dropin=1; fi
rollback=1
systemctl stop "$SERVICE"
mv "$PREFIX/app" "$STAGE/old-app"
mv "$PREFIX/ui" "$STAGE/old-ui"
mv "$STAGE/app" "$PREFIX/app"
mv "$STAGE/ui" "$PREFIX/ui"
cat > "$DROPIN" <<EOF
[Service]
Environment=PYTHONPATH=$PREFIX/app:$PREFIX/app/bench_service:$PREFIX/app/graph_validator/src
EOF
systemctl daemon-reload
systemctl start "$SERVICE"
for _ in $(seq 1 60); do
  if systemctl is-active --quiet "$SERVICE" && curl -fs http://127.0.0.1:8765/vision/state >/dev/null; then
    install -m 755 "$HERE/tedtronics-tela" /usr/local/bin/tedtronics-tela
    rollback=0
    echo 'Atualização concluída. Feche e abra novamente a tela TedTronics Bancada.'
    exit 0
  fi
  sleep 1
done
echo 'O serviço atualizado não respondeu. Veja journalctl -u tedtronics-bancada -n 50.' >&2
exit 1
