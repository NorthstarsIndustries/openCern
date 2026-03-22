#!/usr/bin/env sh
# OpenCERN CLI Uninstaller
# Usage: curl -fsSL https://opencern.northstarcorp.co/uninstall.sh | sh

set -e

BINARY_NAME="opencern"
CONFIG_DIR="${HOME}/.opencern"

echo "Uninstalling OpenCERN CLI..."

# Locate the binary
BIN_PATH=""
if [ -f "/usr/local/bin/${BINARY_NAME}" ]; then
  BIN_PATH="/usr/local/bin/${BINARY_NAME}"
elif command -v "$BINARY_NAME" >/dev/null 2>&1; then
  BIN_PATH="$(command -v "$BINARY_NAME")"
fi

if [ -z "$BIN_PATH" ]; then
  echo "  OpenCERN CLI is not installed (binary not found)."
else
  echo "  Found: ${BIN_PATH}"
  if [ -w "$(dirname "$BIN_PATH")" ]; then
    rm -f "$BIN_PATH"
  else
    echo "  Removing (requires sudo)..."
    sudo rm -f "$BIN_PATH"
  fi
  echo "  Binary removed."
fi

# Remove config directory
if [ -d "$CONFIG_DIR" ]; then
  echo "  Removing config directory: ${CONFIG_DIR}"
  rm -rf "$CONFIG_DIR"
  echo "  Config removed."
fi

echo ""
echo "OpenCERN CLI has been uninstalled."
