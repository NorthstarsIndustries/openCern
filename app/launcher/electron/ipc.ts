import { ipcMain, shell, BrowserWindow } from "electron";
import * as containers from "./containers";
import * as setup from "./setup";
import * as custom from "./custom";
import * as config from "./config";
import * as updater from "./updater";

export function registerIpcHandlers(): void {
  // Window controls
  ipcMain.handle("window:minimize", () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });
  ipcMain.handle("window:close", () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  // Setup
  ipcMain.handle("check_docker", (_, args) =>
    setup.checkDocker(args.dockerSocket),
  );
  ipcMain.handle("get_docker_install_url", () => setup.getDockerInstallUrl());
  ipcMain.handle("get_setup_status", () => setup.getSetupStatus());
  ipcMain.handle("complete_setup", () => setup.completeSetup());
  ipcMain.handle("get_setup_images", (_, args) =>
    setup.getSetupImages(args.dataDir),
  );

  // Settings
  ipcMain.handle("get_settings", () => config.loadConfig());
  ipcMain.handle("save_settings", (_, args) => config.saveConfig(args.settings));

  // Containers
  ipcMain.handle("list_containers", (_, args) =>
    containers.listContainers(
      args.dockerSocket,
      args.dataDir,
      args.customContainers,
    ),
  );
  ipcMain.handle("start_container", (_, args) =>
    containers.startContainer(args.name, args.dockerSocket, args.dataDir),
  );
  ipcMain.handle("stop_container", (_, args) =>
    containers.stopContainer(args.name, args.dockerSocket),
  );
  ipcMain.handle("restart_container", (_, args) =>
    containers.restartContainer(
      args.name,
      args.dockerSocket,
      args.dataDir,
    ),
  );
  ipcMain.handle("start_all", (_, args) =>
    containers.startAll(args.dockerSocket, args.dataDir),
  );
  ipcMain.handle("stop_all", (_, args) =>
    containers.stopAll(args.dockerSocket, args.dataDir),
  );
  ipcMain.handle("get_container_logs", (_, args) =>
    containers.getContainerLogs(args.name, args.dockerSocket, args.lines),
  );
  ipcMain.handle("get_container_stats", (_, args) =>
    containers.getContainerStats(args.name, args.dockerSocket),
  );
  ipcMain.handle("pull_images", (event, args) =>
    containers.pullImages(event.sender, args.dockerSocket, args.imageNames),
  );
  ipcMain.handle("check_image_updates", (_, args) =>
    containers.checkImageUpdates(args.dockerSocket, args.dataDir),
  );
  ipcMain.handle("open_webapp", () =>
    shell.openExternal("http://localhost:3000"),
  );
  ipcMain.handle("start_custom_container", (_, args) =>
    containers.startCustomContainer(args.config, args.dockerSocket),
  );

  // Custom containers
  ipcMain.handle("add_custom_container", (_, args) =>
    custom.addCustomContainer(args.container),
  );
  ipcMain.handle("remove_custom_container", (_, args) =>
    custom.removeCustomContainer(args.name),
  );
  ipcMain.handle("list_custom_containers", () =>
    custom.listCustomContainers(),
  );
  ipcMain.handle("update_custom_container", (_, args) =>
    custom.updateCustomContainer(args.container),
  );

  // Updater
  ipcMain.handle("check_for_updates", (_, args) =>
    updater.checkForUpdates(args.dockerSocket, args.dataDir),
  );
}
