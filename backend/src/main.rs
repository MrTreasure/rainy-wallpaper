mod model;
mod usage;
mod wallpaper;
mod admin;
mod registration;
mod identity_rpc { tonic::include_proto!("c137.identity.v1"); }
use identity_rpc::registration_service_client::RegistrationServiceClient;
use identity_rpc::identity_service_client::IdentityServiceClient;

use axum::{Router,Json,extract::{State,Request,DefaultBodyLimit},http::{HeaderMap,HeaderValue,StatusCode},middleware::{self,Next},response::{IntoResponse,Response},routing::{get,post,put}};
use deadpool_postgres::{Manager,Pool,Object};
use serde_json::{json,Value};
use std::{collections::HashMap,sync::{Arc,Mutex},time::{Duration,Instant}};
use tokio_postgres::NoTls;
use model::*;

const APP_ID:&str="rainy-wallpaper";
const PUBLIC_ORIGIN:&str="https://render.mrtreasure.cc";
const RAIN_ORIGIN:&str="https://rain.mrtreasure.cc";
const ADMIN_ORIGIN:&str="https://orbit.mrtreasure.cc";
struct App{pool:Pool,client:reqwest::Client,identity:IdentityServiceClient<tonic::transport::Channel>,registration:RegistrationServiceClient<tonic::transport::Channel>,rpc_token:String,unsplash:String,limits:Mutex<HashMap<String,(Instant,u32)>>,photo_locks:Mutex<HashMap<String,Arc<tokio::sync::Mutex<()>>>>}
type Shared=Arc<App>;
struct ApiError{status:StatusCode,code:&'static str,message:String,current:Option<Value>}
type Result<T>=std::result::Result<T,ApiError>;
impl ApiError{fn new(status:StatusCode,code:&'static str,message:impl Into<String>)->Self{Self{status,code,message:message.into(),current:None}}fn service()->Self{Self::new(StatusCode::SERVICE_UNAVAILABLE,"SERVICE_UNAVAILABLE","查询服务暂不可用，本机内容仍然保留")}}
impl IntoResponse for ApiError{fn into_response(self)->Response{(self.status,Json(json!({"code":self.code,"message":self.message,"current":self.current}))).into_response()}}
impl From<tokio_postgres::Error> for ApiError{fn from(_:tokio_postgres::Error)->Self{Self::service()}}
impl App{
 async fn db(&self)->Result<Object>{self.pool.get().await.map_err(|_|ApiError::service())}
 async fn config(&self)->Result<ConfigRecord>{let db=self.db().await?;let r=db.query_one("select data,version from app_config where singleton",&[]).await?;let data:Value=r.get(0);Ok(ConfigRecord{data:serde_json::from_value(data).map_err(|_|ApiError::service())?,version:r.get(1),unsplash_configured:!self.unsplash.is_empty()})}
 async fn auth(&self,h:&HeaderMap,admin:bool)->Result<Session>{
  let (cookie,application,kind)=if admin {
   let origin=h.get("origin").and_then(|v|v.to_str().ok()).unwrap_or("");
   if h.get("host").and_then(|v|v.to_str().ok())!=Some("orbit.mrtreasure.cc")||(!origin.is_empty()&&origin!=ADMIN_ORIGIN){return Err(ApiError::new(StatusCode::FORBIDDEN,"ADMIN_ORIGIN_REQUIRED","请从 Orbit 管理台访问"))}
   ("__Host-orbit_session","admin-console",identity_rpc::SessionKind::Orbit)
  }else{("mrtreasure_session",APP_ID,identity_rpc::SessionKind::Application)};
  let raw=h.get("cookie").and_then(|v|v.to_str().ok()).unwrap_or("");
  let token=raw.split(';').filter_map(|v|v.trim().split_once('=')).find(|(k,_)|*k==cookie).map(|(_,v)|v).filter(|v|!v.is_empty()).ok_or_else(||ApiError::new(StatusCode::UNAUTHORIZED,"LOGIN_REQUIRED","请先登录"))?;
  let mut request=tonic::Request::new(identity_rpc::ValidateSessionRequest{session_token:token.into(),application_id:application.into(),kind:kind as i32,enroll_if_missing:!admin});
  request.set_timeout(Duration::from_secs(3));
  request.metadata_mut().insert("authorization",format!("Bearer {}",self.rpc_token).parse().map_err(|_|ApiError::service())?);
  let mut client=self.identity.clone();
  let response=client.validate_session(request).await.map_err(|e|match e.code(){
   tonic::Code::Unauthenticated=>ApiError::new(StatusCode::UNAUTHORIZED,"LOGIN_REQUIRED","登录已失效，请重新登录"),
   tonic::Code::PermissionDenied=>ApiError::new(StatusCode::FORBIDDEN,"APPLICATION_ACCESS_DENIED","当前账号无权使用此应用，请联系管理员"),
   _=>ApiError::new(StatusCode::SERVICE_UNAVAILABLE,"IDENTITY_UNAVAILABLE","统一登录服务暂不可用，本机内容仍然保留")
  })?.into_inner();
  let u=response.user.ok_or_else(ApiError::service)?;
  if let Some(expected)=h.get("x-account-id").and_then(|v|v.to_str().ok()){if expected!=u.id{return Err(ApiError::new(StatusCode::CONFLICT,"ACCOUNT_CHANGED","登录账号已变化，请刷新后重试，本机内容仍然保留"))}}
  if u.id.is_empty()||(admin&&!u.is_super_admin){return Err(ApiError::new(StatusCode::FORBIDDEN,"FORBIDDEN","账号无权执行此操作"))}
  if !admin&&!self.config().await?.data.enabled{return Err(ApiError::new(StatusCode::SERVICE_UNAVAILABLE,"APP_DISABLED","远端服务正在维护，本机内容仍然可用"))}
  Ok(Session{user:User{id:u.id,display_name:u.display_name,email:u.email,is_super_admin:u.is_super_admin,avatar_url:u.avatar_url},application_id:response.application_id})
 }
 fn rate(&self,key:String,max:u32,window:Duration)->bool{let Ok(mut map)=self.limits.lock()else{return false};let now=Instant::now();if map.len()>10000{map.retain(|_,(t,_)|now.duration_since(*t)<Duration::from_secs(3600));}let b=map.entry(key).or_insert((now,0));if now.duration_since(b.0)>window{*b=(now,0)}b.1+=1;b.1<=max}
}
async fn headers(State(_app):State<Shared>,req:Request,next:Next)->Response{
 let origin=req.headers().get("origin").and_then(|v|v.to_str().ok()).unwrap_or("").to_string();let extra=std::env::var("PUBLIC_ORIGINS").unwrap_or_default();
 let trusted=origin==PUBLIC_ORIGIN||origin==RAIN_ORIGIN||origin==ADMIN_ORIGIN||extra.split(',').any(|v|!v.trim().is_empty()&&v.trim()==origin);
 let path=req.uri().path();
 let public=matches!(path,"/v1/rainy-wallpaper/config"|"/v1/rainy-wallpaper/wallpapers"|"/v1/rainy-wallpaper/wallpaper/use"|"/v1/rainy-wallpaper/device"|"/v1/rainy-wallpaper/quota")||path.starts_with("/v1/rainy-wallpaper/wallpaper/download/");
 let public_preview=public&&origin=="https://render.qmuse.pub";
 let valid=trusted||public_preview;
 let mut res=if req.method()=="OPTIONS"{if valid{StatusCode::NO_CONTENT.into_response()}else{ApiError::new(StatusCode::FORBIDDEN,"ORIGIN_DENIED","来源不受支持").into_response()}}
 else if !["GET","HEAD"].contains(&req.method().as_str())&&!valid{ApiError::new(StatusCode::FORBIDDEN,"ORIGIN_DENIED","来源不受支持").into_response()}
 else{next.run(req).await};
 let h=res.headers_mut();h.insert("cache-control",HeaderValue::from_static("no-store"));h.insert("x-content-type-options",HeaderValue::from_static("nosniff"));
 if valid{h.insert("access-control-allow-origin",HeaderValue::from_str(&origin).unwrap());if trusted{h.insert("access-control-allow-credentials",HeaderValue::from_static("true"));}h.insert("vary",HeaderValue::from_static("Origin"));h.insert("access-control-allow-methods",HeaderValue::from_static("GET,POST,PUT,DELETE,OPTIONS"));h.insert("access-control-allow-headers",HeaderValue::from_static("Content-Type,X-Account-Id,X-Device-Id,X-Device-Ticket,X-Request-Id"));h.insert("access-control-max-age",HeaderValue::from_static("600"));}res
}
async fn local_only()->ApiError{ApiError::new(StatusCode::GONE,"LOCAL_STORAGE_ONLY","内容仅保存在当前浏览器，不提供远端保存或读取")}
async fn health(State(app):State<Shared>)->Result<Json<Value>>{app.db().await?.simple_query("select 1").await?;Ok(Json(json!({"ok":true,"service":APP_ID,"runtime":"Rust"})))}
async fn config(State(app):State<Shared>)->Result<Json<ConfigRecord>>{Ok(Json(app.config().await?))}
async fn session(State(app):State<Shared>,h:HeaderMap)->Result<Json<Session>>{Ok(Json(app.auth(&h,false).await?))}
#[tokio::main]
async fn main(){
 if std::env::args().any(|v|v=="--healthcheck"){let ok=reqwest::Client::new().get("http://127.0.0.1:8080/healthz").timeout(Duration::from_secs(3)).send().await.map(|r|r.status().is_success()).unwrap_or(false);std::process::exit(if ok{0}else{1})}
 let dsn=std::env::var("DATABASE_URL").expect("DATABASE_URL is required");let pg=dsn.parse().expect("Invalid database configuration");
 let pool=Pool::builder(Manager::new(pg,NoTls)).max_size(8).build().expect("Database pool unavailable");
 {let db=pool.get().await.expect("Database not ready");db.batch_execute(include_str!("../schema.sql")).await.expect("Schema migration failed");let c=serde_json::to_value(Config::default()).unwrap();db.execute("insert into app_config(singleton,data) values(true,$1) on conflict do nothing",&[&c]).await.expect("Application configuration unavailable");}
 {let db=pool.get().await.expect("Database not ready");let legacy=json!(["forest","ocean","mountain","rain","city","flowers"]);let expanded=serde_json::to_value(Config::default().wallpaper.topics).unwrap();
 db.execute("update app_config set data=jsonb_set(data,'{wallpaper,topics}',$1),version=version+1,updated_at=now() where singleton and data #> '{wallpaper,topics}'=$2",&[&expanded,&legacy]).await.expect("Wallpaper category migration failed");}

 let endpoint=std::env::var("IDENTITY_RPC_URL").unwrap_or("http://c137-identity-rpc:50051".into());
 let channel=tonic::transport::Endpoint::from_shared(endpoint).expect("Invalid identity RPC address").connect_timeout(Duration::from_secs(3)).tcp_keepalive(Some(Duration::from_secs(60))).http2_keep_alive_interval(Duration::from_secs(60)).keep_alive_timeout(Duration::from_secs(10)).connect().await.expect("Identity RPC unavailable");
 let rpc_token=std::env::var("IDENTITY_RPC_TOKEN").expect("Identity RPC caller credential required");
 let app=Arc::new(App{pool,client:reqwest::Client::builder().connect_timeout(Duration::from_secs(5)).timeout(Duration::from_secs(12)).redirect(reqwest::redirect::Policy::none()).build().unwrap(),identity:IdentityServiceClient::new(channel.clone()),registration:RegistrationServiceClient::new(channel),rpc_token,unsplash:std::env::var("UNSPLASH_ACCESS_KEY").unwrap_or_default(),limits:Mutex::new(HashMap::new()),photo_locks:Mutex::new(HashMap::new())});
 let router=Router::new().route("/healthz",get(health))
 .route("/v1/rainy-wallpaper/auth/register/code",post(registration::code)).route("/v1/rainy-wallpaper/auth/register",post(registration::register))
 .route("/v1/rainy-wallpaper/config",get(config)).route("/v1/rainy-wallpaper/session",get(session))
 .route("/v1/rainy-wallpaper/notes",axum::routing::any(local_only)).route("/v1/rainy-wallpaper/notes/{id}",axum::routing::any(local_only))
 .route("/v1/rainy-wallpaper/preferences",axum::routing::any(local_only))
 .route("/v1/rainy-wallpaper/device",post(usage::device)).route("/v1/rainy-wallpaper/quota",get(usage::status))
 .route("/v1/rainy-wallpaper/wallpapers",get(wallpaper::list)).route("/v1/rainy-wallpaper/wallpaper/use",post(wallpaper::use_photo)).route("/v1/rainy-wallpaper/wallpaper/download/{id}",get(wallpaper::download))
 .route("/v1/rainy-wallpaper/favorites",axum::routing::any(local_only)).route("/v1/rainy-wallpaper/favorites/{id}",axum::routing::any(local_only))
 .route("/api/rainy-wallpaper/overview",get(admin::overview)).route("/api/rainy-wallpaper/config",put(admin::save_config)).route("/api/rainy-wallpaper/audit",get(admin::audit))
 .layer(DefaultBodyLimit::max(256*1024)).layer(middleware::from_fn_with_state(app.clone(),headers)).with_state(app);
 let listener=tokio::net::TcpListener::bind("0.0.0.0:8080").await.expect("HTTP listener unavailable");eprintln!("rainy-wallpaper Rust service ready on 8080");
 axum::serve(listener,router).with_graceful_shutdown(async{let mut terminate=tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("signal handler");tokio::select!{_ =tokio::signal::ctrl_c()=>{},_ =terminate.recv()=>{}}}).await.expect("HTTP server failed");
}
