#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
usage() {
 cat <<'TXT'
Install a trusted localhost certificate (Fedora workstation only).

This changes system/NSS HTTPS trust by installing mkcert's local CA.
The CA private key can sign certificates: keep it private, outside this project.
No certificate-validation bypass, browser exception, or production deployment.

After approving this local trust change, run as your normal desktop user:
  sudo dnf install mkcert nss-tools
  bash scripts/local/setup-trusted-https.sh --install-ca

For a read-only check, without --insecure/--cacert:
  bash scripts/local/setup-trusted-https.sh --check

Remove that CA trust later with: mkcert -uninstall
TXT
}
[[ $# -le 1 ]] || { usage;exit 2; }
case "${1:---help}" in
 --help) usage;exit 0;;
 --check) exec curl --fail --silent --show-error --max-time 15 https://localhost:3443/api/health/ready;;
 --install-ca) ;;
 *) usage;exit 2;;
esac
[[ $EUID -ne 0 ]] || { echo 'Run as the normal desktop user; mkcert requests sudo only for the system trust store.' >&2;exit 1; }
[[ -L docker-compose.override.yml && "$(readlink docker-compose.override.yml)" == docker-compose.local.yml ]] || { echo 'Local-only Compose override must be enabled first.' >&2;exit 1; }
[[ ! -L .local && ! -L .local/https ]] || { echo 'Local TLS directory symlink refused.' >&2;exit 1; }
for local_cert in .local/https/key.pem .local/https/cert.pem; do
 [[ ! -L "$local_cert" ]] || { echo 'Certificate symlink refused.' >&2;exit 1; }
done
for local_tool in mkcert certutil openssl docker curl; do
 command -v "$local_tool" >/dev/null || { echo "Missing required tool: $local_tool. On Fedora install mkcert and nss-tools first." >&2;exit 1; }
done
docker compose config --quiet
umask 077
mkdir -p .local/https .local/https-history
chmod 700 .local .local/https .local/https-history

# This explicit opt-in is the only step that changes host/browser trust.
TRUST_STORES=system,nss mkcert -install
local_stage=$(mktemp -d .local/https-new.XXXXXXXX)
trap 'rm -rf -- "$local_stage"' EXIT
mkcert -cert-file "$local_stage/cert.pem" -key-file "$local_stage/key.pem" localhost 127.0.0.1 ::1
chmod 600 "$local_stage/key.pem" "$local_stage/cert.pem"
openssl x509 -in "$local_stage/cert.pem" -noout -checkhost localhost >/dev/null
openssl x509 -in "$local_stage/cert.pem" -noout -checkend 86400 >/dev/null
local_key_hash=$(openssl pkey -in "$local_stage/key.pem" -pubout 2>/dev/null | openssl sha256)
local_cert_hash=$(openssl x509 -in "$local_stage/cert.pem" -pubkey -noout | openssl sha256)
[[ "$local_key_hash" == "$local_cert_hash" ]] || { echo 'Certificate/key mismatch; current files preserved.' >&2;exit 1; }
local_backup=$(mktemp -d .local/https-history/previous.XXXXXXXX)
for local_name in key.pem cert.pem; do
 [[ ! -f .local/https/$local_name ]] || cp -p ".local/https/$local_name" "$local_backup/$local_name"
 install -m 600 "$local_stage/$local_name" ".local/https/$local_name"
done
docker compose restart local-https
for local_attempt in {1..15}; do
 if curl --fail --silent --show-error --max-time 3 https://localhost:3443/api/health/ready; then
  printf '\nDefault system TLS verification passed. Reopen your browser/IDE and visit https://localhost:3443/.\n'
  exit 0
 fi
 sleep 1
done
echo 'Default TLS verification did not pass. Do not bypass validation; inspect host/browser trust and local proxy health.' >&2
exit 1
