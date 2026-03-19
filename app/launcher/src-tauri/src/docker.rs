use bollard::Docker;
use std::path::Path;

/// Auto-detect the Docker socket path and return a connected client.
/// Checks, in order: user-configured path, default unix socket, Colima,
/// Rancher Desktop, Podman, and finally the Windows named pipe.
pub async fn connect(custom_socket: &str) -> Result<Docker, String> {
    // If user specified a custom socket path, use it directly.
    if !custom_socket.is_empty() {
        return Docker::connect_with_socket(custom_socket, 10, bollard::API_DEFAULT_VERSION)
            .map_err(|e| format!("Failed to connect to Docker at {}: {}", custom_socket, e));
    }

    // Ordered list of socket paths to try.
    let candidates: Vec<String> = vec![
        // Standard Docker Desktop / Docker Engine
        "/var/run/docker.sock".to_string(),
        // Colima (macOS)
        format!(
            "{}/.colima/default/docker.sock",
            dirs::home_dir()
                .unwrap_or_default()
                .to_string_lossy()
        ),
        // Rancher Desktop (macOS/Linux)
        format!(
            "{}/.rd/docker.sock",
            dirs::home_dir()
                .unwrap_or_default()
                .to_string_lossy()
        ),
        // Podman (Linux)
        format!(
            "/run/user/{}/podman/podman.sock",
            users_uid()
        ),
    ];

    for socket in &candidates {
        if Path::new(socket).exists() {
            match Docker::connect_with_socket(socket, 10, bollard::API_DEFAULT_VERSION) {
                Ok(docker) => {
                    // Verify the connection works
                    if docker.ping().await.is_ok() {
                        return Ok(docker);
                    }
                }
                Err(_) => continue,
            }
        }
    }

    // Windows: try named pipe
    #[cfg(target_os = "windows")]
    {
        match Docker::connect_with_named_pipe(
            "npipe:////./pipe/docker_engine",
            10,
            bollard::API_DEFAULT_VERSION,
        ) {
            Ok(docker) => {
                if docker.ping().await.is_ok() {
                    return Ok(docker);
                }
            }
            Err(_) => {}
        }
    }

    // Last resort: try the default connection method
    Docker::connect_with_local_defaults()
        .map_err(|e| format!("Could not connect to Docker. Is Docker running? Error: {}", e))
}

/// Check if the Docker CLI binary is installed (available in PATH).
pub fn is_docker_installed() -> bool {
    std::process::Command::new("docker")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Check if the Docker daemon is running and responsive.
pub async fn is_daemon_running(custom_socket: &str) -> bool {
    match connect(custom_socket).await {
        Ok(docker) => docker.ping().await.is_ok(),
        Err(_) => false,
    }
}

/// Get the UID of the current user (for Podman socket path).
fn users_uid() -> u32 {
    #[cfg(unix)]
    {
        unsafe { libc::getuid() }
    }
    #[cfg(not(unix))]
    {
        1000
    }
}
