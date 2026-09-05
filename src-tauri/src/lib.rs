use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::Write, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

type R<T> = Result<T, String>;
const VERSION: u32 = 1;
const DEFAULTS: [&str; 6] = ["推广", "包装", "活动", "拓展", "方案", "其他"];

#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Category { id:String, name:String, sort_order:i64 }
#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct FollowUp { id:String, text:String, done:bool }
#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Progress { id:String, content:String, created_at:String }
#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Input { title:String, content:String, category_id:Option<String>, due_date:Option<String>, status:String, notes:String, follow_ups:Vec<FollowUp> }
#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Item { #[serde(flatten)] input:Input, id:String, created_at:String, updated_at:String, deleted_at:Option<String>, progress:Vec<Progress> }
#[derive(Serialize)] #[serde(rename_all="camelCase")]
struct BackupInfo { schema_version:u32, exported_at:String, item_count:usize, category_count:usize }
#[derive(Serialize)] #[serde(rename_all="camelCase")]
struct RestoreResult { safety_backup_path:String, item_count:usize }
#[derive(Serialize)] #[serde(rename_all="camelCase")]
struct AppInfo { data_dir:String, version:String }
#[derive(Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Backup { schema_version:u32, exported_at:String, categories:Vec<Category>, items:Vec<Item> }
struct AppState { dir:PathBuf }
struct Store { c:Connection }

fn fail(s:&str)->String { s.to_string() }
fn stamp()->String { Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true) }
fn check_id(id:&str, label:&str)->R<()> { if id.trim().is_empty() || id.len()>128 {Err(format!("{label}标识无效。"))}else{Ok(())} }
fn text(s:&str,label:&str,max:usize,required:bool)->R<String>{if s.len()>max{Err(format!("{label}不能超过 {max} 个字符。"))}else if required&&s.trim().is_empty(){Err(format!("{label}不能为空。"))}else{Ok(if required{s.trim().into()}else{s.into()})}}
fn valid_input(v:&Input)->R<Input>{
 text(&v.title,"事项标题",200,true)?; text(&v.content,"事项内容",20000,false)?; text(&v.notes,"备注",20000,false)?;
 if !matches!(v.status.as_str(),"todo"|"doing"|"done"|"paused"){return Err(fail("事项状态无效。"))}
 if let Some(d)=&v.due_date { let p=chrono::NaiveDate::parse_from_str(d,"%Y-%m-%d").map_err(|_|fail("截止日期必须为 YYYY-MM-DD。"))?; if p.format("%Y-%m-%d").to_string()!=*d{return Err(fail("截止日期必须为 YYYY-MM-DD。"))} }
 if let Some(id)=&v.category_id {check_id(id,"分类")?}; if v.follow_ups.len()>200{return Err(fail("跟进项不能超过 200 条。"))}
 let mut ids=HashSet::new(); let mut follow_ups=Vec::new();
 for f in &v.follow_ups {check_id(&f.id,"跟进项")?; let t=text(&f.text,"跟进内容",2000,true)?;if !ids.insert(&f.id){return Err(fail("跟进项标识重复。"))};follow_ups.push(FollowUp{id:f.id.clone(),text:t,done:f.done})}
 Ok(Input{title:v.title.trim().into(),content:v.content.clone(),category_id:v.category_id.clone(),due_date:v.due_date.clone(),status:v.status.clone(),notes:v.notes.clone(),follow_ups})
}
fn row_item(r:&rusqlite::Row)->rusqlite::Result<Item>{Ok(Item{id:r.get(0)?,input:Input{title:r.get(1)?,content:r.get(2)?,category_id:r.get(3)?,due_date:r.get(4)?,status:r.get(5)?,notes:r.get(6)?,follow_ups:vec![]},created_at:r.get(7)?,updated_at:r.get(8)?,deleted_at:r.get(9)?,progress:vec![]})}
fn row_cat(r:&rusqlite::Row)->rusqlite::Result<Category>{Ok(Category{id:r.get(0)?,name:r.get(1)?,sort_order:r.get(2)?})}

