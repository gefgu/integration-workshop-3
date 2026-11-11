#!/usr/bin/env bash
# TedTronics bench installer for the Raspberry Pi (Raspberry Pi OS Bookworm, 64-bit, desktop).
#
#   sudo ./install.sh [--no-ble] [--controls auto|/dev/ttyUSB0|/dev/serial0 | --no-controls] [--no-demo]
#                     [--camera N | --no-camera] [--no-autostart]
#
#   --no-ble      without the Bluetooth link to the teacher app (it is on by default; the Pi 3/4/5 have Bluetooth)
#   --controls    serial port of the ESP32 with the joystick + Energizar. Default "auto": the ESP32 is found on
#                 the USB cable (/dev/ttyUSB*, /dev/ttyACM*) or on the GPIO UART (/dev/serial0) by itself.
#
# Installs to /opt/tedtronics-bancada:
#   - the bench service (validator + vision + the bench screen), as a systemd service that starts with the Pi;
#   - the bench screen in Chromium kiosk mode, opened at login, plus a "TedTronics Bancada" desktop icon.
set -euo pipefail

PREFIX=/opt/tedtronics-bancada
HERE="$(cd "$(dirname "$0")" && pwd)"
BLE=1
CONTROLS=auto
DEMO=1
CAMERA=0
AUTOSTART=1
while [ $# -gt 0 ]; do
  case "$1" in
    --ble) BLE=1 ;;
    --no-ble) BLE=0 ;;
    --controls) CONTROLS="$2"; shift ;;
    --no-controls) CONTROLS="" ;;
    --no-demo) DEMO=0 ;;
    --camera) CAMERA="$2"; shift ;;
    --no-camera) CAMERA=none ;;
    --no-autostart) AUTOSTART=0 ;;
    *) echo "Opção desconhecida: $1"; exit 1 ;;
  esac
  shift
done

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo:  sudo ./install.sh"
  exit 1
fi
USER_NAME="${SUDO_USER:-pi}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
if [ -z "$USER_HOME" ]; then
  echo "Usuário $USER_NAME não encontrado."
  exit 1
fi

echo "==> 1/6  Pacotes do sistema"
apt-get update -y
apt-get install -y python3-venv python3-pip curl
apt-get install -y chromium-browser || apt-get install -y chromium
if [ "$BLE" = 1 ]; then
  apt-get install -y bluez
  systemctl enable --now bluetooth || true
  rfkill unblock bluetooth || true
fi
if [ "$CONTROLS" = /dev/serial0 ] && command -v raspi-config >/dev/null 2>&1; then
  # The ESP32 talks on the GPIO UART: hardware on, login console off (takes effect after a reboot).
  raspi-config nonint do_serial_hw 0 || true
  raspi-config nonint do_serial_cons 1 || true
fi

echo "==> 2/6  Copiando a bancada para $PREFIX"
mkdir -p "$PREFIX"
rm -rf "$PREFIX/app" "$PREFIX/ui"
cp -r "$HERE/app" "$HERE/ui" "$PREFIX/"
chown -R "$USER_NAME": "$PREFIX/app/graph_validator/audio"
install -m 644 "$HERE/tedtronics-bancada.png" "$PREFIX/tedtronics-bancada.png"
install -m 755 "$HERE/tedtronics-tela" /usr/local/bin/tedtronics-tela
install -m 755 "$HERE/uninstall.sh" "$PREFIX/uninstall.sh"

echo "==> 3/6  Ambiente Python (pode levar alguns minutos)"
python3 -m venv "$PREFIX/venv"
"$PREFIX/venv/bin/pip" install --upgrade pip
EXTRAS="vision"
if [ "$BLE" = 1 ]; then EXTRAS="$EXTRAS,ble"; fi
if [ -n "$CONTROLS" ]; then EXTRAS="$EXTRAS,controls"; fi
"$PREFIX/venv/bin/pip" install "$PREFIX/app/graph_validator[tts]" "$PREFIX/app/bench_service[$EXTRAS]"

echo "==> 4/6  Serviço da bancada (liga sozinho com a Pi)"
ARGS="--no-browser"
if [ "$CAMERA" = none ]; then ARGS="$ARGS --no-camera"; else ARGS="$ARGS --camera $CAMERA"; fi
if [ "$DEMO" = 0 ]; then ARGS="$ARGS --no-demo"; fi
if [ "$BLE" = 1 ]; then ARGS="$ARGS --ble"; usermod -aG bluetooth "$USER_NAME" || true; fi
if [ -n "$CONTROLS" ]; then ARGS="$ARGS --controls $CONTROLS"; usermod -aG dialout "$USER_NAME" || true; fi
usermod -aG video "$USER_NAME" || true
# Settings kept across reinstalls: the bench secret must match the server's TEDTRONICS_BENCH_SECRET.
if [ ! -f /etc/tedtronics-bancada.env ]; then
  cat > /etc/tedtronics-bancada.env <<'EOF'
