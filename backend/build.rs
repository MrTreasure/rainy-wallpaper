fn main() {
 // NAS builds use the pinned Linux x86_64 compiler; other hosts can supply PROTOC.
 let protoc=std::env::var_os("PROTOC").map(std::path::PathBuf::from)
  .unwrap_or_else(protoc_bin_vendored_linux_x86_64::protoc_bin_path);
 let mut config=prost_build::Config::new();
 config.protoc_executable(protoc);
 tonic_prost_build::configure().build_server(false)
  .compile_with_config(config,&["proto/c137/identity/v1/identity.proto","proto/c137/identity/v1/registration.proto"],&["proto"])
  .expect("identity contract generation failed");
 println!("cargo:rerun-if-env-changed=PROTOC");
 println!("cargo:rerun-if-changed=proto/c137/identity/v1/registration.proto");
 println!("cargo:rerun-if-changed=proto/c137/identity/v1/identity.proto");
}
