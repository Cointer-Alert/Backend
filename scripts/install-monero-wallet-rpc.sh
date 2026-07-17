#!/usr/bin/env bash
# Installs monero-wallet-rpc from the official Monero project binaries.
# Usage: sudo bash scripts/install-monero-wallet-rpc.sh [install-dir]
set -euo pipefail

INSTALL_DIR="${1:-/usr/local/bin}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Downloading current Monero CLI release..."
curl -fL "https://downloads.getmonero.org/cli/linux64" -o "$TMP_DIR/monero-cli.tar.bz2"

echo "Extracting..."
tar -xjf "$TMP_DIR/monero-cli.tar.bz2" -C "$TMP_DIR"

# The tarball extracts to a versioned directory, e.g. monero-x86_64-linux-gnu-v0.18.4.5/
EXTRACTED_DIR="$(find "$TMP_DIR" -maxdepth 1 -type d -name 'monero-*' | head -n1)"
if [ -z "$EXTRACTED_DIR" ]; then
  echo "Could not find extracted Monero directory" >&2
  exit 1
fi

if [ ! -f "$EXTRACTED_DIR/monero-wallet-rpc" ]; then
  echo "monero-wallet-rpc binary not found in extracted archive" >&2
  exit 1
fi

install -m 755 "$EXTRACTED_DIR/monero-wallet-rpc" "$INSTALL_DIR/monero-wallet-rpc"

echo "Installed to $INSTALL_DIR/monero-wallet-rpc"
"$INSTALL_DIR/monero-wallet-rpc" --version