impl Store {
 fn open(path:PathBuf)->R<Self>{
  fs::create_dir_all(path.parent().ok_or_else(||fail("数据目录无效。"))?).map_err(|_|fail("无法创建本地数据目录。"))?;
  let mut c=Connection::open(path).map_err(|_|fail("无法打开本地数据库。"))?;
  c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,sort_order INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,category_id TEXT,due_date TEXT,status TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT);
 CREATE TABLE IF NOT EXISTS follow_ups(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,text TEXT NOT NULL,done INTEGER NOT NULL,sort_order INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS progress_entries(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,content TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_items_due ON items(due_date); CREATE INDEX IF NOT EXISTS idx_progress ON progress_entries(item_id,created_at DESC);").map_err(|_|fail("无法初始化本地数据库。"))?;
  let done:Option<String>=c.query_row("SELECT v FROM meta WHERE k='defaults'",[],|r|r.get(0)).optional().map_err(|_|fail("无法读取数据库设置。"))?;
  if done.is_none(){let tx=c.transaction().map_err(|_|fail("无法初始化默认分类。"))?;for(i,n)in DEFAULTS.iter().enumerate(){tx.execute("INSERT INTO categories VALUES(?1,?2,?3)",params![Uuid::new_v4().to_string(),n,i as i64]).map_err(|_|fail("无法初始化默认分类。"))?;}tx.execute("INSERT INTO meta VALUES('defaults','1')",[]).map_err(|_|fail("无法初始化默认分类。"))?;tx.commit().map_err(|_|fail("无法初始化默认分类。"))?;}
  Ok(Self{c})
 }
 fn cats(&self)->R<Vec<Category>>{let mut s=self.c.prepare("SELECT id,name,sort_order FROM categories ORDER BY sort_order,id").map_err(|_|fail("无法读取分类。"))?;let x=s.query_map([],row_cat).map_err(|_|fail("无法读取分类。"))?.collect::<Result<_,_>>().map_err(|_|fail("无法读取分类。"));x}
 fn detail(&self,id:&str)->R<Item>{let mut x=self.c.query_row("SELECT id,title,content,category_id,due_date,status,notes,created_at,updated_at,deleted_at FROM items WHERE id=?",[id],row_item).optional().map_err(|_|fail("无法读取事项。"))?.ok_or_else(||fail("未找到该事项。"))?;x.input.follow_ups=self.follow(id)?;x.progress=self.progress(id)?;Ok(x)}
 fn items(&self)->R<Vec<Item>>{let mut s=self.c.prepare("SELECT id,title,content,category_id,due_date,status,notes,created_at,updated_at,deleted_at FROM items ORDER BY due_date IS NULL,due_date,created_at DESC").map_err(|_|fail("无法读取事项。"))?;let v=s.query_map([],row_item).map_err(|_|fail("无法读取事项。"))?.collect::<Result<Vec<_>,_>>().map_err(|_|fail("无法读取事项。"))?;v.into_iter().map(|mut x|{x.input.follow_ups=self.follow(&x.id)?;x.progress=self.progress(&x.id)?;Ok(x)}).collect()}
 fn follow(&self,id:&str)->R<Vec<FollowUp>>{let mut s=self.c.prepare("SELECT id,text,done FROM follow_ups WHERE item_id=? ORDER BY sort_order,id").map_err(|_|fail("无法读取跟进项。"))?;let x=s.query_map([id],|r|Ok(FollowUp{id:r.get(0)?,text:r.get(1)?,done:r.get::<_,i64>(2)?!=0})).map_err(|_|fail("无法读取跟进项。"))?.collect::<Result<_,_>>().map_err(|_|fail("无法读取跟进项。"));x}
 fn progress(&self,id:&str)->R<Vec<Progress>>{let mut s=self.c.prepare("SELECT id,content,created_at FROM progress_entries WHERE item_id=? ORDER BY created_at DESC,id DESC").map_err(|_|fail("无法读取进度。"))?;let x=s.query_map([id],|r|Ok(Progress{id:r.get(0)?,content:r.get(1)?,created_at:r.get(2)?})).map_err(|_|fail("无法读取进度。"))?.collect::<Result<_,_>>().map_err(|_|fail("无法读取进度。"));x}
 fn input(&self,v:Input)->R<Input>{let v=valid_input(&v)?;if let Some(id)=&v.category_id {let n:Option<i64>=self.c.query_row("SELECT 1 FROM categories WHERE id=?",[id],|r|r.get(0)).optional().map_err(|_|fail("无法验证分类。"))?;if n.is_none(){return Err(fail("所选分类不存在或已被删除。"))}}Ok(v)}
 fn write_follows(tx:&Transaction,id:&str,v:&[FollowUp])->R<()>{for(i,f)in v.iter().enumerate(){tx.execute("INSERT INTO follow_ups VALUES(?1,?2,?3,?4,?5)",params![f.id,id,f.text,f.done,i as i64]).map_err(|_|fail("无法保存跟进项。"))?;}Ok(())}
 fn create(&mut self,v:Input)->R<Item>{let v=self.input(v)?;let id=Uuid::new_v4().to_string();let t=stamp();let tx=self.c.transaction().map_err(|_|fail("无法开始保存事项。"))?;tx.execute("INSERT INTO items VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,NULL)",params![id,v.title,v.content,v.category_id,v.due_date,v.status,v.notes,t,t]).map_err(|_|fail("无法保存事项。"))?;Self::write_follows(&tx,&id,&v.follow_ups)?;tx.commit().map_err(|_|fail("无法保存事项。"))?;self.detail(&id)}
 fn update(&mut self,id:&str,v:Input)->R<Item>{check_id(id,"事项")?;let v=self.input(v)?;let tx=self.c.transaction().map_err(|_|fail("无法开始保存事项。"))?;let n=tx.execute("UPDATE items SET title=?2,content=?3,category_id=?4,due_date=?5,status=?6,notes=?7,updated_at=?8 WHERE id=?1",params![id,v.title,v.content,v.category_id,v.due_date,v.status,v.notes,stamp()]).map_err(|_|fail("无法保存事项。"))?;if n==0{return Err(fail("未找到该事项。"))};tx.execute("DELETE FROM follow_ups WHERE item_id=?",[id]).map_err(|_|fail("无法保存跟进项。"))?;Self::write_follows(&tx,id,&v.follow_ups)?;tx.commit().map_err(|_|fail("无法保存事项。"))?;self.detail(id)}
 fn progress_add(&mut self,id:&str,content:&str)->R<Item>{check_id(id,"事项")?;let content=text(content,"进度内容",10000,true)?;let tx=self.c.transaction().map_err(|_|fail("无法开始保存进度。"))?;let n=tx.execute("UPDATE items SET updated_at=?2 WHERE id=?1",params![id,stamp()]).map_err(|_|fail("无法保存进度。"))?;if n==0{return Err(fail("未找到该事项。"))};tx.execute("INSERT INTO progress_entries VALUES(?1,?2,?3,?4)",params![Uuid::new_v4().to_string(),id,content,stamp()]).map_err(|_|fail("无法保存进度。"))?;tx.commit().map_err(|_|fail("无法保存进度。"))?;self.detail(id)}
 fn trash(&mut self,id:&str,deleted:bool)->R<Item>{check_id(id,"事项")?;let n=if deleted{self.c.execute("UPDATE items SET deleted_at=?2,updated_at=?2 WHERE id=?1 AND deleted_at IS NULL",params![id,stamp()])}else{self.c.execute("UPDATE items SET deleted_at=NULL,updated_at=?2 WHERE id=?1 AND deleted_at IS NOT NULL",params![id,stamp()])}.map_err(|_|fail("无法更新事项状态。"))?;if n==0{return Err(fail("未找到对应事项。"))};self.detail(id)}
 fn cat_new(&mut self,name:&str)->R<Vec<Category>>{let name=text(name,"分类名称",50,true)?;let n:i64=self.c.query_row("SELECT COALESCE(MAX(sort_order),-1)+1 FROM categories",[],|r|r.get(0)).map_err(|_|fail("无法读取分类。"))?;self.c.execute("INSERT INTO categories VALUES(?1,?2,?3)",params![Uuid::new_v4().to_string(),name,n]).map_err(|_|fail("分类名称不能重复。"))?;self.cats()}
 fn cat_rename(&mut self,id:&str,name:&str)->R<Vec<Category>>{check_id(id,"分类")?;let n=self.c.execute("UPDATE categories SET name=?2 WHERE id=?1",params![id,text(name,"分类名称",50,true)?]).map_err(|_|fail("分类名称不能重复。"))?;if n==0{return Err(fail("未找到该分类。"))};self.cats()}
 fn cat_delete(&mut self,id:&str)->R<Vec<Category>>{check_id(id,"分类")?;let tx=self.c.transaction().map_err(|_|fail("无法删除分类。"))?;let n=tx.execute("DELETE FROM categories WHERE id=?",[id]).map_err(|_|fail("无法删除分类。"))?;if n==0{return Err(fail("未找到该分类。"))};tx.execute("UPDATE items SET category_id=NULL,updated_at=?2 WHERE category_id=?1",params![id,stamp()]).map_err(|_|fail("无法更新关联事项。"))?;tx.commit().map_err(|_|fail("无法删除分类。"))?;self.cats()}
 fn reorder(&mut self,ids:&[String])->R<Vec<Category>>{let now=self.cats()?;let want:HashSet<_>=now.iter().map(|x|x.id.as_str()).collect();let got:HashSet<_>=ids.iter().map(String::as_str).collect();if ids.len()!=now.len()||got.len()!=ids.len()||got!=want||ids.iter().any(|x|x.is_empty()){return Err(fail("分类排序必须包含全部分类且每个分类只能出现一次。"))};let tx=self.c.transaction().map_err(|_|fail("无法保存分类排序。"))?;for(i,id)in ids.iter().enumerate(){tx.execute("UPDATE categories SET sort_order=?2 WHERE id=?1",params![id,i as i64]).map_err(|_|fail("无法保存分类排序。"))?;}tx.commit().map_err(|_|fail("无法保存分类排序。"))?;self.cats()}
 fn backup(&self)->R<Backup>{Ok(Backup{schema_version:VERSION,exported_at:stamp(),categories:self.cats()?,items:self.items()?})}
 fn restore(&mut self,b:&Backup)->R<()>{validate_backup(b)?;let tx=self.c.transaction().map_err(|_|fail("无法开始恢复数据。"))?;tx.execute("DELETE FROM progress_entries",[]).map_err(|_|fail("恢复失败，原有数据未修改。"))?;tx.execute("DELETE FROM follow_ups",[]).map_err(|_|fail("恢复失败，原有数据未修改。"))?;tx.execute("DELETE FROM items",[]).map_err(|_|fail("恢复失败，原有数据未修改。"))?;tx.execute("DELETE FROM categories",[]).map_err(|_|fail("恢复失败，原有数据未修改。"))?;for c in &b.categories{tx.execute("INSERT INTO categories VALUES(?1,?2,?3)",params![c.id,c.name,c.sort_order]).map_err(|_|fail("备份中的分类无法写入。"))?;}for x in &b.items{tx.execute("INSERT INTO items VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",params![x.id,x.input.title,x.input.content,x.input.category_id,x.input.due_date,x.input.status,x.input.notes,x.created_at,x.updated_at,x.deleted_at]).map_err(|_|fail("备份中的事项无法写入。"))?;Self::write_follows(&tx,&x.id,&x.input.follow_ups)?;for p in &x.progress{tx.execute("INSERT INTO progress_entries VALUES(?1,?2,?3,?4)",params![p.id,x.id,p.content,p.created_at]).map_err(|_|fail("备份中的进度无法写入。"))?;}}tx.commit().map_err(|_|fail("恢复失败，原有数据未修改。"))}
}
fn info(b:&Backup)->BackupInfo{BackupInfo{schema_version:b.schema_version,exported_at:b.exported_at.clone(),item_count:b.items.len(),category_count:b.categories.len()}}
fn validate_backup(b:&Backup)->R<()>{if b.schema_version!=VERSION{return Err(fail("备份版本不受支持。"))};chrono::DateTime::parse_from_rfc3339(&b.exported_at).map_err(|_|fail("备份导出时间无效。"))?;let mut ci=HashSet::new();let mut cn=HashSet::new();let mut si=HashSet::new();let mut all=HashSet::new();for c in &b.categories{check_id(&c.id,"分类")?;text(&c.name,"分类名称",50,true)?;if c.sort_order<0||!ci.insert(&c.id)||!all.insert(&c.id)||!cn.insert(c.name.trim().to_lowercase())||!si.insert(c.sort_order){return Err(fail("备份中的分类数据重复或无效。"))}}for x in &b.items{check_id(&x.id,"事项")?;if !all.insert(&x.id){return Err(fail("备份中的标识重复。"))};valid_input(&x.input)?;if let Some(id)=&x.input.category_id{if !ci.contains(id){return Err(fail("备份中的事项引用了不存在的分类。"))}}for t in [&x.created_at,&x.updated_at]{chrono::DateTime::parse_from_rfc3339(t).map_err(|_|fail("备份中的时间格式无效。"))?;}if let Some(t)=&x.deleted_at{chrono::DateTime::parse_from_rfc3339(t).map_err(|_|fail("备份中的时间格式无效。"))?;}let mut last=None;for p in &x.progress{check_id(&p.id,"进度")?;text(&p.content,"进度内容",10000,true)?;if !all.insert(&p.id){return Err(fail("备份中的标识重复。"))};let time=chrono::DateTime::parse_from_rfc3339(&p.created_at).map_err(|_|fail("备份中的时间格式无效。"))?;if last.map(|v|time>v).unwrap_or(false){return Err(fail("备份中的进度顺序无效。"))};last=Some(time)}for f in &x.input.follow_ups{if !all.insert(&f.id){return Err(fail("备份中的标识重复。"))}}}Ok(())}
fn write(path:&Path,b:&Backup)->R<()>{if path.extension().and_then(|x|x.to_str()).map(|x|x.eq_ignore_ascii_case("json"))!=Some(true)||path.parent().map(Path::is_dir)!=Some(true){return Err(fail("备份文件必须保存为现有目录中的 .json 文件。"))};let tmp=path.with_extension(format!("{}.tmp",Uuid::new_v4()));let bytes=serde_json::to_vec_pretty(b).map_err(|_|fail("无法生成备份文件。"))?;let r=(||->R<()>{let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|_|fail("无法创建备份文件。"))?;f.write_all(&bytes).map_err(|_|fail("无法写入备份文件。"))?;f.sync_all().map_err(|_|fail("无法保存备份文件。"))?;if path.exists(){fs::remove_file(path).map_err(|_|fail("无法覆盖原备份文件。"))?}fs::rename(&tmp,path).map_err(|_|fail("无法完成备份保存。"))?;Ok(())})();if r.is_err(){let _=fs::remove_file(tmp);}r}
fn read(path:&Path)->R<Backup>{if !path.is_file(){return Err(fail("请选择存在的备份文件。"))};let s=fs::read_to_string(path).map_err(|_|fail("无法读取备份文件。"))?;let b=serde_json::from_str::<Backup>(&s).map_err(|_|fail("备份文件不是有效的工作备忘录备份。"))?;validate_backup(&b)?;Ok(b)}
fn store(s:&AppState)->R<Store>{Store::open(s.dir.join("work-memo.sqlite3"))}
fn dir(app:&AppHandle)->R<PathBuf>{if let Some(p)=std::env::var_os("WORK_MEMO_DATA_DIR"){Ok(PathBuf::from(p))}else{app.path().app_data_dir().map_err(|_|fail("无法确定本地数据目录。"))}}
#[tauri::command] fn list_items(s:State<'_,AppState>)->R<Vec<Item>>{store(&s)?.items()}
#[tauri::command] fn list_categories(s:State<'_,AppState>)->R<Vec<Category>>{store(&s)?.cats()}
#[tauri::command] fn create_item(s:State<'_,AppState>,input:Input)->R<Item>{let mut st=store(&s)?;st.create(input)}
#[tauri::command] fn update_item(s:State<'_,AppState>,id:String,input:Input)->R<Item>{let mut st=store(&s)?;st.update(&id,input)}
#[tauri::command] fn add_progress(s:State<'_,AppState>,id:String,content:String)->R<Item>{let mut st=store(&s)?;st.progress_add(&id,&content)}
#[tauri::command] fn trash_item(s:State<'_,AppState>,id:String)->R<()>{let mut st=store(&s)?;st.trash(&id,true).map(|_|())}
#[tauri::command] fn restore_item(s:State<'_,AppState>,id:String)->R<Item>{let mut st=store(&s)?;st.trash(&id,false)}
#[tauri::command] fn create_category(s:State<'_,AppState>,name:String)->R<Vec<Category>>{let mut st=store(&s)?;st.cat_new(&name)}
#[tauri::command] fn rename_category(s:State<'_,AppState>,id:String,name:String)->R<Vec<Category>>{let mut st=store(&s)?;st.cat_rename(&id,&name)}
#[tauri::command] fn delete_category(s:State<'_,AppState>,id:String)->R<Vec<Category>>{let mut st=store(&s)?;st.cat_delete(&id)}
#[tauri::command] fn reorder_categories(s:State<'_,AppState>,ids:Vec<String>)->R<Vec<Category>>{let mut st=store(&s)?;st.reorder(&ids)}
#[tauri::command] fn export_backup(s:State<'_,AppState>,path:String)->R<BackupInfo>{let st=store(&s)?;let b=st.backup()?;write(Path::new(&path),&b)?;Ok(info(&b))}
#[tauri::command] fn inspect_backup(path:String)->R<BackupInfo>{read(Path::new(&path)).map(|b|info(&b))}
#[tauri::command] fn restore_backup(s:State<'_,AppState>,path:String)->R<RestoreResult>{let b=read(Path::new(&path))?;let safety=s.dir.join("backups").join(format!("work-memo-safety-{}-{}.json",Utc::now().format("%Y%m%dT%H%M%S%3fZ"),Uuid::new_v4()));fs::create_dir_all(safety.parent().unwrap()).map_err(|_|fail("无法创建安全备份目录。"))?;let mut st=store(&s)?;let old=st.backup()?;write(&safety,&old)?;st.restore(&b)?;Ok(RestoreResult{safety_backup_path:safety.to_string_lossy().into(),item_count:b.items.len()})}
#[tauri::command] fn app_info(s:State<'_,AppState>)->R<AppInfo>{Ok(AppInfo{data_dir:s.dir.to_string_lossy().into(),version:env!("CARGO_PKG_VERSION").into()})}
pub fn run(){let b=tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_single_instance::init(|a,_,_|{if let Some(w)=a.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}));b.setup(|a|{let d=dir(a.handle()).map_err(std::io::Error::other)?;Store::open(d.join("work-memo.sqlite3")).map_err(std::io::Error::other)?;a.manage(AppState{dir:d});Ok(())}).invoke_handler(tauri::generate_handler![list_items,list_categories,create_item,update_item,add_progress,trash_item,restore_item,create_category,rename_category,delete_category,reorder_categories,export_backup,inspect_backup,restore_backup,app_info]).run(tauri::generate_context!()).expect("无法启动工作备忘录")}

