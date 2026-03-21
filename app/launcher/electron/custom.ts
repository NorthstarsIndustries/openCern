import { loadConfig, saveConfig, type CustomContainerConfig } from "./config";

/** Add a new custom container to the config. */
export function addCustomContainer(container: CustomContainerConfig): void {
  const config = loadConfig();

  if (config.custom_containers.some((c) => c.name === container.name)) {
    throw new Error(`A container named '${container.name}' already exists`);
  }

  config.custom_containers.push(container);
  saveConfig(config);
}

/** Remove a custom container from the config by name. */
export function removeCustomContainer(name: string): void {
  const config = loadConfig();
  const before = config.custom_containers.length;
  config.custom_containers = config.custom_containers.filter(
    (c) => c.name !== name,
  );

  if (config.custom_containers.length === before) {
    throw new Error(`No custom container named '${name}'`);
  }

  saveConfig(config);
}

/** List all custom containers from config. */
export function listCustomContainers(): CustomContainerConfig[] {
  const config = loadConfig();
  return config.custom_containers;
}

/** Update an existing custom container config. */
export function updateCustomContainer(container: CustomContainerConfig): void {
  const config = loadConfig();
  const idx = config.custom_containers.findIndex((c) => c.id === container.id);

  if (idx === -1) {
    throw new Error(`No custom container with id '${container.id}'`);
  }

  config.custom_containers[idx] = container;
  saveConfig(config);
}
