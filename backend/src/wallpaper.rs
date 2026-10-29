use axum::{Json,extract::{State,Query,Path},http::{HeaderMap,StatusCode}};
use serde::Deserialize;
use serde_json::{json,Value};
use std::time::Duration;
use url::Url;
use crate::{Shared,Result,ApiError,model::*};
#[derive(Deserialize)]pub struct Search{topic:Option<String>,exclude:Option<String>}
#[derive(Deserialize)]#[serde(deny_unknown_fields)]pub struct Photo{id:String}
fn image_url(raw:&str)->Option<Url>{let u=Url::parse(raw).ok()?;if u.scheme()=="https"&&u.host_str()==Some("images.unsplash.com"){Some(u)}else{None}}
fn client_id(h:&HeaderMap)->&str{h.get("x-real-ip").and_then(|v|v.to_str().ok()).unwrap_or("local")}
async fn cached(app:&Shared,topic:&str,exclude:&str,blocked:&Vec<String>)->Result<Vec<Wallpaper>>{
 let rows=app.db().await?.query("select data from wallpapers where topic=$1 and photo_id<>$2 and not(photo_id=any($3::text[])) and coalesce((data->>'width')::int,0)>=2560 and coalesce((data->>'height')::int,0)>=1440 order by (coalesce((data->>'width')::int,0)>=3840 and coalesce((data->>'height')::int,0)>=2160) desc, (fetched_at>now()-interval '4 hours') desc,random() limit 12",&[&topic,&exclude,&blocked]).await?;
 Ok(rows.iter().filter_map(|r|serde_json::from_value(r.get::<_,Value>(0)).ok()).collect())
}
pub async fn list(State(app):State<Shared>,h:HeaderMap,Query(q):Query<Search>)->Result<Json<Value>>{
 let c=app.config().await?.data;if !c.enabled||!c.wallpaper.enabled{return Err(ApiError::new(StatusCode::SERVICE_UNAVAILABLE,"WALLPAPER_DISABLED","壁纸服务暂未开放"))}
 let topic=q.topic.unwrap_or(c.wallpaper.default_topic);if !c.wallpaper.topics.contains(&topic){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_TOPIC","请选择已开放的壁纸主题"))}
 let exclude=q.exclude.unwrap_or_default();if exclude.len()>128{return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PHOTO","壁纸编号不正确"))}
 if !app.rate(format!("photos:{}",client_id(&h)),30,Duration::from_secs(60)){return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS,"RATE_LIMITED","切换太快了，稍后再试"))}
 let _guard=app.photo_lock.lock().await;let mut items=cached(&app,&topic,&exclude,&c.wallpaper.blocked).await?;
 if items.len()<3&&!app.unsplash.is_empty()&&app.rate("unsplash-global".into(),40,Duration::from_secs(3600)){
  if let Ok(fetched)=fetch(&app,&topic).await{let db=app.db().await?;for p in fetched{let data=serde_json::to_value(&p).unwrap();db.execute("insert into wallpapers(photo_id,topic,data) values($1,$2,$3) on conflict(photo_id) do update set topic=excluded.topic,data=excluded.data,fetched_at=now()",&[&p.id,&topic,&data]).await?;}items=cached(&app,&topic,&exclude,&c.wallpaper.blocked).await?}
 }
 if items.is_empty(){return Err(ApiError::new(StatusCode::SERVICE_UNAVAILABLE,"WALLPAPERS_UNAVAILABLE","Unsplash 暂时不可用，当前壁纸会保留"))}Ok(Json(json!({"items":items})))
}
fn topic_query(topic:&str)->String{match topic{
 "forest"=>"misty forest landscape".into(),"ocean"=>"ocean coast beach".into(),
 "mountain"=>"misty mountain landscape".into(),"rain"=>"rainy window street".into(),
 "city"=>"city skyline evening".into(),"flowers"=>"garden flowers".into(),
 "jiangnan"=>"wuzhen".into(),"wilderness"=>"wilderness landscape".into(),
 other=>format!("{other} landscape")}}
