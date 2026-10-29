use axum::{Json,extract::State,http::HeaderMap};
use serde::Deserialize;
use serde_json::{json,Value};
use crate::{Shared,Result,ApiError,model::*};

pub async fn overview(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{
 app.auth(&h,true).await?;let config=app.config().await?;let row=app.db().await?.query_one("select (select count(distinct owner_id) from notes) as users,(select count(*) from notes) as notes,(select count(*) from favorites) as favorites,(select count(*) from wallpapers) as wallpapers",&[]).await?;
 Ok(Json(json!({"config":config,"stats":{"users":row.get::<_,i64>("users"),"notes":row.get::<_,i64>("notes"),"favorites":row.get::<_,i64>("favorites"),"wallpapers":row.get::<_,i64>("wallpapers")},"service":"Rust / PostgreSQL","applicationId":"rainy-wallpaper","synthesis":"浏览器实时合成，后台保存策略与参数"})))
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
