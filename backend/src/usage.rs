//! Only quota counters and request receipts are persisted, never personal content.
use axum::{Json,extract::State,http::{HeaderMap,StatusCode}};
use chrono::{NaiveDate,Utc};
use serde::Serialize;
use serde_json::{Value,json};
use uuid::Uuid;
use crate::{Shared,Result,ApiError};

#[derive(Clone)]
pub struct Actor {pub key:String,pub kind:&'static str,pub limit:Option<i32>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Quota {pub used:i32,pub limit:Option<i32>,pub remaining:Option<i32>,pub day:NaiveDate,pub timezone:&'static str}
fn day()->NaiveDate{(Utc::now()+chrono::Duration::hours(8)).date_naive()}
fn quota(used:i32,limit:Option<i32>,date:NaiveDate)->Quota{Quota{used,limit,remaining:limit.map(|cap|(cap-used).max(0)),day:date,timezone:"Asia/Shanghai"}}
fn header<'a>(h:&'a HeaderMap,name:&str)->Result<&'a str>{h.get(name).and_then(|v|v.to_str().ok()).filter(|v|!v.is_empty()).ok_or_else(||ApiError::new(StatusCode::UNAUTHORIZED,"DEVICE_REQUIRED","请允许本机存储后重试壁纸查询"))}

pub async fn device(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{
 let ip=h.get("x-real-ip").and_then(|v|v.to_str().ok()).unwrap_or("local");
 if !app.rate(format!("device-register:{ip}"),15,std::time::Duration::from_secs(3600)){return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS,"RATE_LIMITED","设备登记过于频繁，请稍后再试"))}
 let id=Uuid::new_v4();let ticket=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 app.db().await?.execute("insert into wallpaper_devices(id,ticket_hash) values($1,sha256(convert_to($2,'UTF8')))",&[&id,&ticket]).await?;
 Ok(Json(json!({"id":id,"ticket":ticket})))
}
pub async fn actor(app:&Shared,h:&HeaderMap)->Result<Actor>{
 // A browser-supplied account id or role never establishes identity.
 let has_session=h.get("cookie").and_then(|v|v.to_str().ok()).is_some_and(|v|v.split(';').any(|part|part.trim().starts_with("mrtreasure_session=")));
 if has_session{let session=app.auth(h,false).await?;return Ok(Actor{key:format!("user:{}",session.user.id),kind:"user",limit:if session.user.is_super_admin{None}else{Some(50)}})}
 let id=Uuid::parse_str(header(h,"x-device-id")?).map_err(|_|ApiError::new(StatusCode::UNAUTHORIZED,"DEVICE_REQUIRED","本机设备登记已失效"))?;
 let ticket=header(h,"x-device-ticket")?;
 if ticket.len()!=64||!ticket.bytes().all(|c|c.is_ascii_hexdigit()){return Err(ApiError::new(StatusCode::UNAUTHORIZED,"DEVICE_REQUIRED","本机设备登记已失效"))}
 let valid:bool=app.db().await?.query_one("select exists(select 1 from wallpaper_devices where id=$1 and ticket_hash=sha256(convert_to($2,'UTF8')))",&[&id,&ticket]).await?.get(0);
 if !valid{return Err(ApiError::new(StatusCode::UNAUTHORIZED,"DEVICE_REQUIRED","本机设备登记已失效"))}
 Ok(Actor{key:format!("device:{id}"),kind:"device",limit:Some(10)})
}
pub async fn status(State(app):State<Shared>,h:HeaderMap)->Result<Json<Quota>>{
 let actor=actor(&app,&h).await?;let date=day();let used=app.db().await?.query_opt("select used from wallpaper_usage where actor_key=$1 and day=$2",&[&actor.key,&date]).await?.map(|r|r.get(0)).unwrap_or(0);
 Ok(Json(quota(used,actor.limit,date)))
}

