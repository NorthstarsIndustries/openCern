use serde::{Deserialize, Serialize};

use crate::config::{load_config, save_config};
use crate::containers::builtin_services;
use crate::docker;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DockerStatus {
    pub installed: bool,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupStatus {
    pub complete: bool,
    pub docker: DockerStatus,
}

/// Check whether Docker is installed and running.
#[tauri::command]
pub async fn check_docker(docker_socket: String) -> Result<DockerStatus, String> {
    let installed = docker::is_docker_installed();
    let running = if installed {
        docker::is_daemon_running(&docker_socket).await
    } else {
        false
    };

    Ok(DockerStatus { installed, running })
}

/// Get the Docker Desktop download URL for the current platform.
#[tauri::command]
pub fn get_docker_install_url() -> String {
    #[cfg(target_os = "macos")]
    {
        "https://desktop.docker.com/mac/main/arm64/Docker.dmg".to_string()
    }
    #[cfg(target_os = "windows")]
    {
        "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "https://docs.docker.com/engine/install/".to_string()
    }
}

/// Check if first-time setup has been completed.
#[tauri::command]
pub fn get_setup_status() -> Result<SetupStatus, String> {
    let config = load_config();
    Ok(SetupStatus {
        complete: config.setup_complete,
        docker: DockerStatus {
            installed: docker::is_docker_installed(),
            running: false, // Will be checked async separately
        },
    })
}

/// Mark first-time setup as complete.
#[tauri::command]
pub fn complete_setup() -> Result<(), String> {
    let mut config = load_config();
    config.setup_complete = true;
    save_config(&config)
}

/// Get the list of images that need to be pulled for first-time setup.
#[tauri::command]
pub fn get_setup_images(data_dir: String) -> Vec<String> {
    builtin_services(&data_dir)
        .iter()
        .map(|s| s.image.clone())
        .collect()
}

/// Get settings from config.
#[tauri::command]
pub fn get_settings() -> Result<crate::config::LauncherConfig, String> {
    Ok(load_config())
}

/// Save settings to config.
#[tauri::command]
pub fn save_settings(settings: crate::config::LauncherConfig) -> Result<(), String> {
    save_config(&settings)
}
