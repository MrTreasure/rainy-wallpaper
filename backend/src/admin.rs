use axum::{Json,extract::State,http::HeaderMap};
use serde::Deserialize;
use serde_json::{json,Value};
use crate::{Shared,Result,ApiError,model::*};

pub async fn overview(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{
 app.auth(&h,true).await?;let config=app.config().await?;let db=app.db().await?;
 let row=db.query_one("select coalesce(sum(succeeded),0)::bigint queries,coalesce(sum(failed),0)::bigint failed,count(distinct actor_key)::bigint actors,count(distinct actor_key) filter(where actor_kind='user')::bigint users,count(distinct actor_key) filter(where actor_kind='device')::bigint devices,coalesce(sum(succeeded) filter(where day=(now() at time zone 'Asia/Shanghai')::date),0)::bigint today,(select count(*) from wallpapers)::bigint wallpapers from wallpaper_usage",&[]).await?;
 let days=db.query("select day,sum(succeeded)::bigint queries,sum(failed)::bigint failed,count(distinct actor_key)::bigint actors from wallpaper_usage group by day order by day desc limit 30",&[]).await?;
 let recent=db.query("select actor_key,actor_kind,day,used,succeeded,failed,updated_at from wallpaper_usage order by updated_at desc limit 100",&[]).await?;
 let daily:Vec<Value>=days.iter().map(|r|json!({"day":r.get::<_,chrono::NaiveDate>("day"),"queries":r.get::<_,i64>("queries"),"failed":r.get::<_,i64>("failed"),"actors":r.get::<_,i64>("actors")})).collect();
 let counters:Vec<Value>=recent.iter().map(|r|json!({"actorId":r.get::<_,String>("actor_key"),"kind":r.get::<_,String>("actor_kind"),"day":r.get::<_,chrono::NaiveDate>("day"),"used":r.get::<_,i32>("used"),"queries":r.get::<_,i32>("succeeded"),"failed":r.get::<_,i32>("failed"),"updatedAt":r.get::<_,chrono::DateTime<chrono::Utc>>("updated_at")})).collect();
 Ok(Json(json!({"config":config,"stats":{"queries":row.get::<_,i64>("queries"),"today":row.get::<_,i64>("today"),"failed":row.get::<_,i64>("failed"),"actors":row.get::<_,i64>("actors"),"users":row.get::<_,i64>("users"),"devices":row.get::<_,i64>("devices"),"wallpapers":row.get::<_,i64>("wallpapers")},"daily":daily,"counters":counters,"service":"Rust / PostgreSQL","storage":"local-only","synthesis":"浏览器实时合成，个人内容仅存本机"})))
}
#[derive(Deserialize)]#[serde(deny_unknown_fields)]pub struct Change{data:Config,version:i64}
pub async fn save_config(State(app):State<Shared>,h:HeaderMap,Json(c):Json<Change>)->Result<Json<ConfigRecord>>{
 let user=app.auth(&h,true).await?.user;if !c.data.valid()||c.version<1{return Err(ApiError::new(axum::http::StatusCode::BAD_REQUEST,"INVALID_CONFIG","配置格式或参数范围不正确"))}
 let mut db=app.db().await?;let tx=db.transaction().await?;let data=serde_json::to_value(&c.data).unwrap();let row=tx.query_opt("update app_config set data=$1,version=version+1,updated_at=now() where singleton and version=$2 returning version",&[&data,&c.version]).await?;
 let version=match row{Some(row)=>row.get::<_,i64>(0),None=>return Err(ApiError::new(axum::http::StatusCode::CONFLICT,"CONFIG_CONFLICT","配置已被更新，请重新加载再保存"))};
 tx.execute("insert into admin_audit(actor_id,action,detail) values($1,'config.updated',$2)",&[&user.id,&data]).await?;tx.commit().await?;Ok(Json(ConfigRecord{data:c.data,version,unsplash_configured:!app.unsplash.is_empty()}))
}
pub async fn audit(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{
 app.auth(&h,true).await?;let rows=app.db().await?.query("select id,actor_id,action,created_at from admin_audit order by id desc limit 100",&[]).await?;
 let items:Vec<Value>=rows.iter().map(|r|json!({"id":r.get::<_,i64>("id"),"actorId":r.get::<_,String>("actor_id"),"action":r.get::<_,String>("action"),"createdAt":r.get::<_,chrono::DateTime<chrono::Utc>>("created_at")})).collect();Ok(Json(json!({"items":items})))
}