pub struct Reservation {app:Shared,actor:Actor,id:Uuid,date:NaiveDate,finished:bool}
impl Reservation{
 pub async fn claim(app:&Shared,actor:Actor,id:Uuid)->Result<Self>{
  let date=day();let mut db=app.db().await?;let tx=db.transaction().await?;
  tx.execute("select pg_advisory_xact_lock(hashtextextended($1,0))",&[&actor.key]).await?;
  // Reclaim interrupted requests without a background job or lost daily quota.
  tx.execute("with stale as (update wallpaper_query_receipts set status='failed' where actor_key=$1 and status='pending' and created_at<now()-interval '90 seconds' returning day) update wallpaper_usage u set used=greatest(0,u.used-s.n),failed=u.failed+s.n,updated_at=now() from (select day,count(*)::int n from stale group by day) s where u.actor_key=$1 and u.day=s.day",&[&actor.key]).await?;
  if tx.query_opt("select 1 from wallpaper_query_receipts where actor_key=$1 and request_id=$2",&[&actor.key,&id]).await?.is_some(){return Err(ApiError::new(StatusCode::CONFLICT,"QUERY_ALREADY_RECEIVED","这次查询已受理，请勿重复提交"))}
  tx.execute("insert into wallpaper_usage(actor_key,actor_kind,day) values($1,$2,$3) on conflict do nothing",&[&actor.key,&actor.kind,&date]).await?;
  let row=tx.query_opt("update wallpaper_usage set used=used+1,updated_at=now() where actor_key=$1 and day=$2 and ($3::int is null or used<$3) returning used",&[&actor.key,&date,&actor.limit]).await?;
  if row.is_none(){return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS,"DAILY_QUOTA_REACHED",format!("今日壁纸查询额度已用完（{} 次），仍可免费使用本机历史与收藏；北京时间次日重置",actor.limit.unwrap_or(0))))}
  tx.execute("insert into wallpaper_query_receipts(actor_key,request_id,day,status) values($1,$2,$3,'pending')",&[&actor.key,&id,&date]).await?;
  tx.commit().await?;Ok(Self{app:app.clone(),actor,id,date,finished:false})
 }
 pub async fn complete(mut self)->Result<Quota>{
  let used=finish(&self.app,&self.actor.key,self.id,self.date,true).await?;self.finished=true;Ok(quota(used,self.actor.limit,self.date))
 }
}
impl Drop for Reservation{fn drop(&mut self){if self.finished{return}let app=self.app.clone();let key=self.actor.key.clone();let id=self.id;let date=self.date;tokio::spawn(async move{let _=finish(&app,&key,id,date,false).await;});}}
async fn finish(app:&Shared,key:&str,id:Uuid,date:NaiveDate,success:bool)->Result<i32>{
 let mut db=app.db().await?;let tx=db.transaction().await?;
 tx.execute("select pg_advisory_xact_lock(hashtextextended($1,0))",&[&key]).await?;
 let status=if success{"completed"}else{"failed"};
 let changed=tx.execute("update wallpaper_query_receipts set status=$3 where actor_key=$1 and request_id=$2 and status='pending'",&[&key,&id,&status]).await?;
 if changed>0{tx.execute("update wallpaper_usage set used=greatest(0,used-$3),succeeded=succeeded+$4,failed=failed+$3,updated_at=now() where actor_key=$1 and day=$2",&[&key,&date,&if success{0i32}else{1},&if success{1i32}else{0}]).await?;}
 let used=tx.query_one("select used from wallpaper_usage where actor_key=$1 and day=$2",&[&key,&date]).await?.get(0);tx.commit().await?;Ok(used)
}

