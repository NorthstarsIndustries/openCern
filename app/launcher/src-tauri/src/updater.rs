use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::config::load_config;
use crate::containers;
use crate::docker;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub image_updates: Vec<String>,
    pub launcher_update: Option<LauncherUpdate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherUpdate {
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
}

/// Spawn a background task that periodically checks for updates.
/// Emits `update-available` events to the frontend when updates are found.
pub fn spawn_update_checker(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Wait a bit before the first check to let the app finish loading.
        tokio::time::sleep(Duration::from_secs(30)).await;

        loop {
            let config = load_config();
            let interval = config.update_interval_secs;

            // Check Docker image updates
            let image_updates = check_docker_image_updates(&config.docker_socket, &config.data_dir).await;

            // Check launcher self-update
            let launcher_update = check_launcher_version().await;

            if !image_updates.is_empty() || launcher_update.is_some() {
                let status = UpdateStatus {
                    image_updates: image_updates.clone(),
                    launcher_update: launcher_update.clone(),
                };

                let _ = app.emit("update-available", &status);
            }

            tokio::time::sleep(Duration::from_secs(interval)).await;
        }
    });
}

/// Check if any Docker images have newer versions available.
async fn check_docker_image_updates(docker_socket: &str, data_dir: &str) -> Vec<String> {
    match docker::connect(docker_socket).await {
        Ok(docker) => {
            let services = containers::builtin_services(data_dir);
            let mut outdated = Vec::new();

            for svc in &services {
                // Check if the image exists locally
                match docker.inspect_image(&svc.image).await {
                    Ok(local) => {
                        let local_digest = local
                            .repo_digests
                            .as_ref()
                            .and_then(|d| d.first())
                            .cloned()
                            .unwrap_or_default();

                        // Query the registry for the latest digest.
                        // We compare the local digest against what GHCR reports.
                        if let Some(remote_digest) =
                            fetch_remote_digest(&svc.image).await
                        {
                            if !local_digest.is_empty()
                                && !remote_digest.is_empty()
                                && local_digest != remote_digest
                            {
                                outdated.push(svc.name.clone());
                            }
                        }
                    }
                    Err(_) => {
                        // Image doesn't exist locally at all
                        outdated.push(svc.name.clone());
                    }
                }
            }

            outdated
        }
        Err(_) => Vec::new(),
    }
}

/// Fetch the remote digest from GHCR for an image.
async fn fetch_remote_digest(image: &str) -> Option<String> {
    // Parse image into registry/repo:tag
    // e.g. ghcr.io/ceoatnorthstar/api:latest
    let parts: Vec<&str> = image.splitn(2, '/').collect();
    if parts.len() < 2 {
        return None;
    }

    let repo_tag: Vec<&str> = parts[1].splitn(2, ':').collect();
    let repo = repo_tag.first()?;
    let tag = repo_tag.get(1).unwrap_or(&"latest");

    let url = format!(
        "https://ghcr.io/v2/{}/manifests/{}",
        repo, tag
    );

    let client = reqwest::Client::new();
    let resp = client
        .head(&url)
        .header(
            "Accept",
            "application/vnd.docker.distribution.manifest.v2+json",
        )
        .send()
        .await
        .ok()?;

    resp.headers()
        .get("docker-content-digest")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
}

/// Check GitHub Releases for a newer launcher version.
async fn check_launcher_version() -> Option<LauncherUpdate> {
    let current = env!("CARGO_PKG_VERSION");

    let client = reqwest::Client::builder()
        .user_agent("opencern-launcher")
        .build()
        .ok()?;

    let resp = client
        .get("https://api.github.com/repos/NorthstarsIndustries/openCern/releases/latest")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let release: serde_json::Value = resp.json().await.ok()?;
    let tag = release["tag_name"].as_str()?;
    let latest = tag.trim_start_matches('v');

    let current_ver = semver::Version::parse(current).ok()?;
    let latest_ver = semver::Version::parse(latest).ok()?;

    if latest_ver > current_ver {
        Some(LauncherUpdate {
            current_version: current.to_string(),
            latest_version: latest.to_string(),
            download_url: release["html_url"]
                .as_str()
                .unwrap_or("")
                .to_string(),
        })
    } else {
        None
    }
}

/// Manually trigger an update check (called from frontend).
#[tauri::command]
pub async fn check_for_updates(
    docker_socket: String,
    data_dir: String,
) -> Result<UpdateStatus, String> {
    let image_updates = check_docker_image_updates(&docker_socket, &data_dir).await;
    let launcher_update = check_launcher_version().await;

    Ok(UpdateStatus {
        image_updates,
        launcher_update,
    })
}