#[cfg(test)] mod tests{use super::*;use tempfile::tempdir;fn input()->Input{Input{title:"A".into(),content:"".into(),category_id:None,due_date:Some("2026-09-10".into()),status:"todo".into(),notes:"".into(),follow_ups:vec![FollowUp{id:"f1".into(),text:"跟进".into(),done:false}]}}#[test]fn persistence_and_history(){let d=tempdir().unwrap();let p=d.path().join("x.db");let mut s=Store::open(p.clone()).unwrap();assert_eq!(s.cats().unwrap().len(),6);let a=s.create(input()).unwrap();s.progress_add(&a.id,"初稿").unwrap();let mut x=s.detail(&a.id).unwrap().input;x.title="B".into();s.update(&a.id,x).unwrap();drop(s);let s=Store::open(p).unwrap();let x=s.detail(&a.id).unwrap();assert_eq!(x.input.title,"B");assert_eq!(x.progress.len(),1)}#[test]fn invalid_backup_changes_nothing(){let d=tempdir().unwrap();let mut s=Store::open(d.path().join("x.db")).unwrap();let x=s.create(input()).unwrap();let p=d.path().join("bad.json");fs::write(&p,"{\"schemaVersion\":1,\"exportedAt\":\"bad\",\"categories\":[],\"items\":[]}").unwrap();assert!(read(&p).is_err());assert_eq!(s.items().unwrap()[0].id,x.id)}#[test]fn restore_safety_content(){let d=tempdir().unwrap();let mut s=Store::open(d.path().join("x.db")).unwrap();let x=s.create(input()).unwrap();let b=s.backup().unwrap();let p=d.path().join("i.json");write(&p,&b).unwrap();let safety=d.path().join("safety.json");write(&safety,&s.backup().unwrap()).unwrap();s.restore(&read(&p).unwrap()).unwrap();assert_eq!(read(&safety).unwrap().items[0].id,x.id)}}
