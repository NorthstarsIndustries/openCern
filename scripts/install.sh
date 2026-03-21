#!/usr/bin/env sh
# OpenCERN CLI Installer — macOS & Linux
# Usage: curl -fsSL https://opencern.northstarcorp.co/install.sh | sh

set -e

REPO="NorthstarsIndustries/openCern"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="opencern"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) ASSET="opencern-macos" ;;
  Linux)  ASSET="opencern-linux" ;;
  *)
    echo "Unsupported OS: $OS"
    echo "For Windows, use: curl -fsSL https://opencern.northstarcorp.co/install-w.sh | sh"
    exit 1
    ;;
esac

echo "Installing OpenCERN CLI..."
echo "  OS      : $OS"
echo "  Asset   : $ASSET"

# Get the latest release download URL
LATEST_URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

# Create a temp dir for download
TMP_DIR="$(mktemp -d)"
TMP_BIN="${TMP_DIR}/${BINARY_NAME}"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "  Downloading from GitHub releases..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$LATEST_URL" -o "$TMP_BIN"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$LATEST_URL" -O "$TMP_BIN"
else
  echo "Error: curl or wget is required to install OpenCERN CLI."
  exit 1
fi

chmod +x "$TMP_BIN"

# Install to /usr/local/bin (may require sudo)
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP_BIN" "${INSTALL_DIR}/${BINARY_NAME}"
else
  echo "  Installing to ${INSTALL_DIR} (requires sudo)..."
  sudo mv "$TMP_BIN" "${INSTALL_DIR}/${BINARY_NAME}"
fi

echo ""
echo "OpenCERN CLI installed successfully!"
echo "  Run: opencern --help"
echo ""

# Verify installation
if command -v opencern >/dev/null 2>&1; then
  opencern --version 2>/dev/null || true
fi
