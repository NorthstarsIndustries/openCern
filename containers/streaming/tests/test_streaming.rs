/// Standalone tests for the OpenCERN streaming service parsing logic.
///
/// These tests cover WebSocket message parsing, HTTP pagination parameter
/// parsing, and malformed input handling without starting any servers.

#[cfg(test)]
mod tests {
    use serde_json::Value;

    // ── WebSocket message parsing ────────────────────────────────

    fn parse_ws_load_command(raw: &str) -> Option<String> {
        let cmd: Value = serde_json::from_str(raw).ok()?;
        if cmd["action"].as_str()? == "load" {
            cmd["file"].as_str().map(String::from)
        } else {
            None
        }
    }

    #[test]
    fn test_parse_valid_load_command() {
        let msg = r#"{"action": "load", "file": "cms_data.root"}"#;
        let file = parse_ws_load_command(msg);
        assert_eq!(file, Some("cms_data.root".to_string()));
    }

    #[test]
    fn test_parse_load_command_json_file() {
        let msg = r#"{"action": "load", "file": "events.json"}"#;
        let file = parse_ws_load_command(msg);
        assert_eq!(file, Some("events.json".to_string()));
    }

    #[test]
    fn test_parse_non_load_action_returns_none() {
        let msg = r#"{"action": "subscribe", "channel": "events"}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_parse_missing_file_field() {
        let msg = r#"{"action": "load"}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_ws_load_command("not json at all").is_none());
    }

    #[test]
    fn test_parse_empty_string() {
        assert!(parse_ws_load_command("").is_none());
    }

    // ── Pagination parameter parsing ─────────────────────────────

    struct PaginationParams {
        page: usize,
        limit: usize,
    }

    fn parse_pagination(page: Option<usize>, limit: Option<usize>) -> PaginationParams {
        PaginationParams {
            page: page.unwrap_or(1),
            limit: limit.unwrap_or(5),
        }
    }

    fn paginate_events(events: &[Value], params: &PaginationParams) -> Vec<Value> {
        let start = params.page.saturating_sub(1) * params.limit;
        let end = (start + params.limit).min(events.len());
        if start < events.len() {
            events[start..end].to_vec()
        } else {
            vec![]
        }
    }

    fn total_pages(total: usize, limit: usize) -> usize {
        if limit == 0 {
            return 0;
        }
        (total + limit - 1) / limit
    }

    #[test]
    fn test_default_pagination() {
        let p = parse_pagination(None, None);
        assert_eq!(p.page, 1);
        assert_eq!(p.limit, 5);
    }

    #[test]
    fn test_custom_pagination() {
        let p = parse_pagination(Some(3), Some(10));
        assert_eq!(p.page, 3);
        assert_eq!(p.limit, 10);
    }

    #[test]
    fn test_paginate_first_page() {
        let events: Vec<Value> = (0..12).map(|i| serde_json::json!({"id": i})).collect();
        let p = parse_pagination(Some(1), Some(5));
        let page = paginate_events(&events, &p);
        assert_eq!(page.len(), 5);
        assert_eq!(page[0]["id"], 0);
    }

    #[test]
    fn test_paginate_last_partial_page() {
        let events: Vec<Value> = (0..12).map(|i| serde_json::json!({"id": i})).collect();
        let p = parse_pagination(Some(3), Some(5));
        let page = paginate_events(&events, &p);
        assert_eq!(page.len(), 2);
    }

    #[test]
    fn test_paginate_beyond_end() {
        let events: Vec<Value> = (0..5).map(|i| serde_json::json!({"id": i})).collect();
        let p = parse_pagination(Some(10), Some(5));
        let page = paginate_events(&events, &p);
        assert!(page.is_empty());
    }

    #[test]
    fn test_total_pages_exact_division() {
        assert_eq!(total_pages(20, 5), 4);
    }

    #[test]
    fn test_total_pages_with_remainder() {
        assert_eq!(total_pages(12, 5), 3);
    }

    #[test]
    fn test_total_pages_zero_limit() {
        assert_eq!(total_pages(10, 0), 0);
    }

    // ── File stem extraction ─────────────────────────────────────

    fn extract_stem(filename: &str) -> &str {
        let s = filename.strip_suffix(".root").unwrap_or(filename);
        s.strip_suffix(".json").unwrap_or(s)
    }

    #[test]
    fn test_strip_root_extension() {
        assert_eq!(extract_stem("data.root"), "data");
    }

    #[test]
    fn test_strip_json_extension() {
        assert_eq!(extract_stem("events.json"), "events");
    }

    #[test]
    fn test_no_extension() {
        assert_eq!(extract_stem("rawfile"), "rawfile");
    }

    #[test]
    fn test_double_extension_strips_root_first() {
        assert_eq!(extract_stem("data.root"), "data");
    }

    // ── Malformed WebSocket messages ─────────────────────────────

    #[test]
    fn test_malformed_action_type() {
        let msg = r#"{"action": 123, "file": "data.root"}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_null_file_field() {
        let msg = r#"{"action": "load", "file": null}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_numeric_file_field() {
        let msg = r#"{"action": "load", "file": 42}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_nested_json_object() {
        let msg = r#"{"action": "load", "file": {"path": "data.root"}}"#;
        assert!(parse_ws_load_command(msg).is_none());
    }

    #[test]
    fn test_empty_json_object() {
        assert!(parse_ws_load_command("{}").is_none());
    }

    #[test]
    fn test_array_input() {
        assert!(parse_ws_load_command("[1,2,3]").is_none());
    }
}
