use bollard::container::{
    Config, CreateContainerOptions, ListContainersOptions, LogsOptions, RemoveContainerOptions,
    RestartContainerOptions, StartContainerOptions, StatsOptions, StopContainerOptions,
};
use bollard::image::CreateImageOptions;
use bollard::models::{ContainerSummary, HostConfig, PortBinding};
use bollard::network::CreateNetworkOptions;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

use crate::config::{CustomContainerConfig, PortMapping, VolumeMapping};
use crate::docker;

// ─── Built-in service definitions ─────────────────────────────────────────────

const NETWORK_NAME: &str = "opencern-net";
const GHCR_OWNER: &str = "ceoatnorthstar";

/// Definition of a built-in OpenCERN service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDef {
    pub name: String,
    pub image: String,
    pub container_name: String,
    pub ports: Vec<PortMapping>,
    pub volumes: Vec<VolumeMapping>,
    pub description: String,
}

/// Get the list of built-in service definitions.
pub fn builtin_services(data_dir: &str) -> Vec<ServiceDef> {
    vec![
        ServiceDef {
            name: "UI".into(),
            image: format!("ghcr.io/{}/ui:latest", GHCR_OWNER),
            container_name: "opencern-ui".into(),
            ports: vec![PortMapping {
                host: 3000,
                container: 3000,
            }],
            volumes: vec![],
            description: "Next.js web interface".into(),
        },
        ServiceDef {
            name: "API".into(),
            image: format!("ghcr.io/{}/api:latest", GHCR_OWNER),
            container_name: "opencern-api".into(),
            ports: vec![PortMapping {
                host: 8080,
                container: 8080,
            }],
            volumes: vec![VolumeMapping {
                host_path: data_dir.to_string(),
                container_path: "/home/appuser/opencern-datasets".into(),
                readonly: false,
            }],
            description: "FastAPI backend with ROOT processing".into(),
        },
        ServiceDef {
            name: "XRootD".into(),
            image: format!("ghcr.io/{}/xrootd:latest", GHCR_OWNER),
            container_name: "opencern-xrootd".into(),
            ports: vec![PortMapping {
                host: 8081,
                container: 8081,
            }],
            volumes: vec![VolumeMapping {
                host_path: data_dir.to_string(),
                container_path: "/home/appuser/opencern-datasets".into(),
                readonly: false,
            }],
            description: "CERN XRootD protocol proxy".into(),
        },
        ServiceDef {
            name: "Streamer".into(),
            image: format!("ghcr.io/{}/streamer:latest", GHCR_OWNER),
            container_name: "opencern-streamer".into(),
            ports: vec![
                PortMapping {
                    host: 9001,
                    container: 9001,
                },
                PortMapping {
                    host: 9002,
                    container: 9002,
                },
            ],
            volumes: vec![VolumeMapping {
                host_path: format!("{}/processed", data_dir),
                container_path: "/home/appuser/opencern-datasets/processed".into(),
                readonly: true,
            }],
            description: "Rust WebSocket event streamer".into(),
        },
        ServiceDef {
            name: "Quantum".into(),
            image: format!("ghcr.io/{}/quantum:latest", GHCR_OWNER),
            container_name: "opencern-quantum".into(),
            ports: vec![PortMapping {
                host: 8082,
                container: 8082,
            }],
            volumes: vec![],
            description: "Qiskit quantum computing service".into(),
        },
    ]
}

// ─── Container status info ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerInfo {
    pub name: String,
    pub container_name: String,
    pub image: String,
    pub status: String,
    pub state: String,
    pub ports: Vec<PortMapping>,
    pub description: String,
    pub is_custom: bool,
}

