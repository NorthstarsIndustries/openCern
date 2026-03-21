"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCustomContainer = addCustomContainer;
exports.removeCustomContainer = removeCustomContainer;
exports.listCustomContainers = listCustomContainers;
exports.updateCustomContainer = updateCustomContainer;
const config_1 = require("./config");
/** Add a new custom container to the config. */
function addCustomContainer(container) {
    const config = (0, config_1.loadConfig)();
    if (config.custom_containers.some((c) => c.name === container.name)) {
        throw new Error(`A container named '${container.name}' already exists`);
    }
    config.custom_containers.push(container);
    (0, config_1.saveConfig)(config);
}
/** Remove a custom container from the config by name. */
function removeCustomContainer(name) {
    const config = (0, config_1.loadConfig)();
    const before = config.custom_containers.length;
    config.custom_containers = config.custom_containers.filter((c) => c.name !== name);
    if (config.custom_containers.length === before) {
        throw new Error(`No custom container named '${name}'`);
    }
    (0, config_1.saveConfig)(config);
}
/** List all custom containers from config. */
function listCustomContainers() {
    const config = (0, config_1.loadConfig)();
    return config.custom_containers;
}
/** Update an existing custom container config. */
function updateCustomContainer(container) {
    const config = (0, config_1.loadConfig)();
    const idx = config.custom_containers.findIndex((c) => c.id === container.id);
    if (idx === -1) {
        throw new Error(`No custom container with id '${container.id}'`);
    }
    config.custom_containers[idx] = container;
    (0, config_1.saveConfig)(config);
}
//# sourceMappingURL=custom.js.map