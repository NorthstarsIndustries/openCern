mod config;
mod containers;
mod custom;
mod docker;
mod setup;
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Setup
            setup::check_docker,
            setup::get_docker_install_url,
            setup::get_setup_status,
            setup::complete_setup,
            setup::get_setup_images,
            setup::get_settings,
            setup::save_settings,
            // Containers
            containers::list_containers,
            containers::start_container,
            containers::stop_container,
            containers::restart_container,
            containers::start_all,
            containers::stop_all,
            containers::get_container_logs,
            containers::get_container_stats,
            containers::pull_images,
            containers::check_image_updates,
            containers::open_webapp,
            containers::start_custom_container,
            // Custom containers
            custom::add_custom_container,
            custom::remove_custom_container,
            custom::list_custom_containers,
            custom::update_custom_container,
            // Updater
            updater::check_for_updates,
        ])
        .setup(|app| {
            // Spawn the background update checker
            let handle = app.handle().clone();
            updater::spawn_update_checker(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running OpenCERN Launcher");
}
