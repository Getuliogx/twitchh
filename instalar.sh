#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID}" -ne 0 ]; then
  echo "Execute assim: sudo bash instalar.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl unzip docker.io
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 1935/tcp || true
fi

cd "$(dirname "$0")"
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

IP=$(curl -4 -s --max-time 5 https://api.ipify.org || true)
if [ -z "$IP" ]; then
  IP=$(hostname -I | awk '{print $1}')
fi

echo
echo "==============================================="
echo "INSTALADO"
echo "Abra no navegador: http://${IP}/admin"
echo "Depois, o público entra em: http://${IP}/"
echo "==============================================="