async fn fetch(app:&Shared,topic:&str)->std::result::Result<Vec<Wallpaper>,()>{
 let response=app.client.get("https://api.unsplash.com/photos/random").query(&[("query",topic_query(topic)),("orientation","landscape".into()),("content_filter","high".into()),("count","30".into())]).header("Authorization",format!("Client-ID {}",app.unsplash)).header("Accept-Version","v1").send().await.map_err(|_|())?;
 if !response.status().is_success(){return Err(())}let bytes=response.bytes().await.map_err(|_|())?;if bytes.len()>2*1024*1024{return Err(())}let raw:Vec<Value>=serde_json::from_slice(&bytes).map_err(|_|())?;let mut photos=vec![];
 for p in raw{
  let width=p["width"].as_i64().unwrap_or(0);let height=p["height"].as_i64().unwrap_or(0);if width<2560||height<1440{continue}
  let id=p["id"].as_str().unwrap_or("");let regular=p["urls"]["regular"].as_str().unwrap_or("");let thumb=p["urls"]["small"].as_str().unwrap_or("");let original=p["urls"]["raw"].as_str().filter(|raw|image_url(raw).is_some()).unwrap_or(regular);let Some(mut u)=image_url(original)else{continue};if !valid_photo(id)||image_url(thumb).is_none(){continue}
  let mut pairs:Vec<(String,String)>=u.query_pairs().filter(|(k,_)|!["w","q","fit","auto"].contains(&k.as_ref())).map(|(a,b)|(a.into_owned(),b.into_owned())).collect();pairs.extend([("w".into(),"3840".into()),("q".into(),"90".into()),("fit".into(),"max".into()),("auto".into(),"format".into())]);u.query_pairs_mut().clear().extend_pairs(pairs);
  let username=p["user"]["username"].as_str().unwrap_or("");let mut author=Url::parse("https://unsplash.com").unwrap();author.set_path(&format!("/@{username}"));author.set_query(Some("utm_source=rainy_wallpaper&utm_medium=referral"));
  photos.push(Wallpaper{id:id.into(),url:u.to_string(),thumb:thumb.into(),color:p["color"].as_str().unwrap_or("#354038").into(),author:p["user"]["name"].as_str().unwrap_or("Unsplash photographer").into(),author_url:author.to_string(),source_url:format!("https://unsplash.com/photos/{id}?utm_source=rainy_wallpaper&utm_medium=referral"),description:p["alt_description"].as_str().unwrap_or("自然风景").into(),original_url:Some(original.into()),width:Some(width as i32),height:Some(height as i32)});
 }Ok(photos)
}
pub async fn use_photo(State(app):State<Shared>,h:HeaderMap,Json(p):Json<Photo>)->Result<StatusCode>{
 if !valid_photo(&p.id){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PHOTO","壁纸编号不正确"))}
 let exists:bool=app.db().await?.query_one("select exists(select 1 from wallpapers where photo_id=$1)",&[&p.id]).await?.get(0);if !exists{return Err(ApiError::new(StatusCode::NOT_FOUND,"PHOTO_NOT_FOUND","壁纸记录不存在"))}
 let key=format!("download:{}:{}",client_id(&h),p.id);
 if !app.unsplash.is_empty()&&app.rate(key.clone(),1,Duration::from_secs(600)){
  let response=app.client.get(format!("https://api.unsplash.com/photos/{}/download",p.id)).header("Authorization",format!("Client-ID {}",app.unsplash)).header("Accept-Version","v1").send().await;
  if !response.map(|r|r.status().is_success()).unwrap_or(false){if let Ok(mut limits)=app.limits.lock(){limits.remove(&key);}return Err(ApiError::new(StatusCode::BAD_GATEWAY,"TRACKING_UNAVAILABLE","壁纸已显示，来源统计稍后重试"))}
 }Ok(StatusCode::NO_CONTENT)
}
pub async fn favorites(State(app):State<Shared>,h:HeaderMap)->Result<Json<Value>>{let user=app.auth(&h,false).await?.user;let rows=app.db().await?.query("select w.data from favorites f join wallpapers w on w.photo_id=f.photo_id where f.owner_id=$1 order by f.created_at desc limit 200",&[&user.id]).await?;Ok(Json(json!({"items":rows.iter().map(|r|r.get::<_,Value>(0)).collect::<Vec<_>>()})))}
pub async fn add_favorite(State(app):State<Shared>,h:HeaderMap,Json(p):Json<Photo>)->Result<Json<Value>>{let user=app.auth(&h,false).await?.user;if !valid_photo(&p.id){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PHOTO","壁纸编号不正确"))}let count=app.db().await?.execute("insert into favorites(owner_id,photo_id) select $1,photo_id from wallpapers where photo_id=$2 and (select count(*) from favorites where owner_id=$1)<200 on conflict do nothing",&[&user.id,&p.id]).await?;Ok(Json(json!({"saved":count>0})))}
pub async fn delete_favorite(State(app):State<Shared>,h:HeaderMap,Path(id):Path<String>)->Result<StatusCode>{let user=app.auth(&h,false).await?.user;if !valid_photo(&id){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PHOTO","壁纸编号不正确"))}app.db().await?.execute("delete from favorites where owner_id=$1 and photo_id=$2",&[&user.id,&id]).await?;Ok(StatusCode::NO_CONTENT)}


pub async fn download(State(app):State<Shared>,h:HeaderMap,Path(id):Path<String>)->Result<axum::response::Response>{
 use axum::response::{IntoResponse,Redirect};
 if !valid_photo(&id){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_PHOTO","壁纸编号不正确"))}
 let config=app.config().await?.data;
 if !config.enabled||!config.wallpaper.enabled||config.wallpaper.blocked.contains(&id){return Err(ApiError::new(StatusCode::FORBIDDEN,"PHOTO_UNAVAILABLE","这张壁纸暂不可下载"))}
 if !app.rate(format!("wallpaper-download:{}",client_id(&h)),6,Duration::from_secs(60))||!app.rate("wallpaper-download-global".into(),30,Duration::from_secs(60)){return Err(ApiError::new(StatusCode::TOO_MANY_REQUESTS,"RATE_LIMITED","下载太快了，请稍后再试"))}
 let row=app.db().await?.query_opt("select data from wallpapers where photo_id=$1",&[&id]).await?.ok_or_else(||ApiError::new(StatusCode::NOT_FOUND,"PHOTO_NOT_FOUND","壁纸记录不存在"))?;
 let photo:Wallpaper=serde_json::from_value(row.get(0)).map_err(|_|ApiError::service())?;
 let mut url=image_url(photo.original_url.as_deref().unwrap_or(&photo.url)).ok_or_else(ApiError::service)?;
 if app.unsplash.is_empty(){return Err(ApiError::service())}
 let tracked=app.client.get(format!("https://api.unsplash.com/photos/{id}/download")).header("Authorization",format!("Client-ID {}",app.unsplash)).header("Accept-Version","v1").send().await;
 if !tracked.map(|r|r.status().is_success()).unwrap_or(false){return Err(ApiError::new(StatusCode::BAD_GATEWAY,"DOWNLOAD_UNAVAILABLE","壁纸下载暂不可用，请稍后再试"))}
 // The official image CDN supports attachment downloads. Keep image bytes on
 // that connection; the NAS verifies the photo and records the API download.
 let pairs:Vec<(String,String)>=url.query_pairs().filter(|(k,_)|!["w","h","dpr","q","fit","crop","rect","auto","fm","dl"].contains(&k.as_ref())).map(|(a,b)|(a.into_owned(),b.into_owned())).collect();
 url.query_pairs_mut().clear().extend_pairs(pairs).append_pair("fm","jpg").append_pair("q","95").append_pair("dl",&format!("wallpaper-{id}.jpg"));
 Ok(Redirect::temporary(url.as_str()).into_response())
}
