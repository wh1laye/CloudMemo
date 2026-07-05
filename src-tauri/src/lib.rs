use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn notes_dir() -> PathBuf {
    let dir = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".cloudmemo");
    if !dir.exists() {
        fs::create_dir_all(&dir).ok();
    }
    dir
}

#[derive(Serialize, Deserialize, Clone)]
struct Note {
    name: String,
    content: String,
    updated: String,
}

#[tauri::command]
fn list_notes() -> Result<Vec<Note>, String> {
    let dir = notes_dir();
    let mut notes = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                if let Some(name) = path.file_stem().and_then(|n| n.to_str()) {
                    let content = fs::read_to_string(&path).unwrap_or_default();
                    let metadata = fs::metadata(&path).ok();
                    let updated = metadata
                        .and_then(|m| m.modified().ok())
                        .map(|t| {
                            let datetime: chrono::DateTime<chrono::Local> = t.into();
                            datetime.format("%Y-%m-%d %H:%M").to_string()
                        })
                        .unwrap_or_default();
                    
                    notes.push(Note {
                        name: name.to_string(),
                        content,
                        updated,
                    });
                }
            }
        }
    }
    
    notes.sort_by(|a, b| b.updated.cmp(&a.updated));
    Ok(notes)
}

#[tauri::command]
fn read_note(name: String) -> Result<String, String> {
    let path = notes_dir().join(format!("{}.md", name));
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_note(name: String, content: String) -> Result<String, String> {
    let safe_name: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' { c } else { '_' })
        .collect();
    if safe_name.trim().is_empty() {
        return Err("Название не может быть пустым".to_string());
    }
    let path = notes_dir().join(format!("{}.md", safe_name));
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(safe_name)
}

#[tauri::command]
fn delete_note(name: String) -> Result<(), String> {
    let path = notes_dir().join(format!("{}.md", name));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            read_note,
            save_note,
            delete_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
