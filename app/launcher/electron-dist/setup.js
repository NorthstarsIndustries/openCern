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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDocker = checkDocker;
exports.getDockerInstallUrl = getDockerInstallUrl;
exports.getSetupStatus = getSetupStatus;
exports.completeSetup = completeSetup;
exports.getSetupImages = getSetupImages;
const docker = __importStar(require("./docker"));
const config_1 = require("./config");
const containers_1 = require("./containers");
/** Check whether Docker is installed and running. */
async function checkDocker(dockerSocket) {
    const installed = docker.isDockerInstalled();
    const running = installed ? await docker.isDaemonRunning(dockerSocket) : false;
    return { installed, running };
}
/** Get the Docker Desktop download URL for the current platform. */
function getDockerInstallUrl() {
    switch (process.platform) {
        case "darwin":
            return "https://desktop.docker.com/mac/main/arm64/Docker.dmg";
        case "win32":
            return "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe";
        default:
            return "https://docs.docker.com/engine/install/";
    }
}
/** Check if first-time setup has been completed. */
function getSetupStatus() {
    const config = (0, config_1.loadConfig)();
    return {
        complete: config.setup_complete,
        docker: {
            installed: docker.isDockerInstalled(),
            running: false,
        },
    };
}
/** Mark first-time setup as complete. */
function completeSetup() {
    const config = (0, config_1.loadConfig)();
    config.setup_complete = true;
    (0, config_1.saveConfig)(config);
}
/** Get the list of images that need to be pulled for first-time setup. */
function getSetupImages(dataDir) {
    return (0, containers_1.builtinServices)(dataDir).map((s) => s.image);
}
//# sourceMappingURL=setup.js.map