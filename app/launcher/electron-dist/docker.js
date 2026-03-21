"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connect = connect;
exports.isDockerInstalled = isDockerInstalled;
exports.isDaemonRunning = isDaemonRunning;
const dockerode_1 = __importDefault(require("dockerode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/**
 * Auto-detect the Docker socket path and return a connected client.
 * Checks, in order: user-configured path, default unix socket, Colima,
 * Rancher Desktop, Podman, and finally the Windows named pipe.
 */
async function connect(customSocket) {
    if (customSocket) {
        const docker = new dockerode_1.default({ socketPath: customSocket });
        await docker.ping();
        return docker;
    }
    const home = os.homedir();
    const candidates = [
        "/var/run/docker.sock",
        path.join(home, ".colima/default/docker.sock"),
        path.join(home, ".rd/docker.sock"),
    ];
    // Add Podman socket on Linux
    if (process.platform === "linux") {
        try {
            const uid = process.getuid?.() ?? 1000;
            candidates.push(`/run/user/${uid}/podman/podman.sock`);
        }
        catch { }
    }
    for (const socketPath of candidates) {
        if (fs.existsSync(socketPath)) {
            try {
                const docker = new dockerode_1.default({ socketPath });
                await docker.ping();
                return docker;
            }
            catch {
                continue;
            }
        }
    }
    // Windows: try named pipe
    if (process.platform === "win32") {
        try {
            const docker = new dockerode_1.default({ socketPath: "//./pipe/docker_engine" });
            await docker.ping();
            return docker;
        }
        catch { }
    }
    // Last resort: default connection
    const docker = new dockerode_1.default();
    await docker.ping();
    return docker;
}
/** Check if the Docker CLI binary is installed (available in PATH). */
function isDockerInstalled() {
    try {
        (0, child_process_1.execSync)("docker --version", { stdio: "ignore" });
        return true;
    }
    catch {
        return false;
    }
}
/** Check if the Docker daemon is running and responsive. */
async function isDaemonRunning(customSocket) {
    try {
        await connect(customSocket);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=docker.js.map