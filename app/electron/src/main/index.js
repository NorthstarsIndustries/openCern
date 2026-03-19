const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipcMain = electron.ipcMain
const shell = electron.shell
const dialog = electron.dialog
const path = require('path')
const { exec } = require('child_process')
const http = require('http')
const DockerManager = require('./docker-manager')

let win;

// Full PATH that covers Docker on all macOS installations
const DOCKER_PATH = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
  '/Applications/Docker.app/Contents/Resources/bin',
  process.env.PATH || '',
].join(':');

process.on('uncaughtException', (err) => {
  console.error("FATAL:", err);
});

const gotTheLock = app ? app.requestSingleInstanceLock() : false;

if (!gotTheLock) {
  if (app) app.quit()
} else {
  // Protocol registration
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('opencern', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('opencern')
  }

  app.on('second-instance', (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
      const url = commandLine.pop()
      if (url && url.startsWith('opencern://')) {
        win.webContents.send('sso-auth-callback', url)
      }
    }
  })

  // ── Helpers ──

  function dockerEnv() {
    return { ...process.env, PATH: DOCKER_PATH };
  }

  async function waitForPort(port, timeoutMs = 90000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}`, (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => { req.destroy(); resolve(false); });
      });
      if (ok) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }

  // ── Splash ──

  function showSplash() {
    const loadWin = new BrowserWindow({
      width: 900, height: 600, frame: false, transparent: true,
      backgroundColor: '#080b14', alwaysOnTop: true,
      webPreferences: { nodeIntegration: true, webSecurity: false }
    });

    const videoPath = app.isPackaged
      ? path.join(process.resourcesPath, 'media/videos/startup_video/720p30/StartupLogo.mp4')
      : path.join(__dirname, '../../../../app/electron/media/videos/startup_video/720p30/StartupLogo.mp4');

    const html = `<body style="font-family:sans-serif;background:#080b14;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;overflow:hidden">
      <video width="900" height="600" autoplay loop muted playsinline style="object-fit:cover"><source src="file://${videoPath.replace(/\\/g,'/')}" type="video/mp4"></video>
      <div style="position:absolute;bottom:20px;display:flex;flex-direction:column;align-items:center">
        <p id="s" style="color:#9ca3af;font-size:13px;margin-bottom:8px;text-shadow:0 2px 4px rgba(0,0,0,.8)">Starting physics environments…</p>
        <div style="width:20px;height:20px;border:2px solid #1f2937;border-top:2px solid #3b82f6;border-radius:50%;animation:spin 1s linear infinite"></div>
      </div>
      <style>@keyframes spin{100%{transform:rotate(360deg)}}</style></body>`;

    loadWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return loadWin;
  }

  // ── Main ──

  let dockerManager;

  async function createWindow() {
    console.log("=== OpenCERN ===");
    console.log("Packaged:", app.isPackaged);

    // Clear stale Clerk/auth cookies & storage that can freeze the UI
    const ses = electron.session.defaultSession;
    try {
      await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'sessionstorage'] });
      console.log("Cleared cached session data");
    } catch (e) {
      console.warn("Could not clear session data:", e.message);
    }

    // 1. Create DockerManager (auto-patches env for Colima/broken creds)
    dockerManager = new DockerManager(dockerEnv());

    // 2. Docker daemon check
    try {
      await dockerManager._exec('docker info');
      console.log("Docker: OK");
    } catch {
      dialog.showErrorBox("Docker Required",
        "Docker is not running.\n\nPlease start Docker (Docker Desktop, Colima, OrbStack, etc.) and try again.");
      app.quit();
      return;
    }

    // 3. Splash
    const splash = showSplash();
    const splashMsg = (msg) => {
      splash.webContents.executeJavaScript(
        `document.getElementById('s').innerText = ${JSON.stringify(msg)}`
      ).catch(() => {});
    };

    // 4. Check for updates first (fast, non-blocking)
    const imagesPresent = await dockerManager.areImagesPresent();

    if (!imagesPresent) {
      // First launch — must download all images
      console.log("First launch: downloading images...");
      splashMsg('Downloading OpenCERN Engine… This may take a few minutes.');
      try {
        await dockerManager.pullImages((msg) => {
          console.log(`[Pull] ${msg}`);
          splashMsg(msg);
        });
      } catch (err) {
        splash.close();
        dialog.showErrorBox("Download Failed",
          "Failed to download the OpenCERN Engine containers.\n\n" + err.message);
        app.quit();
        return;
      }
    } else {
      console.log("Images present. Checking for updates...");
      splashMsg('Checking for updates…');
      const hasUpdate = await Promise.race([
        dockerManager.checkForUpdates(),
        new Promise(r => setTimeout(() => r(false), 5000))
      ]);

      if (hasUpdate) {
        const result = dialog.showMessageBoxSync({
          type: 'info',
          buttons: ['Update Now', 'Skip'],
          title: 'Update Available',
          message: 'A newer version of the OpenCERN engine is available.\nUpdate now for the latest features and fixes.'
        });
        if (result === 0) {
          splashMsg('Downloading update…');
          try {
            await dockerManager.pullImages((msg) => {
              console.log(`[Update] ${msg}`);
              splashMsg(msg);
            });
          } catch (err) {
            console.error("Update pull failed:", err.message);
          }
        }
      }
    }

    // 5. Start all containers (stop old ones first, create network, docker run)
    splashMsg('Starting physics environments…');
    console.log("Starting containers...");
    try {
      await dockerManager.startAll((msg) => {
        console.log(`[Start] ${msg}`);
        splashMsg(msg);
      });
    } catch (err) {
      console.error("Container start error:", err.message);
    }

    // 6. Wait for API (port 8080)
    splashMsg('Waiting for API…');
    console.log("Waiting for API (port 8080)...");
    const apiOk = await waitForPort(8080, 60000);
    console.log("API:", apiOk ? "READY" : "TIMEOUT (continuing)");

    // 7. Wait for frontend (port 3000)
    splashMsg('Loading interface…');
    console.log("Waiting for frontend (port 3000)...");
    const frontendOk = await waitForPort(3000, 90000);
    console.log("Frontend:", frontendOk ? "READY" : "TIMEOUT");

    // 8. Show main window
    win = new BrowserWindow({
      width: 1400, height: 900,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#080b14',
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    splash.close();
    win.show();
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
    console.log("=== Ready ===");
  }

  app.whenReady().then(createWindow);

  // macOS deep link
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      win.webContents.send('sso-auth-callback', url);
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // Shutdown — stop all containers gracefully
  app.on('before-quit', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      console.log("Shutting down containers...");
      if (dockerManager) {
        dockerManager.stopAll().finally(() => {
          app.isQuiting = true;
          app.exit(0);
        });
      } else {
        app.isQuiting = true;
        app.exit(0);
      }
    }
  });

  ipcMain.on('open-external-url', (event, url) => {
    shell.openExternal(url)
  })

  // ── IPC Handlers ──

  ipcMain.handle('check-docker-updates', async () => {
    try {
      if (!dockerManager) dockerManager = new DockerManager(dockerEnv());
      const hasUpdate = await Promise.race([
        dockerManager.checkForUpdates(),
        new Promise(r => setTimeout(() => r(false), 10000))
      ]);
      return { available: hasUpdate };
    } catch (err) {
      return { available: false, error: err.message };
    }
  });

  ipcMain.handle('start-docker-update', async () => {
    try {
      if (!dockerManager) dockerManager = new DockerManager(dockerEnv());
      await dockerManager.pullImages((msg) => {
        if (win) win.webContents.send('docker-update-progress', msg);
      });
      await dockerManager.startAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-docker-status', async () => {
    try {
      if (!dockerManager) dockerManager = new DockerManager(dockerEnv());
      const status = await dockerManager.getContainerStatus();
      return { running: true, containers: status };
    } catch (err) {
      return { running: false, error: err.message };
    }
  });

  ipcMain.handle('restart-containers', async () => {
    try {
      if (!dockerManager) dockerManager = new DockerManager(dockerEnv());
      await dockerManager.restartAll();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-container-logs', async (event, service) => {
    try {
      if (!dockerManager) dockerManager = new DockerManager(dockerEnv());
      const logs = await dockerManager.getLogs(service || 'api');
      return { logs, error: null };
    } catch (err) {
      return { logs: '', error: err.message };
    }
  });

  ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion(), electron: process.versions.electron, node: process.versions.node };
  });

  // Background update check every 30 minutes
  setInterval(async () => {
    try {
      if (!dockerManager) return;
      const hasUpdate = await Promise.race([
        dockerManager.checkForUpdates(),
        new Promise(r => setTimeout(() => r(false), 10000))
      ]);
      if (hasUpdate && win) {
        win.webContents.send('docker-update-available', true);
      }
    } catch {
      // Silently ignore background check failures
    }
  }, 30 * 60 * 1000);
}
