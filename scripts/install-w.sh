#!/usr/bin/env sh
# OpenCERN CLI Installer — Windows (Git Bash / MSYS2)
# Usage: curl -fsSL https://opencern.northstarcorp.co/install-w.sh | sh

set -e

REPO="NorthstarsIndustries/openCern"
ASSET="opencern-win.exe"
BINARY_NAME="opencern.exe"

echo "Installing OpenCERN CLI for Windows..."

# Determine install directory — prefer a directory already on PATH
if [ -n "$USERPROFILE" ]; then
  INSTALL_DIR="${USERPROFILE}/bin"
elif [ -n "$HOME" ]; then
  INSTALL_DIR="${HOME}/bin"
else
  INSTALL_DIR="/usr/local/bin"
fi

mkdir -p "$INSTALL_DIR"

LATEST_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

TMP_BIN="${INSTALL_DIR}/${BINARY_NAME}"

echo "  Downloading from GitHub releases..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$LATEST_URL" -o "$TMP_BIN"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$LATEST_URL" -O "$TMP_BIN"
else
  echo "Error: curl or wget is required. Install Git for Windows or use PowerShell."
  exit 1
fi

chmod +x "$TMP_BIN" 2>/dev/null || true

echo ""
echo "OpenCERN CLI installed to: ${INSTALL_DIR}/${BINARY_NAME}"
echo ""

# Check if the install dir is on PATH
case ":$PATH:" in
  *":${INSTALL_DIR}:"*)
    echo "Run: opencern --help"
    ;;
  *)
    echo "Add the following to your PATH to use 'opencern' globally:"
    echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
    echo ""
    echo "Or run directly:"
    echo "  ${INSTALL_DIR}/${BINARY_NAME} --help"
    ;;
esac
