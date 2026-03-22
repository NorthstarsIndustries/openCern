const REPO = "NorthstarsIndustries/openCern";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main/scripts`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // /install.sh  — macOS & Linux universal installer
    // /install-l.sh — alias for Linux (same script)
    if (path === "/install.sh" || path === "/install-l.sh") {
      return Response.redirect(`${RAW_BASE}/install.sh`, 302);
    }

    // /install-w.sh — Windows (Git Bash / MSYS2)
    if (path === "/install-w.sh") {
      return Response.redirect(`${RAW_BASE}/install-w.sh`, 302);
    }

    // /uninstall.sh — remove binary and config
    if (path === "/uninstall.sh") {
      return Response.redirect(`${RAW_BASE}/uninstall.sh`, 302);
    }

    return new Response(
      [
        "OpenCERN CLI Installer",
        "",
        "Install:",
        "  macOS / Linux:    curl -fsSL https://opencern.northstarcorp.co/install.sh | sh",
        "  Windows:          curl -fsSL https://opencern.northstarcorp.co/install-w.sh | sh",
        "",
        "Uninstall:",
        "  macOS / Linux:    curl -fsSL https://opencern.northstarcorp.co/uninstall.sh | sh",
        "",
        "After install, run:  opencern",
      ].join("\n"),
      {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      },
    );
  },
};
