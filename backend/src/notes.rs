use axum::{Json,extract::{State,Path,Query},http::{HeaderMap,StatusCode}};
use serde::Deserialize;
use serde_json::{json,Value};
use uuid::Uuid;
use crate::{Shared,Result,ApiError,model::*};

pub async fn list(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{let user=app.auth(&h,false).await?.user;let rows=app.db().await?.query(&format!("select {NOTE_COLUMNS} from notes where owner_id=$1 order by created_at,id"),&[&user.id]).await?;Ok(Json(json!({"items":rows.iter().map(Note::from_row).collect::<Vec<_>>()})))}
pub async fn create(State(app):State<Shared>,h:HeaderMap,Json(n):Json<Note>)->Result<Json<Note>>{
 let user=app.auth(&h,false).await?.user;if !n.valid(){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_NOTE","便利贴格式或尺寸不正确"))}
 let limit=app.config().await?.data.max_notes;let mut db=app.db().await?;let tx=db.transaction().await?;
 tx.execute("select pg_advisory_xact_lock(hashtextextended($1,0))",&[&user.id]).await?;
 if let Some(row)=tx.query_opt(&format!("select {NOTE_COLUMNS} from notes where owner_id=$1 and id=$2"),&[&user.id,&n.id]).await?{return Ok(Json(Note::from_row(&row)))}
 let count:i64=tx.query_one("select count(*) from notes where owner_id=$1",&[&user.id]).await?.get(0);if count>=i64::from(limit){return Err(ApiError::new(StatusCode::CONFLICT,"NOTE_LIMIT","远端便利贴数量已达到上限，本机内容仍然保留"))}
 let row=tx.query_one(&format!("insert into notes(owner_id,id,markdown,color,x,y,width,height,angle,curl,tape,archived) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning {NOTE_COLUMNS}"),&[&user.id,&n.id,&n.markdown,&n.color,&n.x,&n.y,&n.width,&n.height,&n.angle,&n.curl,&n.tape,&n.archived]).await?;let saved=Note::from_row(&row);tx.commit().await?;Ok(Json(saved))
}
pub async fn update(State(app):State<Shared>,h:HeaderMap,Path(id):Path<Uuid>,Json(n):Json<Note>)->Result<Json<Note>>{
 let user=app.auth(&h,false).await?.user;if n.id!=id||!n.valid()||n.version<1{return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_NOTE","便利贴格式不正确"))}
 let row=app.db().await?.query_opt(&format!("update notes set markdown=$3,color=$4,x=$5,y=$6,width=$7,height=$8,angle=$9,curl=$10,tape=$11,archived=$12,version=version+1,updated_at=now() where owner_id=$1 and id=$2 and version=$13 returning {NOTE_COLUMNS}"),&[&user.id,&id,&n.markdown,&n.color,&n.x,&n.y,&n.width,&n.height,&n.angle,&n.curl,&n.tape,&n.archived,&n.version]).await?;
 match row{Some(row)=>Ok(Json(Note::from_row(&row))),None=>Err(conflict(&app,&user.id,&id).await?)}
}
async fn conflict(app:&Shared,owner:&str,id:&Uuid)->Result<ApiError>{
 let row=app.db().await?.query_opt(&format!("select {NOTE_COLUMNS} from notes where owner_id=$1 and id=$2"),&[&owner,&id]).await?;
 Ok(match row{Some(r)=>ApiError{status:StatusCode::CONFLICT,code:"VERSION_CONFLICT",message:"这张便利贴已在其他设备更新，本机草稿仍然保留".into(),current:Some(serde_json::to_value(Note::from_row(&r)).unwrap())},None=>ApiError::new(StatusCode::NOT_FOUND,"NOTE_NOT_FOUND","这张便利贴已在其他设备移除，本机草稿仍然保留")})
}
#[derive(Deserialize)]pub struct Version{version:i64}
pub async fn delete(State(app):State<Shared>,h:HeaderMap,Path(id):Path<Uuid>,Query(q):Query<Version>)->Result<StatusCode>{
 let user=app.auth(&h,false).await?.user;if q.version<1{return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_VERSION","版本不正确"))}
 let changed=app.db().await?.execute("delete from notes where owner_id=$1 and id=$2 and version=$3",&[&user.id,&id,&q.version]).await?;
 if changed==0{let e=conflict(&app,&user.id,&id).await?;if e.status!=StatusCode::NOT_FOUND{return Err(e)}}Ok(StatusCode::NO_CONTENT)
}
pub async fn preferences(State(app):State<Shared>,h:HeaderMap)->Result<Json<Preferences>>{
 let user=app.auth(&h,false).await?.user;let row=app.db().await?.query_opt("select data,version from preferences where owner_id=$1",&[&user.id]).await?;
 Ok(Json(match row{Some(r)=>Preferences{data:r.get(0),version:r.get(1)},None=>Preferences{data:json!({}),version:0}}))
}
pub async fn save_preferences(State(app):State<Shared>,h:HeaderMap,Json(p):Json<Preferences>)->Result<Json<Preferences>>{
 let user=app.auth(&h,false).await?.user;if !p.data.is_object()||p.data.to_string().len()>32768||p.version<0{return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PREFERENCES","设置格式不正确"))}
 let mut db=app.db().await?;let tx=db.transaction().await?;let row=if p.version==0{tx.query_opt("insert into preferences(owner_id,data) values($1,$2) on conflict do nothing returning data,version",&[&user.id,&p.data]).await?}else{tx.query_opt("update preferences set data=$2,version=version+1,updated_at=now() where owner_id=$1 and version=$3 returning data,version",&[&user.id,&p.data,&p.version]).await?};
 match row{Some(r)=>{
  // A versioned preference save and its favorite projection commit together.
  // Guest edits stay local; logged-in retries use the existing optimistic version.
  if let Some(photos)=p.data.get("favoritePhotos").and_then(Value::as_array){
   let ids:Vec<String>=photos.iter().filter_map(|p|p.get("id").and_then(Value::as_str)).filter(|id|valid_photo(id)).take(200).map(str::to_string).collect();
   tx.execute("delete from favorites where owner_id=$1 and not(photo_id=any($2::text[]))",&[&user.id,&ids]).await?;
   tx.execute("insert into favorites(owner_id,photo_id) select $1,photo_id from wallpapers where photo_id=any($2::text[]) on conflict do nothing",&[&user.id,&ids]).await?;
  }
  let saved=Preferences{data:r.get(0),version:r.get(1)};tx.commit().await?;Ok(Json(saved))
 },None=>Err(ApiError::new(StatusCode::CONFLICT,"PREFERENCES_CONFLICT","设置已在其他设备修改，请先重新同步"))}
}
