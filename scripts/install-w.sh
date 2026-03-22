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

# Create temp dir
TMP_DIR="$(mktemp -d)"
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
  echo "Error: curl or wget is required. Install Git for Windows or use PowerShell."
  exit 1
fi

# Find the latest cli-v* release and extract the download URL
DOWNLOAD_URL=""
TAG_NAME=""
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
echo "  Downloading..."

TMP_BIN="${INSTALL_DIR}/${BINARY_NAME}"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$DOWNLOAD_URL" -o "$TMP_BIN"
else
  wget -q "$DOWNLOAD_URL" -O "$TMP_BIN"
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
