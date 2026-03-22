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

# Create a temp dir for download
TMP_DIR="$(mktemp -d)"
TMP_BIN="${TMP_DIR}/${BINARY_NAME}"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Query GitHub API for the latest cli-v* release
echo "  Finding latest CLI release..."
RELEASES_JSON="${TMP_DIR}/releases.json"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "https://api.github.com/repos/${REPO}/releases" -o "$RELEASES_JSON"
elif command -v wget >/dev/null 2>&1; then
  wget -q "https://api.github.com/repos/${REPO}/releases" -O "$RELEASES_JSON"
else
  echo "Error: curl or wget is required to install OpenCERN CLI."
  exit 1
fi

# Find the latest cli-v* release and extract the download URL for our asset
# Uses grep/sed to avoid requiring jq
DOWNLOAD_URL=""
TAG_NAME=""

# Parse releases JSON line by line to find first cli-v* tag and matching asset
IN_CLI_RELEASE="false"
while IFS= read -r line; do
  case "$line" in
    *'"tag_name"'*'cli-v'*)
      IN_CLI_RELEASE="true"
      TAG_NAME=$(echo "$line" | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
      ;;
    *'"browser_download_url"'*"${ASSET}"*)
      if [ "$IN_CLI_RELEASE" = "true" ]; then
        DOWNLOAD_URL=$(echo "$line" | sed 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        break
      fi
      ;;
  esac
done < "$RELEASES_JSON"

if [ -z "$DOWNLOAD_URL" ]; then
  echo "Error: Could not find ${ASSET} in any cli-v* release."
  echo "Check: https://github.com/${REPO}/releases"
  exit 1
fi

echo "  Version : ${TAG_NAME}"
echo "  Downloading from GitHub releases..."

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_BIN"
else
  wget -q "$DOWNLOAD_URL" -O "$TMP_BIN"
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
