const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const NETWORK = 'opencern-net';
const DATASET_DIR = path.join(os.homedir(), 'opencern-datasets');

// Container definitions — single source of truth
const CONTAINERS = [
  {
    name: 'opencern-api',
    image: 'ghcr.io/ceoatnorthstar/api:latest',
    ports: [['127.0.0.1', 8080, 8080]],
    volumes: () => [[DATASET_DIR, '/home/appuser/opencern-datasets']],
    healthUrl: 'http://127.0.0.1:8080/health',
  },
  {
    name: 'opencern-xrootd',
    image: 'ghcr.io/ceoatnorthstar/xrootd:latest',
    ports: [['127.0.0.1', 8081, 8081]],
    volumes: () => [[DATASET_DIR, '/home/appuser/opencern-datasets']],
    healthUrl: 'http://127.0.0.1:8081/health',
  },
  {
    name: 'opencern-streamer',
    image: 'ghcr.io/ceoatnorthstar/streamer:latest',
    ports: [['127.0.0.1', 9001, 9001], ['127.0.0.1', 9002, 9002]],
    volumes: () => [[path.join(DATASET_DIR, 'processed'), '/home/appuser/opencern-datasets/processed', 'ro']],
  },
  {
    name: 'opencern-quantum',
    image: 'ghcr.io/ceoatnorthstar/quantum:latest',
    ports: [['127.0.0.1', 8082, 8082]],
    volumes: () => [],
    healthUrl: 'http://127.0.0.1:8082/health',
  },
];

class DockerManager {
  constructor(env) {
    this.env = { ...env };
    this._patchDockerConfig();
    this._ensureDatasetDir();
  }

  // ── Environment fixes ──

