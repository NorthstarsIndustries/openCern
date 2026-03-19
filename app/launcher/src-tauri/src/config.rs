use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Persistent launcher configuration stored as JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherConfig {
    /// Whether first-time setup has been completed.
    pub setup_complete: bool,
    /// Docker socket path override (empty = auto-detect).
    pub docker_socket: String,
    /// Update check interval in seconds (default 360 = 6 minutes).
    pub update_interval_secs: u64,
    /// Launch containers on app startup.
    pub auto_start: bool,
    /// Data directory for datasets.
    pub data_dir: String,
    /// User-defined custom containers.
    pub custom_containers: Vec<CustomContainerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomContainerConfig {
    pub id: String,
    pub name: String,
    pub image: String,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub env_vars: Vec<EnvVar>,
    pub join_network: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortMapping {
    pub host: u16,
    pub container: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeMapping {
    pub host_path: String,
    pub container_path: String,
    pub readonly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

impl Default for LauncherConfig {
    fn default() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
        Self {
            setup_complete: false,
            docker_socket: String::new(),
            update_interval_secs: 360,
            auto_start: true,
            data_dir: home
                .join("opencern-datasets")
                .to_string_lossy()
                .to_string(),
            custom_containers: Vec::new(),
        }
    }
}

/// Returns the path to the config file.
fn config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("opencern");
    config_dir.join("launcher.json")
}

/// Load config from disk, returning defaults if the file doesn't exist.
pub fn load_config() -> LauncherConfig {
    let path = config_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
            Err(_) => LauncherConfig::default(),
        }
    } else {
        LauncherConfig::default()
    }
}

/// Save config to disk, creating parent directories if needed.
pub fn save_config(config: &LauncherConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {}", e))?;
    }
    let json =
        serde_json::to_string_pretty(config).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Failed to write config: {}", e))?;
    Ok(())
}
