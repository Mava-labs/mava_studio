fn main() {
    tauri_build::build();
    // prost-build compiles .proto files to Rust structs.
    // Output goes to OUT_DIR (managed by Cargo, not a source directory).
    // The generated file is included via `include!(concat!(env!("OUT_DIR"), "/mava.rs"))`
    // in src/lib.rs — do NOT point out_dir at src/ or committed source paths.
    //
    // REQUIREMENT: protoc must be installed on the build machine.
    //   macOS:  brew install protobuf
    //   Linux:  apt install protobuf-compiler  OR  use protoc-bin-vendored below
    //   Windows: choco install protoc
    //
    // If you cannot install protoc system-wide, swap the block below for the
    // protoc-bin-vendored approach (see comment at bottom of file).

    prost_build::compile_protos(
        &["proto/mava.proto"],
        &["proto/"],
    )
    .expect("Failed to compile proto files — is protoc installed?");

    // Re-run build script only when these change
    println!("cargo:rerun-if-changed=proto/mava.proto");
    println!("cargo:rerun-if-changed=build.rs");
}


// ── Alternative: vendored protoc (no system install required) ─────────────────
//
// Add to Cargo.toml [build-dependencies]:
//   protoc-bin-vendored = "3"
//
// Then replace the prost_build::compile_protos call above with:
//
// fn main() {
//     let protoc = protoc_bin_vendored::protoc_bin_path().unwrap();
//     std::env::set_var("PROTOC", protoc);
//     prost_build::compile_protos(&["proto/mava.proto"], &["proto/"])
//         .expect("Failed to compile proto files");
//     println!("cargo:rerun-if-changed=proto/mava.proto");
//     println!("cargo:rerun-if-changed=build.rs");
// }