  _patchDockerConfig() {
    try {
      const homeConfig = path.join(os.homedir(), '.docker', 'config.json');
      if (!fs.existsSync(homeConfig)) return;
      const cfg = JSON.parse(fs.readFileSync(homeConfig, 'utf8'));

      // Resolve DOCKER_HOST from context if not already set
      if (cfg.currentContext && !this.env.DOCKER_HOST) {
        const knownSocks = [
          path.join(os.homedir(), `.colima/${cfg.currentContext}/docker.sock`),
          path.join(os.homedir(), '.colima/default/docker.sock'),
          path.join(os.homedir(), '.docker/run/docker.sock'),
          '/var/run/docker.sock',
        ];
        for (const sock of knownSocks) {
          if (fs.existsSync(sock)) {
            this.env.DOCKER_HOST = `unix://${sock}`;
            break;
          }
        }
      }

      if (!cfg.credsStore) return;
      const helperBin = `docker-credential-${cfg.credsStore}`;
      try {
        execSync(`command -v ${helperBin}`, { env: this.env, stdio: 'pipe', timeout: 3000 });
        return;
      } catch {
        console.log(`[DockerManager] Credential helper "${helperBin}" not found, using anonymous pulls`);
        const tmpDir = path.join(os.tmpdir(), 'opencern-docker-config');
        fs.mkdirSync(tmpDir, { recursive: true });
        const cleanCfg = { ...cfg };
        delete cleanCfg.credsStore;
        delete cleanCfg.credHelpers;
        delete cleanCfg.currentContext;
        fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(cleanCfg, null, 2));
        this.env.DOCKER_CONFIG = tmpDir;
      }
    } catch (e) {
      console.warn('[DockerManager] Config patch warning:', e.message);
    }
  }

  _ensureDatasetDir() {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
    fs.mkdirSync(path.join(DATASET_DIR, 'processed'), { recursive: true });
  }

  // ── Low-level helpers ──

  _exec(cmd, timeout = 30000) {
    return new Promise((resolve, reject) => {
      exec(cmd, { env: this.env, timeout }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
      });
    });
  }

  _spawn(args) {
    return new Promise((resolve, reject) => {
      const p = spawn('docker', args, { env: this.env });
      let out = '', errOut = '';
      p.stdout.on('data', d => { out += d; });
      p.stderr.on('data', d => { errOut += d; });
      p.on('close', code => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(errOut.trim() || `exit code ${code}`));
      });
    });
  }

  _spawnStream(args, onData) {
    return new Promise((resolve, reject) => {
      const p = spawn('docker', args, { env: this.env });
      const handle = (data) => {
        const text = data.toString().trim();
        if (text) {
          const lines = text.split('\n');
          const last = lines[lines.length - 1].replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
          if (last) onData(last);
        }
      };
      p.stdout.on('data', handle);
      p.stderr.on('data', handle);
      p.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`docker ${args.join(' ')} failed (code ${code})`));
      });
    });
  }

  // ── Image management ──

  async areImagesPresent() {
    for (const c of CONTAINERS) {
      try {
        await this._exec(`docker image inspect ${c.image}`);
      } catch {
        return false;
      }
    }
    return true;
  }

  async pullImages(onProgress) {
    const total = CONTAINERS.length;
    for (let i = 0; i < total; i++) {
      const c = CONTAINERS[i];
      const label = c.name.replace('opencern-', '');
      onProgress(`[${i + 1}/${total}] Pulling ${label}...`);
      await this._spawnStream(['pull', c.image], (line) => {
        onProgress(`[${i + 1}/${total}] ${label}: ${line}`);
      });
      onProgress(`[${i + 1}/${total}] ${label}: ✓ Done`);
    }
  }

  async getLocalDigest(image) {
    try {
      const out = await this._exec(`docker image inspect ${image} --format={{index .RepoDigests 0}}`);
      const parts = out.replace(/['"]/g, '').split('@');
      return parts.length > 1 ? parts[1] : null;
    } catch {
      return null;
    }
  }

  getRemoteDigest(image) {
    return new Promise((resolve) => {
      const repoPath = image.replace('ghcr.io/', '').split(':')[0];
      const tokenUrl = `https://ghcr.io/token?scope=repository:${repoPath}:pull`;
      https.get(tokenUrl, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const token = JSON.parse(body).token;
            const manifestUrl = `https://ghcr.io/v2/${repoPath}/manifests/latest`;
            https.get(manifestUrl, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json'
              }
            }, (mRes) => {
              resolve(mRes.headers['docker-content-digest'] || null);
            }).on('error', () => resolve(null));
          } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });
  }

  async checkForUpdates() {
    const core = CONTAINERS[0].image;
    const [local, remote] = await Promise.all([
      this.getLocalDigest(core),
      Promise.race([this.getRemoteDigest(core), new Promise(r => setTimeout(() => r(null), 5000))])
    ]);
    if (!local || !remote) return false;
    return local !== remote;
  }

  // ── Container lifecycle ──

  async ensureNetwork() {
    try {
      await this._exec(`docker network inspect ${NETWORK}`);
    } catch {
      console.log(`[DockerManager] Creating network ${NETWORK}`);
      await this._exec(`docker network create ${NETWORK}`);
    }
  }

  async stopAndRemove(containerName) {
    try { await this._exec(`docker stop ${containerName}`, 15000); } catch {}
    try { await this._exec(`docker rm -f ${containerName}`, 10000); } catch {}
  }

  async startContainer(def) {
    await this.stopAndRemove(def.name);

    const args = ['run', '-d', '--name', def.name, '--network', NETWORK, '--restart', 'unless-stopped'];

    for (const [host, hostPort, containerPort] of def.ports) {
      args.push('-p', `${host}:${hostPort}:${containerPort}`);
    }

    for (const vol of def.volumes()) {
      if (vol.length === 3) args.push('-v', `${vol[0]}:${vol[1]}:${vol[2]}`);
      else args.push('-v', `${vol[0]}:${vol[1]}`);
    }

    args.push(def.image);
    console.log(`[DockerManager] Starting ${def.name}`);
    await this._spawn(args);
  }

  async startAll(onProgress) {
    await this.ensureNetwork();
    for (let i = 0; i < CONTAINERS.length; i++) {
      const c = CONTAINERS[i];
      const label = c.name.replace('opencern-', '');
      if (onProgress) onProgress(`Starting ${label}...`);
      await this.startContainer(c);
    }
  }

  async stopAll() {
    for (const c of CONTAINERS) {
      await this.stopAndRemove(c.name);
    }
    try { await this._exec(`docker network rm ${NETWORK}`, 10000); } catch {}
  }

  async restartAll() {
    for (const c of CONTAINERS) {
      try { await this._exec(`docker restart ${c.name}`, 30000); } catch {}
    }
  }

  async getContainerStatus() {
    const results = {};
    for (const c of CONTAINERS) {
      try {
        const state = await this._exec(`docker inspect --format={{.State.Status}} ${c.name}`);
        results[c.name] = state.replace(/['"]/g, '');
      } catch {
        results[c.name] = 'not_found';
      }
    }
    return results;
  }

  async getLogs(service, lines = 100) {
    const name = service.startsWith('opencern-') ? service : `opencern-${service}`;
    try {
      return await this._exec(`docker logs --tail=${lines} ${name}`, 10000);
    } catch (e) {
      return `Error: ${e.message}`;
    }
  }
}

DockerManager.CONTAINERS = CONTAINERS;
module.exports = DockerManager;
