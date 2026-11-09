#!/usr/bin/env bash
# Removes the TedTronics bench from the Raspberry Pi.  sudo ./uninstall.sh [--tudo]
# --tudo also deletes the bench data (students' progress not yet synced, bench name).
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo:  sudo ./uninstall.sh"
  exit 1
fi
USER_NAME="${SUDO_USER:-pi}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
systemctl disable --now tedtronics-bancada.service 2>/dev/null || true
rm -f /etc/systemd/system/tedtronics-bancada.service
systemctl daemon-reload
rm -f /usr/local/bin/tedtronics-tela /usr/share/applications/tedtronics-bancada.desktop
rm -f "$USER_HOME/.config/autostart/tedtronics-tela.desktop"
DESKTOP_DIR="$(sudo -u "$USER_NAME" xdg-user-dir DESKTOP 2>/dev/null || echo "$USER_HOME/Desktop")"
rm -f "$DESKTOP_DIR/tedtronics-bancada.desktop"
rm -rf /opt/tedtronics-bancada
if [ "${1:-}" = "--tudo" ]; then
  rm -rf "$USER_HOME/.local/share/tedtronics-bancada" "$USER_HOME/.config/tedtronics-tela" /etc/tedtronics-bancada.env
  echo "Bancada e dados removidos."
else
  echo "Bancada removida. Os dados ficaram em $USER_HOME/.local/share/tedtronics-bancada (use --tudo para apagar)."
fi