#[cfg(test)]
mod tests{
 use super::*;
 use std::sync::{Arc,Mutex};
 use std::collections::HashMap;
 use crate::{App,model::Config,identity_rpc::{identity_service_client::IdentityServiceClient,registration_service_client::RegistrationServiceClient}};
 #[test]fn remaining_never_negative(){assert_eq!(quota(12,Some(10),day()).remaining,Some(0));assert_eq!(quota(999,None,day()).remaining,None)}
 #[tokio::test]
 #[ignore="Requires a disposable rainy_wallpaper_check_* PostgreSQL database"]
 async fn quota_concurrency_refunds_and_device_auth(){
  let dsn=std::env::var("RAINY_TEST_DATABASE_URL").expect("disposable database required");let pg=dsn.parse().unwrap();
  let pool=deadpool_postgres::Pool::builder(deadpool_postgres::Manager::new(pg,tokio_postgres::NoTls)).max_size(8).build().unwrap();
  {let db=pool.get().await.unwrap();let name:String=db.query_one("select current_database()",&[]).await.unwrap().get(0);assert!(name.starts_with("rainy_wallpaper_check_"),"never run against production");db.batch_execute(include_str!("../schema.sql")).await.unwrap();let config=serde_json::to_value(Config::default()).unwrap();db.execute("insert into app_config(singleton,data) values(true,$1) on conflict do nothing",&[&config]).await.unwrap();}
  let channel=tonic::transport::Endpoint::from_static("http://127.0.0.1:1").connect_lazy();
  let app=Arc::new(App{pool,client:reqwest::Client::new(),identity:IdentityServiceClient::new(channel.clone()),registration:RegistrationServiceClient::new(channel),rpc_token:String::new(),unsplash:String::new(),limits:Mutex::new(HashMap::new()),photo_locks:Mutex::new(HashMap::new())});
  for (kind,limit,attempts,expected) in [("device",Some(10),24,10),("user",Some(50),64,50),("user",None,64,64)]{
   let key=format!("{kind}:test-{}",Uuid::new_v4());let mut jobs=vec![];
   for _ in 0..attempts{let app=app.clone();let actor=Actor{key:key.clone(),kind,limit};jobs.push(tokio::spawn(async move{match Reservation::claim(&app,actor,Uuid::new_v4()).await{Ok(r)=>{assert!(r.complete().await.is_ok());true},Err(e)=>{assert_eq!(e.code,"DAILY_QUOTA_REACHED");false}}}));}
   let mut successes=0;for job in jobs{if job.await.unwrap(){successes+=1}}assert_eq!(successes,expected);
   let db=app.db().await.unwrap_or_else(|_|panic!("db"));let row=db.query_one("select used,succeeded from wallpaper_usage where actor_key=$1 and day=$2",&[&key,&day()]).await.unwrap();assert_eq!(row.get::<_,i32>(0),expected);assert_eq!(row.get::<_,i32>(1),expected);
  }
  let key=format!("device:refund-{}",Uuid::new_v4());let actor=Actor{key:key.clone(),kind:"device",limit:Some(10)};let request=Uuid::new_v4();
  let pending=Reservation::claim(&app,actor.clone(),request).await.unwrap_or_else(|_|panic!("claim"));
  assert!(matches!(Reservation::claim(&app,actor.clone(),request).await,Err(ApiError{code:"QUERY_ALREADY_RECEIVED",..})));drop(pending);
  let mut refunded=false;for _ in 0..100{let db=app.db().await.unwrap_or_else(|_|panic!("db"));let used:i32=db.query_one("select used from wallpaper_usage where actor_key=$1 and day=$2",&[&key,&day()]).await.unwrap().get(0);if used==0{refunded=true;break}tokio::time::sleep(std::time::Duration::from_millis(10)).await;}assert!(refunded);
  let request=Uuid::new_v4();assert!(Reservation::claim(&app,actor.clone(),request).await.unwrap_or_else(|_|panic!("claim")).complete().await.is_ok());assert!(matches!(Reservation::claim(&app,actor.clone(),request).await,Err(ApiError{code:"QUERY_ALREADY_RECEIVED",..})));
  // A new Shanghai day starts independently of the previous day's usage.
  let yesterday=day()-chrono::Duration::days(1);app.db().await.unwrap_or_else(|_|panic!("db")).execute("insert into wallpaper_usage(actor_key,actor_kind,day,used,succeeded) values($1,'device',$2,10,10)",&[&key,&yesterday]).await.unwrap();
  assert!(Reservation::claim(&app,actor,Uuid::new_v4()).await.unwrap_or_else(|_|panic!("claim")).complete().await.is_ok());
  let Json(d)=device(State(app.clone()),HeaderMap::new()).await.unwrap_or_else(|_|panic!("device registration"));let mut h=HeaderMap::new();h.insert("x-device-id",d["id"].as_str().unwrap().parse().unwrap());h.insert("x-device-ticket",d["ticket"].as_str().unwrap().parse().unwrap());
  assert!(actor_for_test(&app,&h).await);h.insert("x-device-ticket","0".repeat(64).parse().unwrap());assert!(!actor_for_test(&app,&h).await);
  assert_eq!(crate::local_only().await.status,StatusCode::GONE);
 }
 async fn actor_for_test(app:&Shared,h:&HeaderMap)->bool{actor(app,h).await.is_ok()}
}
