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
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const containers = __importStar(require("./containers"));
const setup = __importStar(require("./setup"));
const custom = __importStar(require("./custom"));
const config = __importStar(require("./config"));
const updater = __importStar(require("./updater"));
function registerIpcHandlers() {
    // Window controls
    electron_1.ipcMain.handle("window:minimize", () => {
        electron_1.BrowserWindow.getFocusedWindow()?.minimize();
    });
    electron_1.ipcMain.handle("window:close", () => {
        electron_1.BrowserWindow.getFocusedWindow()?.close();
    });
    // Setup
    electron_1.ipcMain.handle("check_docker", (_, args) => setup.checkDocker(args.dockerSocket));
    electron_1.ipcMain.handle("get_docker_install_url", () => setup.getDockerInstallUrl());
    electron_1.ipcMain.handle("get_setup_status", () => setup.getSetupStatus());
    electron_1.ipcMain.handle("complete_setup", () => setup.completeSetup());
    electron_1.ipcMain.handle("get_setup_images", (_, args) => setup.getSetupImages(args.dataDir));
    // Settings
    electron_1.ipcMain.handle("get_settings", () => config.loadConfig());
    electron_1.ipcMain.handle("save_settings", (_, args) => config.saveConfig(args.settings));
    // Containers
    electron_1.ipcMain.handle("list_containers", (_, args) => containers.listContainers(args.dockerSocket, args.dataDir, args.customContainers));
    electron_1.ipcMain.handle("start_container", (_, args) => containers.startContainer(args.name, args.dockerSocket, args.dataDir));
    electron_1.ipcMain.handle("stop_container", (_, args) => containers.stopContainer(args.name, args.dockerSocket));
    electron_1.ipcMain.handle("restart_container", (_, args) => containers.restartContainer(args.name, args.dockerSocket, args.dataDir));
    electron_1.ipcMain.handle("start_all", (_, args) => containers.startAll(args.dockerSocket, args.dataDir));
    electron_1.ipcMain.handle("stop_all", (_, args) => containers.stopAll(args.dockerSocket, args.dataDir));
    electron_1.ipcMain.handle("get_container_logs", (_, args) => containers.getContainerLogs(args.name, args.dockerSocket, args.lines));
    electron_1.ipcMain.handle("get_container_stats", (_, args) => containers.getContainerStats(args.name, args.dockerSocket));
    electron_1.ipcMain.handle("pull_images", (event, args) => containers.pullImages(event.sender, args.dockerSocket, args.imageNames));
    electron_1.ipcMain.handle("check_image_updates", (_, args) => containers.checkImageUpdates(args.dockerSocket, args.dataDir));
    electron_1.ipcMain.handle("open_webapp", () => electron_1.shell.openExternal("http://localhost:3000"));
    electron_1.ipcMain.handle("start_custom_container", (_, args) => containers.startCustomContainer(args.config, args.dockerSocket));
    // Custom containers
    electron_1.ipcMain.handle("add_custom_container", (_, args) => custom.addCustomContainer(args.container));
    electron_1.ipcMain.handle("remove_custom_container", (_, args) => custom.removeCustomContainer(args.name));
    electron_1.ipcMain.handle("list_custom_containers", () => custom.listCustomContainers());
    electron_1.ipcMain.handle("update_custom_container", (_, args) => custom.updateCustomContainer(args.container));
    // Updater
    electron_1.ipcMain.handle("check_for_updates", (_, args) => updater.checkForUpdates(args.dockerSocket, args.dataDir));
}
//# sourceMappingURL=ipc.js.map