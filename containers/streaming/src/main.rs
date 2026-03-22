use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::fs;
use tokio::sync::mpsc;
use warp::Filter;
use serde::{Deserialize, Serialize};

fn strip_data_extension(filename: &str) -> &str {
    let extensions = [
        ".root", ".json", ".csv", ".tsv", ".lhe.gz", ".lhe",
        ".hepmc", ".hepmc2", ".hepmc3", ".parquet",
        ".hdf5", ".h5", ".yoda", ".ntuple", ".txt", ".dat",
    ];
    for ext in &extensions {
        if let Some(stem) = filename.strip_suffix(ext) {
            return stem;
        }
    }
    filename
}

#[derive(Deserialize)]
struct PaginationQuery {
    filename: String,
    page: Option<usize>,
    limit: Option<usize>,
}

#[derive(Serialize)]
struct PaginatedResponse {
    metadata: Value,
    events: Vec<Value>,
    total_events: usize,
    page: usize,
    limit: usize,
    total_pages: usize,
}

#[tokio::main]
async fn main() {
    let ws_addr = "0.0.0.0:9001";
    let api_addr = ([0, 0, 0, 0], 9002);

    println!("OpenCERN Streamer starting...");
    
    // WS Streaming loop
    let ws_task = tokio::spawn(async move {
        let listener = TcpListener::bind(ws_addr).await.expect("Failed to bind WS");
        println!("WebSocket Streamer running on ws://{}", ws_addr);

        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let ws_stream = accept_async(stream)
                    .await
                    .expect("WebSocket handshake failed");

                let (mut sender, mut receiver) = ws_stream.split();
                
                // Wait for the first message to be a load command
                while let Some(Ok(msg)) = receiver.next().await {
                    if let Message::Text(text) = msg {
                        if let Ok(cmd) = serde_json::from_str::<Value>(&text) {
                            if cmd["action"] == "load" {
                                if let Some(filename) = cmd["file"].as_str() {
                                    let home = std::env::var("HOME").unwrap();
                                    let stem = strip_data_extension(filename);
                                    let filepath = format!("{}/opencern-datasets/processed/{}.json", home, stem);
                                    
                                    println!("Client requested stream for {}", filepath);
                                    
                                    match fs::read_to_string(&filepath) {
                                        Ok(content) => {
                                            if let Ok(data) = serde_json::from_str::<Value>(&content) {
                                                if let Some(events) = data["events"].as_array() {
                                                    println!("Streaming {} events...", events.len());
                                                    for event in events {
                                                        let msg_str = serde_json::to_string(event).unwrap();
                                                        if sender.send(Message::Text(msg_str.into())).await.is_err() {
                                                            break; // Client disconnected
                                                        }
                                                    }
                                                    // Send EOF marker
                                                    let _ = sender.send(Message::Text(serde_json::json!({"eof": true}).to_string().into())).await;
                                                    let _ = sender.close().await;
                                                }
                                            }
                                        },
                                        Err(e) => {
                                            println!("Error reading file: {}", e);
                                            let _ = sender.send(Message::Text(serde_json::json!({"error": "File not found"}).to_string().into())).await;
                                        }
                                    }
                                }
                                break; // Only process one load command per connection
                            }
                        }
                    }
                }
            });
        }
    });

    // CORS for Warp API
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "DELETE", "OPTIONS"])
        .allow_headers(vec!["*"]);

    // Process Data API
    let process_data = warp::path!("process" / "data")
        .and(warp::query::<PaginationQuery>())
        .map(|q: PaginationQuery| {
            let home = std::env::var("HOME").unwrap();
            let stem = strip_data_extension(&q.filename);
            let filepath = format!("{}/opencern-datasets/processed/{}.json", home, stem);
            
            let page = q.page.unwrap_or(1);
            let limit = q.limit.unwrap_or(5);

            match fs::read_to_string(&filepath) {
                Ok(content) => {
                    if let Ok(data) = serde_json::from_str::<Value>(&content) {
                        let events = data["events"].as_array().cloned().unwrap_or_default();
                        let total_events = events.len();
                        
                        let start = (page.saturating_sub(1)) * limit;
                        let end = (start + limit).min(total_events);
                        
                        let sliced_events = if start < total_events {
                            events[start..end].to_vec()
                        } else {
                            vec![]
                        };

                        let total_pages = if limit > 0 {
                            (total_events + limit - 1) / limit
                        } else {
                            0
                        };

                        let resp = PaginatedResponse {
                            metadata: data["metadata"].clone(),
                            events: sliced_events,
                            total_events,
                            page,
                            limit,
                            total_pages,
                        };
                        
                        warp::reply::json(&resp)
                    } else {
                        warp::reply::json(&serde_json::json!({ "error": "Invalid output JSON file" }))
                    }
                }
                Err(_) => {
                    warp::reply::json(&serde_json::json!({ "error": "Processed data not found" }))
                }
            }
        })
        .with(cors);

    println!("HTTP API running on http://127.0.0.1:{}", api_addr.1);
    let api_task = tokio::spawn(async move {
        warp::serve(process_data).run(api_addr).await;
    });

    let _ = tokio::join!(ws_task, api_task);
}
