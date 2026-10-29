use serde::{Deserialize,Serialize};

#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct User {pub id:String,pub display_name:Option<String>,pub email:Option<String>,pub is_super_admin:bool,pub avatar_url:Option<String>}
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Session {pub user:User,pub application_id:String}
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct SoundPolicy{pub enabled:bool,pub allowed:Vec<String>,pub master_limit:f64,pub random_enabled:bool,pub variation_max:f64,pub thunder_limit:f64}
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct WallpaperPolicy{pub enabled:bool,pub topics:Vec<String>,pub default_topic:String,pub blocked:Vec<String>,pub allow_auto:bool,pub interval_minutes:i32}
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct Config{pub enabled:bool,pub max_notes:i32,pub default_paper_color:String,pub sound:SoundPolicy,pub wallpaper:WallpaperPolicy}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct ConfigRecord{pub data:Config,pub version:i64,pub unsplash_configured:bool}
#[derive(Clone,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Wallpaper{pub id:String,pub url:String,pub thumb:String,pub color:String,pub author:String,pub author_url:String,pub source_url:String,pub description:String,#[serde(default)]pub original_url:Option<String>,#[serde(default)]pub width:Option<i32>,#[serde(default)]pub height:Option<i32>}
impl Default for Config{
 fn default()->Self{Self{enabled:true,max_notes:60,default_paper_color:"#f2de8e".into(),sound:SoundPolicy{enabled:true,allowed:["rain","wind","thunder","stream","ocean"].iter().map(|v|v.to_string()).collect(),master_limit:0.85,random_enabled:true,variation_max:0.65,thunder_limit:0.55},wallpaper:WallpaperPolicy{enabled:true,topics:["forest","ocean","mountain","rain","city","flowers","jiangnan","wilderness"].iter().map(|v|v.to_string()).collect(),default_topic:"forest".into(),blocked:vec![],allow_auto:false,interval_minutes:30}}}
}
impl Config{
 pub fn valid(&self)->bool{(1..=300).contains(&self.max_notes)&&valid_color(&self.default_paper_color)&&within(self.sound.master_limit,0.,1.)&&within(self.sound.variation_max,0.,1.)&&within(self.sound.thunder_limit,0.,1.)&&self.sound.allowed.len()<=5&&self.sound.allowed.iter().all(|v|["rain","wind","thunder","stream","ocean"].contains(&v.as_str()))&&(1..=20).contains(&self.wallpaper.topics.len())&&self.wallpaper.topics.iter().all(|v|!v.is_empty()&&v.len()<=48&&v.chars().all(|c|c.is_ascii_alphabetic()||c==' '||c=='-'))&&self.wallpaper.topics.contains(&self.wallpaper.default_topic)&&self.wallpaper.blocked.len()<=1000&&self.wallpaper.blocked.iter().all(|v|valid_photo(v))&&(5..=240).contains(&self.wallpaper.interval_minutes)}
}
pub fn valid_photo(v:&str)->bool{!v.is_empty()&&v.len()<=128&&v.chars().all(|c|c.is_ascii_alphanumeric()||c=='_'||c=='-')}
pub fn valid_color(v:&str)->bool{v.len()==7&&v.starts_with('#')&&v[1..].chars().all(|c|c.is_ascii_hexdigit())}
fn within(v:f64,min:f64,max:f64)->bool{v.is_finite()&&v>=min&&v<=max}