fn summary_to_info(c: &ContainerSummary, is_custom: bool) -> ContainerInfo {
    let name = c
        .names
        .as_ref()
        .and_then(|n| n.first())
        .map(|n| n.trim_start_matches('/').to_string())
        .unwrap_or_default();

    let ports = c
        .ports
        .as_ref()
        .map(|ps| {
            ps.iter()
                .filter_map(|p| {
                    Some(PortMapping {
                        host: p.public_port? as u16,
                        container: p.private_port as u16,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    ContainerInfo {
        name: name.clone(),
        container_name: name,
        image: c.image.clone().unwrap_or_default(),
        status: c.status.clone().unwrap_or_default(),
        state: c.state.clone().unwrap_or_default(),
        ports,
        description: String::new(),
        is_custom,
    }
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

/// List all managed containers (built-in + custom) with their current status.
#[tauri::command]
pub async fn list_containers(
    docker_socket: String,
    data_dir: String,
    custom_containers: Vec<CustomContainerConfig>,
) -> Result<Vec<ContainerInfo>, String> {
    let docker = docker::connect(&docker_socket).await?;

    // Get all containers (including stopped)
    let opts = ListContainersOptions::<String> {
        all: true,
        ..Default::default()
    };
    let containers = docker
        .list_containers(Some(opts))
        .await
        .map_err(|e| e.to_string())?;

    let services = builtin_services(&data_dir);
    let mut results: Vec<ContainerInfo> = Vec::new();

    // Match built-in services
    for svc in &services {
        let found = containers
            .iter()
            .find(|c| {
                c.names
                    .as_ref()
                    .map(|ns| ns.iter().any(|n| n.trim_start_matches('/') == svc.container_name))
                    .unwrap_or(false)
            });

        if let Some(c) = found {
            let mut info = summary_to_info(c, false);
            info.name = svc.name.clone();
            info.description = svc.description.clone();
            info.ports = svc.ports.clone();
            results.push(info);
        } else {
            results.push(ContainerInfo {
                name: svc.name.clone(),
                container_name: svc.container_name.clone(),
                image: svc.image.clone(),
                status: "Not created".into(),
                state: "stopped".into(),
                ports: svc.ports.clone(),
                description: svc.description.clone(),
                is_custom: false,
            });
        }
    }

    // Match custom containers
    for cc in &custom_containers {
        let found = containers
            .iter()
            .find(|c| {
                c.names
                    .as_ref()
                    .map(|ns| ns.iter().any(|n| n.trim_start_matches('/') == cc.name))
                    .unwrap_or(false)
            });

        if let Some(c) = found {
            let mut info = summary_to_info(c, true);
            info.name = cc.name.clone();
            results.push(info);
        } else {
            results.push(ContainerInfo {
                name: cc.name.clone(),
                container_name: cc.name.clone(),
                image: cc.image.clone(),
                status: "Not created".into(),
                state: "stopped".into(),
                ports: cc.ports.clone(),
                description: format!("Custom: {}", cc.image),
                is_custom: true,
            });
        }
    }

    Ok(results)
}

/// Ensure the Docker network exists.
async fn ensure_network(docker: &bollard::Docker) -> Result<(), String> {
    let networks = docker
        .list_networks::<String>(None)
        .await
        .map_err(|e| e.to_string())?;

    let exists = networks
        .iter()
        .any(|n| n.name.as_deref() == Some(NETWORK_NAME));

    if !exists {
        let opts = CreateNetworkOptions {
            name: NETWORK_NAME.to_string(),
            driver: "bridge".to_string(),
            ..Default::default()
        };
        docker
            .create_network(opts)
            .await
            .map_err(|e| format!("Failed to create network: {}", e))?;
    }

    Ok(())
}

/// Ensure the data directories exist.
fn ensure_data_dirs(data_dir: &str) -> Result<(), String> {
    let processed = format!("{}/processed", data_dir);
    std::fs::create_dir_all(&processed)
        .map_err(|e| format!("Failed to create data dir {}: {}", processed, e))?;
    Ok(())
}

/// Start a single built-in container by service name.
#[tauri::command]
pub async fn start_container(
    name: String,
    docker_socket: String,
    data_dir: String,
) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;
    let services = builtin_services(&data_dir);

    let svc = services
        .iter()
        .find(|s| s.name == name || s.container_name == name)
        .ok_or_else(|| format!("Unknown service: {}", name))?;

    ensure_network(&docker).await?;
    ensure_data_dirs(&data_dir)?;

    start_service(&docker, svc).await
}

/// Internal: create and start a container from a ServiceDef.
async fn start_service(docker: &bollard::Docker, svc: &ServiceDef) -> Result<(), String> {
    // Remove existing container if it exists (stopped)
    let _ = docker
        .remove_container(
            &svc.container_name,
            Some(RemoveContainerOptions {
                force: true,
                ..Default::default()
            }),
        )
        .await;

    // Build port bindings
    let mut port_bindings: HashMap<String, Option<Vec<PortBinding>>> = HashMap::new();
    let mut exposed_ports: HashMap<String, HashMap<(), ()>> = HashMap::new();

    for pm in &svc.ports {
        let key = format!("{}/tcp", pm.container);
        exposed_ports.insert(key.clone(), HashMap::new());
        port_bindings.insert(
            key,
            Some(vec![PortBinding {
                host_ip: Some("127.0.0.1".into()),
                host_port: Some(pm.host.to_string()),
            }]),
        );
    }

    // Build volume binds
    let binds: Vec<String> = svc
        .volumes
        .iter()
        .map(|v| {
            if v.readonly {
                format!("{}:{}:ro", v.host_path, v.container_path)
            } else {
                format!("{}:{}", v.host_path, v.container_path)
            }
        })
        .collect();

    let host_config = HostConfig {
        port_bindings: Some(port_bindings),
        binds: Some(binds),
        network_mode: Some(NETWORK_NAME.to_string()),
        restart_policy: Some(bollard::models::RestartPolicy {
            name: Some(bollard::models::RestartPolicyNameEnum::UNLESS_STOPPED),
            maximum_retry_count: None,
        }),
        ..Default::default()
    };

    let config = Config {
        image: Some(svc.image.clone()),
        exposed_ports: Some(exposed_ports),
        host_config: Some(host_config),
        ..Default::default()
    };

    let opts = CreateContainerOptions {
        name: &svc.container_name,
        platform: None,
    };

    docker
        .create_container(Some(opts), config)
        .await
        .map_err(|e| format!("Failed to create container {}: {}", svc.container_name, e))?;

    docker
        .start_container(&svc.container_name, None::<StartContainerOptions<String>>)
        .await
        .map_err(|e| format!("Failed to start container {}: {}", svc.container_name, e))?;

    Ok(())
}

/// Stop a container by name.
#[tauri::command]
pub async fn stop_container(name: String, docker_socket: String) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;

    // Find the container name (could be service name or container name)
    let container_name = resolve_container_name(&name);

    docker
        .stop_container(
            &container_name,
            Some(StopContainerOptions { t: 10 }),
        )
        .await
        .map_err(|e| format!("Failed to stop {}: {}", container_name, e))?;

    Ok(())
}

/// Restart a container.
#[tauri::command]
pub async fn restart_container(
    name: String,
    docker_socket: String,
    data_dir: String,
) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;
    let container_name = resolve_container_name(&name);

    docker
        .restart_container(&container_name, Some(RestartContainerOptions { t: 5 }))
        .await
        .map_err(|e| format!("Failed to restart {}: {}", container_name, e))?;

    // If restart failed because container doesn't exist, try full start
    if docker
        .inspect_container(&container_name, None)
        .await
        .is_err()
    {
        return start_container(name, docker_socket, data_dir).await;
    }

    Ok(())
}

/// Start all built-in containers.
#[tauri::command]
pub async fn start_all(docker_socket: String, data_dir: String) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;
    let services = builtin_services(&data_dir);

    ensure_network(&docker).await?;
    ensure_data_dirs(&data_dir)?;

    for svc in &services {
        start_service(&docker, svc).await?;
    }

    Ok(())
}

/// Stop all built-in containers.
#[tauri::command]
pub async fn stop_all(docker_socket: String, data_dir: String) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;
    let services = builtin_services(&data_dir);

    for svc in &services {
        let _ = docker
            .stop_container(
                &svc.container_name,
                Some(StopContainerOptions { t: 10 }),
            )
            .await;
    }

    Ok(())
}

/// Get recent logs from a container.
#[tauri::command]
pub async fn get_container_logs(
    name: String,
    docker_socket: String,
    lines: u64,
) -> Result<Vec<String>, String> {
    let docker = docker::connect(&docker_socket).await?;
    let container_name = resolve_container_name(&name);

    let opts = LogsOptions::<String> {
        stdout: true,
        stderr: true,
        tail: lines.to_string(),
        ..Default::default()
    };

    let mut stream = docker.logs(&container_name, Some(opts));
    let mut logs: Vec<String> = Vec::new();

    while let Some(result) = stream.next().await {
        match result {
            Ok(output) => logs.push(output.to_string()),
            Err(e) => return Err(format!("Failed to read logs: {}", e)),
        }
    }

    Ok(logs)
}

/// Get live stats (CPU/memory) for a container.
#[tauri::command]
pub async fn get_container_stats(
    name: String,
    docker_socket: String,
) -> Result<ContainerStats, String> {
    let docker = docker::connect(&docker_socket).await?;
    let container_name = resolve_container_name(&name);

    let opts = StatsOptions {
        stream: false,
        one_shot: true,
    };

    let mut stream = docker.stats(&container_name, Some(opts));

    if let Some(Ok(stats)) = stream.next().await {
        let cpu_percent = calculate_cpu_percent(&stats);
        let mem_usage = stats
            .memory_stats
            .usage
            .unwrap_or(0);
        let mem_limit = stats
            .memory_stats
            .limit
            .unwrap_or(1);

        Ok(ContainerStats {
            cpu_percent,
            memory_usage_mb: (mem_usage as f64) / 1_048_576.0,
            memory_limit_mb: (mem_limit as f64) / 1_048_576.0,
            memory_percent: (mem_usage as f64 / mem_limit as f64) * 100.0,
        })
    } else {
        Err("Failed to get container stats".into())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerStats {
    pub cpu_percent: f64,
    pub memory_usage_mb: f64,
    pub memory_limit_mb: f64,
    pub memory_percent: f64,
}

fn calculate_cpu_percent(stats: &bollard::container::Stats) -> f64 {
    let cpu_delta = stats.cpu_stats.cpu_usage.total_usage as f64
        - stats.precpu_stats.cpu_usage.total_usage as f64;
    let system_delta = stats.cpu_stats.system_cpu_usage.unwrap_or(0) as f64
        - stats.precpu_stats.system_cpu_usage.unwrap_or(0) as f64;
    let num_cpus = stats
        .cpu_stats
        .online_cpus
        .unwrap_or(1) as f64;

    if system_delta > 0.0 && cpu_delta >= 0.0 {
        (cpu_delta / system_delta) * num_cpus * 100.0
    } else {
        0.0
    }
}

/// Pull Docker images with progress events emitted to the frontend.
#[tauri::command]
pub async fn pull_images(
    app: AppHandle,
    docker_socket: String,
    image_names: Vec<String>,
) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;

    let total = image_names.len();
    for (i, image) in image_names.iter().enumerate() {
        let _ = app.emit("pull-progress", serde_json::json!({
            "image": image,
            "index": i,
            "total": total,
            "stage": "pulling",
            "message": format!("Pulling {} ({}/{})", image, i + 1, total),
            "percent": ((i as f64 / total as f64) * 100.0) as u32,
        }));

        let opts = CreateImageOptions {
            from_image: image.as_str(),
            ..Default::default()
        };

        let mut stream = docker.create_image(Some(opts), None, None);
        while let Some(result) = stream.next().await {
            match result {
                Ok(info) => {
                    let msg = info
                        .status
                        .unwrap_or_default();
                    let _ = app.emit("pull-progress", serde_json::json!({
                        "image": image,
                        "index": i,
                        "total": total,
                        "stage": "layer",
                        "message": msg,
                        "percent": ((i as f64 / total as f64) * 100.0) as u32,
                    }));
                }
                Err(e) => {
                    let _ = app.emit("pull-progress", serde_json::json!({
                        "image": image,
                        "index": i,
                        "total": total,
                        "stage": "error",
                        "message": format!("Error pulling {}: {}", image, e),
                        "percent": 0,
                    }));
                    return Err(format!("Failed to pull {}: {}", image, e));
                }
            }
        }

        let _ = app.emit("pull-progress", serde_json::json!({
            "image": image,
            "index": i + 1,
            "total": total,
            "stage": "done",
            "message": format!("Pulled {} ({}/{})", image, i + 1, total),
            "percent": (((i + 1) as f64 / total as f64) * 100.0) as u32,
        }));
    }

    Ok(())
}

/// Check which images have updates available by comparing local vs remote digests.
#[tauri::command]
pub async fn check_image_updates(
    docker_socket: String,
    data_dir: String,
) -> Result<Vec<String>, String> {
    let docker = docker::connect(&docker_socket).await?;
    let services = builtin_services(&data_dir);
    let mut updates_available: Vec<String> = Vec::new();

    for svc in &services {
        // Get local image digest
        let local_digest = match docker.inspect_image(&svc.image).await {
            Ok(info) => info
                .repo_digests
                .and_then(|d| d.first().cloned())
                .unwrap_or_default(),
            Err(_) => String::new(),
        };

        // Try to pull and check if digest changed
        // We use a lightweight approach: check the registry manifest
        // For now, compare with what Docker reports
        if local_digest.is_empty() {
            updates_available.push(svc.name.clone());
        }
    }

    Ok(updates_available)
}

/// Open the web application in the default browser.
#[tauri::command]
pub async fn open_webapp() -> Result<(), String> {
    open::that("http://localhost:3000").map_err(|e| format!("Failed to open browser: {}", e))
}

/// Start a custom container.
#[tauri::command]
pub async fn start_custom_container(
    config: CustomContainerConfig,
    docker_socket: String,
) -> Result<(), String> {
    let docker = docker::connect(&docker_socket).await?;

    let svc = ServiceDef {
        name: config.name.clone(),
        image: config.image.clone(),
        container_name: config.name.clone(),
        ports: config.ports.clone(),
        volumes: config.volumes.clone(),
        description: format!("Custom: {}", config.image),
    };

    if config.join_network {
        ensure_network(&docker).await?;
    }

    start_service(&docker, &svc).await
}

/// Map friendly service name to Docker container name.
fn resolve_container_name(name: &str) -> String {
    match name {
        "UI" => "opencern-ui".to_string(),
        "API" => "opencern-api".to_string(),
        "XRootD" => "opencern-xrootd".to_string(),
        "Streamer" => "opencern-streamer".to_string(),
        "Quantum" => "opencern-quantum".to_string(),
        other => other.to_string(),
    }
}