# TedTronics bench settings (sudo systemctl restart tedtronics-bancada after editing)
# Same value as the server's TEDTRONICS_BENCH_SECRET; it signs the teacher's unlock of the bench.
#TEDTRONICS_BENCH_SECRET=
# A fixed name for this bench (default: generated once)
#TEDTRONICS_BENCH_ID=bancada-01
EOF
  chmod 600 /etc/tedtronics-bancada.env
fi
# The teacher app unlocks the bench with a token signed by this secret (Neon: private.bench_secret).
if ! grep -q '^TEDTRONICS_BENCH_SECRET=' /etc/tedtronics-bancada.env && [ -t 0 ]; then
  echo
  echo "Segredo da bancada: o mesmo valor de private.bench_secret no Neon (o app usa para liberar a bancada)."
  read -r -s -p "Cole o segredo e aperte Enter (ou só Enter para configurar depois): " SECRET
  echo
  if [ -n "$SECRET" ]; then
    printf 'TEDTRONICS_BENCH_SECRET=%s\n' "$SECRET" >> /etc/tedtronics-bancada.env
  fi
fi
cat > /etc/systemd/system/tedtronics-bancada.service <<EOF
[Unit]
Description=TedTronics - servico da bancada
After=network-online.target bluetooth.target
Wants=network-online.target

[Service]
User=$USER_NAME
WorkingDirectory=$PREFIX
Environment=PYTHONPATH=$PREFIX/app
Environment=TEDTRONICS_BENCH_UI=$PREFIX/ui
Environment=TEDTRONICS_AUDIO_DIR=$PREFIX/app/graph_validator/audio
Environment=TEDTRONICS_PIPER_VOICE=$PREFIX/app/graph_validator/voices/pt_BR-cadu-medium.onnx
EnvironmentFile=-/etc/tedtronics-bancada.env
ExecStart=$PREFIX/venv/bin/python -m bench_service.launcher $ARGS
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable tedtronics-bancada.service
systemctl restart tedtronics-bancada.service

echo "==> 5/6  Ícone e tela em modo quiosque"
DESKTOP_ENTRY="[Desktop Entry]
Type=Application
Name=TedTronics Bancada
Comment=Abre a tela da bancada TedTronics
Exec=/usr/local/bin/tedtronics-tela
Icon=$PREFIX/tedtronics-bancada.png
Terminal=false
Categories=Education;"
echo "$DESKTOP_ENTRY" > /usr/share/applications/tedtronics-bancada.desktop
DESKTOP_DIR="$(sudo -u "$USER_NAME" xdg-user-dir DESKTOP 2>/dev/null || echo "$USER_HOME/Desktop")"
mkdir -p "$DESKTOP_DIR"
echo "$DESKTOP_ENTRY" > "$DESKTOP_DIR/tedtronics-bancada.desktop"
chmod 755 "$DESKTOP_DIR/tedtronics-bancada.desktop"
chown "$USER_NAME": "$DESKTOP_DIR/tedtronics-bancada.desktop"
if [ "$AUTOSTART" = 1 ]; then
  mkdir -p "$USER_HOME/.config/autostart"
  echo "$DESKTOP_ENTRY" > "$USER_HOME/.config/autostart/tedtronics-tela.desktop"
  chown -R "$USER_NAME": "$USER_HOME/.config/autostart"
fi
# keep the 7" screen on
if command -v raspi-config >/dev/null 2>&1; then raspi-config nonint do_blanking 1 || true; fi

echo "==> 6/6  Conferindo o serviço"
for _ in $(seq 1 60); do
  if curl -fs http://127.0.0.1:8765/status >/dev/null; then
    echo
    echo "Pronto! A bancada está rodando em http://$(hostname -I | awk '{print $1}'):8765"
    echo " - Tela da bancada: ícone \"TedTronics Bancada\" (e abre sozinha ao ligar a Pi)"
    echo " - Sair da tela cheia: Alt+F4"
    echo " - App do professor (Simulador/Wi-Fi): use o IP acima, porta 8765"
    echo " - Ver o que está acontecendo: journalctl -u tedtronics-bancada -f"
    if [ "$BLE" = 1 ]; then echo " - Bluetooth: no app, Bancada > Bluetooth > Procurar bancadas (nome TedTronics-...)"; fi
    if ! grep -q '^TEDTRONICS_BENCH_SECRET=' /etc/tedtronics-bancada.env; then
      echo " ! Falta o segredo da bancada: sudo nano /etc/tedtronics-bancada.env (sem ele o app não libera a bancada)"
    fi
    if [ "$CONTROLS" = /dev/serial0 ]; then echo " ! Reinicie a Pi uma vez para ligar a porta serial da ESP32: sudo reboot"; fi
    exit 0
  fi
  sleep 2
done
echo "O serviço não respondeu. Veja: journalctl -u tedtronics-bancada -n 50"
exit 1
