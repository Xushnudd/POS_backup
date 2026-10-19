#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077
[[ ! -L .local && ! -L .local/https ]] || { echo 'Local TLS directory symlink refused.' >&2;exit 1; }
if [[ -e docker-compose.override.yml || -L docker-compose.override.yml ]]; then
 [[ -L docker-compose.override.yml && "$(readlink docker-compose.override.yml)" == docker-compose.local.yml ]] || { echo 'Existing docker-compose.override.yml preserved; configure the local overlay explicitly.' >&2; exit 1; }
fi
mkdir -p .local/https
chmod 700 .local .local/https
for local_cert in .local/https/key.pem .local/https/cert.pem; do
 [[ ! -L "$local_cert" ]] || { echo 'Certificate symlink refused.' >&2;exit 1; }
done
if [[ ! -s .local/https/key.pem || ! -s .local/https/cert.pem ]]; then
 openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
  -keyout .local/https/key.pem -out .local/https/cert.pem \
  -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' 2>/dev/null
fi
chmod 600 .local/https/key.pem .local/https/cert.pem
openssl x509 -in .local/https/cert.pem -noout -checkend 0 >/dev/null
openssl x509 -in .local/https/cert.pem -noout -checkhost localhost >/dev/null
[[ -L docker-compose.override.yml ]] || ln -s docker-compose.local.yml docker-compose.override.yml
echo 'Local HTTP development configuration ready. Compose uses POSTGRES_* and the internal db service.'
echo 'Host development DATABASE_URL does not select the local container database. Local APP_ORIGIN=http://localhost:3000.'
echo "For certificate access set LOCAL_UID=$(id -u) and LOCAL_GID=$(id -g) in .env."
echo 'Run docker compose up --build; open http://localhost:3000 or http://localhost:3443. No HTTPS redirect.'
echo 'CA/browser trust is NOT installed. Optional https://localhost:3443 remains self-signed; normal work uses HTTP.'
echo 'Production keeps its separate HTTPS configuration and final runner.'
