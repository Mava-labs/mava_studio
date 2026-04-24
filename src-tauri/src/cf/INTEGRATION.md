# ─────────────────────────────────────────────────────────────────────────────
# Cargo.toml — add these dependencies to [dependencies]
# ─────────────────────────────────────────────────────────────────────────────

# [dependencies]
# anyhow = "1"
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# sha2 = "0.10"
# tokio = { version = "1", features = ["full"] }   # already present in Tauri projects

# ─────────────────────────────────────────────────────────────────────────────
# src/main.rs (or src/lib.rs) — add these lines
# ─────────────────────────────────────────────────────────────────────────────

# 1. Declare the module at the top of main.rs:
#    mod cf;

# 2. Register commands in the Tauri builder:
#    .invoke_handler(tauri::generate_handler![
#        // ... your existing commands ...
#        cf::cf_cache_framework,
#        cf::cf_mapper_run,
#        cf::cf_inspector_run,
#        cf::cf_get_brief,
#        cf::cf_list_cached_frameworks,
#    ])

# ─────────────────────────────────────────────────────────────────────────────
# File placement in your Rust src/ tree
# ─────────────────────────────────────────────────────────────────────────────

# src/
#   main.rs           ← add: mod cf;  and register commands
#   cf/
#     mod.rs
#     types.rs
#     validation.rs
#     cache.rs
#     mapper.rs
#     inspector.rs
#     commands.rs

# ─────────────────────────────────────────────────────────────────────────────
# Note on mapper.rs test helper
# ─────────────────────────────────────────────────────────────────────────────
# inspector.rs tests reference crate::cf::mapper::tests::minimal_published_framework().
# Add this to mapper.rs inside the #[cfg(test)] block:
#
# pub fn minimal_published_framework() -> CompetenceFramework {
#     let mut fw = mock_framework();
#     // Compute and stamp a real checksum so validate_framework passes
#     use crate::cf::validation::compute_checksum;
#     let checksum = compute_checksum(&fw);
#     fw.metadata.checksum = Some(checksum);
#     fw
# }
