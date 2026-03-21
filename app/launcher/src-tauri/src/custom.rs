use crate::config::{load_config, save_config, CustomContainerConfig};

/// Add a new custom container to the config.
#[tauri::command]
pub fn add_custom_container(container: CustomContainerConfig) -> Result<(), String> {
    let mut config = load_config();

    // Check for duplicate name
    if config
        .custom_containers
        .iter()
        .any(|c| c.name == container.name)
    {
        return Err(format!(
            "A container named '{}' already exists",
            container.name
        ));
    }

    config.custom_containers.push(container);
    save_config(&config)
}

/// Remove a custom container from the config by name.
#[tauri::command]
pub fn remove_custom_container(name: String) -> Result<(), String> {
    let mut config = load_config();
    let before = config.custom_containers.len();
    config.custom_containers.retain(|c| c.name != name);

    if config.custom_containers.len() == before {
        return Err(format!("No custom container named '{}'", name));
    }

    save_config(&config)
}

/// List all custom containers from config.
#[tauri::command]
pub fn list_custom_containers() -> Result<Vec<CustomContainerConfig>, String> {
    let config = load_config();
    Ok(config.custom_containers)
}

/// Update an existing custom container config.
#[tauri::command]
pub fn update_custom_container(container: CustomContainerConfig) -> Result<(), String> {
    let mut config = load_config();

    if let Some(existing) = config
        .custom_containers
        .iter_mut()
        .find(|c| c.id == container.id)
    {
        *existing = container;
        save_config(&config)
    } else {
        Err(format!(
            "No custom container with id '{}'",
            container.id
        ))
    }
}
