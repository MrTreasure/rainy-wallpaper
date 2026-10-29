use axum::{Json,extract::State,http::{HeaderMap,HeaderValue,StatusCode,header},response::{IntoResponse,Response}};
use serde::Deserialize;
use serde_json::{Value,json};
use std::{net::IpAddr,time::Duration};
use crate::{Shared,Result,ApiError,model::User,identity_rpc::{RegistrationCodeInput,EmailRegistrationInput}};

#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct CodeInput {email:String}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct RegisterInput {challenge_id:String,code:String,password:String,#[serde(default)]display_name:String}
fn client_ip(headers:&HeaderMap)->Result<String>{headers.get("x-real-ip").and_then(|v|v.to_str().ok()).and_then(|v|v.parse::<IpAddr>().ok()).map(|v|v.to_string()).ok_or_else(||ApiError::new(StatusCode::BAD_REQUEST,"INVALID_CLIENT_IP","请求来源无效，请重新打开页面"))}
fn request<T>(app:&Shared,input:T)->Result<tonic::Request<T>>{
 let mut r=tonic::Request::new(input);r.set_timeout(Duration::from_secs(25));
 r.metadata_mut().insert("authorization",format!("Bearer {}",app.rpc_token).parse().map_err(|_|ApiError::service())?);Ok(r)
}
fn error(status:tonic::Status)->ApiError{
 let (http,code,message)=match status.message(){
  "EMAIL_ALREADY_REGISTERED"=>(StatusCode::CONFLICT,"EMAIL_ALREADY_REGISTERED","这个邮箱已经注册过，可以直接登录"),
  "INVALID_EMAIL"=>(StatusCode::BAD_REQUEST,"INVALID_EMAIL","请输入有效的邮箱地址"),
  "INVALID_INPUT"=>(StatusCode::BAD_REQUEST,"INVALID_INPUT","请检查填写的内容"),
  "INVALID_REGISTRATION_CODE"=>(StatusCode::UNAUTHORIZED,"INVALID_REGISTRATION_CODE","验证码无效或已过期，请重新获取"),
  "WEAK_PASSWORD"=>(StatusCode::BAD_REQUEST,"WEAK_PASSWORD","密码需为 8–20 个字符，且不能是纯数字"),
  "USERNAME_TAKEN"=>(StatusCode::CONFLICT,"USERNAME_TAKEN","这个昵称已被使用，请换一个"),
  "INVALID_USERNAME"=>(StatusCode::BAD_REQUEST,"INVALID_USERNAME","昵称格式不正确，请修改后重试"),
  "RATE_LIMITED"=>(StatusCode::TOO_MANY_REQUESTS,"RATE_LIMITED","操作过于频繁，请稍后再试"),
  "EMAIL_DAILY_QUOTA_EXCEEDED"|"EMAIL_MONTHLY_QUOTA_EXCEEDED"=>(StatusCode::SERVICE_UNAVAILABLE,"EMAIL_QUOTA_EXCEEDED","验证码发送额度已用完，请稍后再试"),
  "EMAIL_DELIVERY_FAILED"|"EMAIL_DELIVERY_UNAVAILABLE"=>(StatusCode::SERVICE_UNAVAILABLE,"EMAIL_DELIVERY_UNAVAILABLE","验证码邮件暂时无法发送，请稍后再试"),
  _=>(StatusCode::SERVICE_UNAVAILABLE,"REGISTRATION_UNAVAILABLE","注册服务暂时不可用，请稍后再试")
 };
 ApiError::new(http,code,message)
}
pub async fn code(State(app):State<Shared>,headers:HeaderMap,Json(input):Json<CodeInput>)->Result<Json<Value>>{
 if !app.config().await?.data.enabled{return Err(ApiError::service())}
 if input.email.len()>254||!input.email.contains('@'){return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_EMAIL","请输入有效的邮箱地址"))}
 let r=request(&app,RegistrationCodeInput{application_id:"rainy-wallpaper".into(),email:input.email,client_ip:client_ip(&headers)?})?;
 let mut client=app.registration.clone();let result=client.request_email_code(r).await.map_err(error)?.into_inner();
 Ok(Json(json!({"challengeId":result.challenge_id,"expiresInSeconds":result.expires_in_seconds})))
}
pub async fn register(State(app):State<Shared>,headers:HeaderMap,Json(input):Json<RegisterInput>)->Result<Response>{
 if !app.config().await?.data.enabled{return Err(ApiError::service())}
 if input.password.len()>128||input.display_name.len()>128||input.challenge_id.len()>64||input.code.len()>6{return Err(ApiError::new(StatusCode::BAD_REQUEST,"INVALID_INPUT","请检查填写的内容"))}
 let r=request(&app,EmailRegistrationInput{application_id:"rainy-wallpaper".into(),client_ip:client_ip(&headers)?,challenge_id:input.challenge_id,code:input.code,password:input.password,display_name:input.display_name})?;
 let mut client=app.registration.clone();let result=client.register_email(r).await.map_err(error)?.into_inner();let u=result.user.ok_or_else(ApiError::service)?;
 if result.application_id!="rainy-wallpaper"||result.session_token.len()<32||result.session_token.len()>512||!result.session_token.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'||c=='_'){return Err(ApiError::service())}
 let user=User{id:u.id,email:u.email,display_name:u.display_name,is_super_admin:u.is_super_admin,avatar_url:u.avatar_url};
 let mut response=Json(json!({"user":user,"applicationId":"rainy-wallpaper"})).into_response();
 let cookie=format!("mrtreasure_session={}; Path=/; Domain=.mrtreasure.cc; Secure; HttpOnly; SameSite=Lax; Max-Age={}",result.session_token,result.expires_in_seconds.min(31*24*60*60));
 response.headers_mut().insert(header::SET_COOKIE,HeaderValue::from_str(&cookie).map_err(|_|ApiError::service())?);Ok(response)
}
