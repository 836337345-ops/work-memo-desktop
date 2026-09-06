use chrono::{Datelike, Duration, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io::Write, path::{Path, PathBuf}, time::Duration as StdDuration};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

type R<T> = Result<T, String>;
const VERSION: u32 = 1;
const DEFAULTS: [&str; 6] = ["推广", "包装", "活动", "拓展", "方案", "其他"];

#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Category { id:String, name:String, sort_order:i64 }
#[derive(Clone, Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct FollowUp { id:String, text:String, done:bool }
#[derive(Clone,Serialize,Deserialize)] #[serde(rename_all="camelCase",deny_unknown_fields)] struct FollowUpTemplate { id:String, category_id:String, name:String, items:Vec<String>, sort_order:i64, created_at:String, updated_at:String }
#[derive(Clone,Serialize,Deserialize)] #[serde(rename_all="camelCase",deny_unknown_fields)] struct FollowUpTemplateInput { category_id:String, name:String, items:Vec<String> }
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
#[derive(Serialize)] #[serde(rename_all="camelCase")]
struct QuickBackupResult { path:String, #[serde(flatten)] info:BackupInfo }
#[derive(Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct WorkItemsExportInput { path:String, statuses:Vec<String>, date_filters:Vec<String>, category_ids:Vec<Option<String>> }
#[derive(Serialize)] #[serde(rename_all="camelCase")]
struct WorkItemsExportResult { path:String, item_count:usize, category_count:usize }
#[derive(Serialize, Deserialize)] #[serde(rename_all="camelCase", deny_unknown_fields)]
struct Backup { schema_version:u32, exported_at:String, categories:Vec<Category>, items:Vec<Item> }
struct AppState { dir:PathBuf }
struct Store { c:Connection }

fn fail(s:&str)->String { s.to_string() }
fn stamp()->String { Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true) }
fn check_id(id:&str, label:&str)->R<()> { if id.trim().is_empty() || id.len()>128 {Err(format!("{label}标识无效。"))}else{Ok(())} }
fn text(s:&str,label:&str,max:usize,required:bool)->R<String>{if s.chars().count()>max{Err(format!("{label}不能超过 {max} 个字符。"))}else if required&&s.trim().is_empty(){Err(format!("{label}不能为空。"))}else{Ok(if required{s.trim().into()}else{s.into()})}}
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
  c.busy_timeout(StdDuration::from_secs(5)).map_err(|_|fail("无法设置本地数据库等待时间。"))?;
  c.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,sort_order INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,category_id TEXT,due_date TEXT,status TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT);
 CREATE TABLE IF NOT EXISTS follow_ups(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,text TEXT NOT NULL,done INTEGER NOT NULL,sort_order INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS progress_entries(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,content TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS follow_up_templates(id TEXT PRIMARY KEY,category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,name TEXT NOT NULL,items_json TEXT NOT NULL,sort_order INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(category_id,name));
 CREATE INDEX IF NOT EXISTS idx_items_due ON items(due_date); CREATE INDEX IF NOT EXISTS idx_progress ON progress_entries(item_id,created_at DESC);").map_err(|_|fail("无法初始化本地数据库。"))?;
  let done:Option<String>=c.query_row("SELECT v FROM meta WHERE k='defaults'",[],|r|r.get(0)).optional().map_err(|_|fail("无法读取数据库设置。"))?;
  if done.is_none(){let tx=c.transaction().map_err(|_|fail("无法初始化默认分类。"))?;for(i,n)in DEFAULTS.iter().enumerate(){tx.execute("INSERT INTO categories VALUES(?1,?2,?3)",params![Uuid::new_v4().to_string(),n,i as i64]).map_err(|_|fail("无法初始化默认分类。"))?;}tx.execute("INSERT INTO meta VALUES('defaults','1')",[]).map_err(|_|fail("无法初始化默认分类。"))?;tx.commit().map_err(|_|fail("无法初始化默认分类。"))?;}
  Ok(Self{c})
 }
 fn cats(&self)->R<Vec<Category>>{let mut s=self.c.prepare("SELECT id,name,sort_order FROM categories ORDER BY sort_order,id").map_err(|_|fail("无法读取分类。"))?;let x=s.query_map([],row_cat).map_err(|_|fail("无法读取分类。"))?.collect::<Result<_,_>>().map_err(|_|fail("无法读取分类。"));x}
 fn templates(&self)->R<Vec<FollowUpTemplate>>{let mut s=self.c.prepare("SELECT id,category_id,name,items_json,sort_order,created_at,updated_at FROM follow_up_templates ORDER BY category_id,sort_order,id").map_err(|_|fail("无法读取模板。"))?;s.query_map([],|r|Ok(FollowUpTemplate{id:r.get(0)?,category_id:r.get(1)?,name:r.get(2)?,items:serde_json::from_str(&r.get::<_,String>(3)?).unwrap_or_default(),sort_order:r.get(4)?,created_at:r.get(5)?,updated_at:r.get(6)?})).map_err(|_|fail("无法读取模板。"))?.collect::<Result<_,_>>().map_err(|_|fail("无法读取模板。"))}
 fn template_new(&mut self,v:FollowUpTemplateInput)->R<Vec<FollowUpTemplate>>{check_id(&v.category_id,"分类")?;let name=text(&v.name,"模板名称",100,true)?;if v.items.is_empty()||v.items.iter().any(|x|text(x,"模板项",2000,true).is_err()){return Err(fail("模板清单不能为空且每项必须有文字。"))};let n:i64=self.c.query_row("SELECT COALESCE(MAX(sort_order),-1)+1 FROM follow_up_templates WHERE category_id=?",[&v.category_id],|r|r.get(0)).unwrap_or(0);self.c.execute("INSERT INTO follow_up_templates VALUES(?1,?2,?3,?4,?5,?6,?7)",params![Uuid::new_v4().to_string(),v.category_id,name,serde_json::to_string(&v.items).unwrap(),n,stamp(),stamp()]).map_err(|_|fail("同一分类内模板名称不能重复。"))?;self.templates()}
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
fn atomic_write(path:&Path,bytes:&[u8],label:&str)->R<()>{let parent=path.parent().filter(|p|p.is_dir()).ok_or_else(||format!("{label}必须保存到现有目录。"))?;let name=path.file_name().and_then(|v|v.to_str()).filter(|v|!v.is_empty()).ok_or_else(||format!("{label}路径无效。"))?;let tmp=parent.join(format!(".{name}.{}.tmp",Uuid::new_v4()));let r=(||->R<()>{let mut f=fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|_|format!("无法创建{label}。"))?;f.write_all(bytes).map_err(|_|format!("无法写入{label}。"))?;f.sync_all().map_err(|_|format!("无法保存{label}。"))?;if path.exists(){let previous=parent.join(format!(".{name}.{}.previous",Uuid::new_v4()));fs::rename(path,&previous).map_err(|_|format!("无法替换原{label}。"))?;if let Err(_) = fs::rename(&tmp,path){let _=fs::rename(&previous,path);return Err(format!("无法完成{label}保存。"))}let _=fs::remove_file(previous);}else{fs::rename(&tmp,path).map_err(|_|format!("无法完成{label}保存。"))?}Ok(())})();if r.is_err(){let _=fs::remove_file(&tmp);}r}
fn write(path:&Path,b:&Backup)->R<()>{if path.extension().and_then(|x|x.to_str()).map(|x|x.eq_ignore_ascii_case("json"))!=Some(true){return Err(fail("备份文件必须保存为 .json 文件。"))};let bytes=serde_json::to_vec_pretty(b).map_err(|_|fail("无法生成备份文件。"))?;atomic_write(path,&bytes,"备份文件")}
fn read(path:&Path)->R<Backup>{if !path.is_file(){return Err(fail("请选择存在的备份文件。"))};let s=fs::read_to_string(path).map_err(|_|fail("无法读取备份文件。"))?;let b=serde_json::from_str::<Backup>(&s).map_err(|_|fail("备份文件不是有效的工作备忘录备份。"))?;validate_backup(&b)?;Ok(b)}
fn valid_export_input(st:&Store,input:&WorkItemsExportInput)->R<()> {for status in &input.statuses{if !matches!(status.as_str(),"todo"|"doing"|"done"|"paused"){return Err(fail("导出状态筛选无效。"))}}for filter in &input.date_filters{if !matches!(filter.as_str(),"all"|"today"|"thisWeek"|"nextWeek"|"thisMonth"|"nextMonth"|"history"|"overdue"){return Err(fail("导出时间筛选无效。"))}}let categories=st.cats()?;let ids:HashSet<&str>=categories.iter().map(|c|c.id.as_str()).collect();for id in input.category_ids.iter().flatten(){if !ids.contains(id.as_str()){return Err(fail("导出分类不存在或已被删除。"))}}Ok(())}
fn month_start(date:NaiveDate)->NaiveDate{NaiveDate::from_ymd_opt(date.year(),date.month(),1).expect("valid month")}
fn following_month(date:NaiveDate)->NaiveDate{let start=month_start(date);if start.month()==12{NaiveDate::from_ymd_opt(start.year()+1,1,1).expect("valid next month")}else{NaiveDate::from_ymd_opt(start.year(),start.month()+1,1).expect("valid next month")}}
fn matches_date_filter(filter:&str,due:Option<NaiveDate>,status:&str,today:NaiveDate)->bool{let Some(due)=due else{return false};let week_start=today-Duration::days(today.weekday().num_days_from_monday() as i64);let next_week=week_start+Duration::days(7);let this_month=month_start(today);let next_month=following_month(today);match filter{"today"=>due==today,"thisWeek"=>due>=week_start&&due<next_week,"nextWeek"=>due>=next_week&&due<next_week+Duration::days(7),"thisMonth"=>due>=this_month&&due<next_month,"nextMonth"=>{let after_next=following_month(next_month);due>=next_month&&due<after_next},"history"=>due<today,"overdue"=>due<today&&matches!(status,"todo"|"doing"),_=>false}}
fn matches_export_dates(filters:&[String],due:Option<NaiveDate>,status:&str,today:NaiveDate)->bool{filters.is_empty()||filters.iter().any(|filter|filter=="all")||filters.iter().any(|filter|matches_date_filter(filter,due,status,today))}
fn export_date(date:Option<&String>)->String{date.and_then(|v|NaiveDate::parse_from_str(v,"%Y-%m-%d").ok()).map(|v|format!("{}年{}月{}日",v.year(),v.month(),v.day())).unwrap_or_else(||"未设日期".into())}
fn chinese_number(n:usize)->String{const DIGITS:[&str;10]=["零","一","二","三","四","五","六","七","八","九"];if n==0{return DIGITS[0].into()}if n<10{return DIGITS[n].into()}if n<20{return format!("十{}",if n==10{""}else{DIGITS[n%10]})}if n<100{return format!("{}十{}",DIGITS[n/10],if n%10==0{""}else{DIGITS[n%10]})}n.to_string()}
fn write_export_group(out:&mut String,ordinal:usize,name:&str,items:&[&Item]){out.push_str(&format!("{}、{}\n",chinese_number(ordinal),name));for(index,item)in items.iter().enumerate(){let ending=if index+1==items.len(){"。"}else{"；"};let progress=item.progress.first().map(|value|value.content.as_str()).unwrap_or("暂无最新进度");out.push_str(&format!("{}、{}，{}，{}{}\n",index+1,export_date(item.input.due_date.as_ref()),item.input.title,progress,ending));}out.push('\n');}
fn export_txt_at(st:&Store,input:&WorkItemsExportInput,today:NaiveDate)->R<WorkItemsExportResult>{if Path::new(&input.path).extension().and_then(|x|x.to_str()).map(|x|x.eq_ignore_ascii_case("txt"))!=Some(true){return Err(fail("导出文件必须为 .txt。"))}valid_export_input(st,input)?;let categories=st.cats()?;let mut items=st.items()?.into_iter().filter(|item|item.deleted_at.is_none()).filter(|item|input.statuses.is_empty()||input.statuses.contains(&item.input.status)).filter(|item|input.category_ids.is_empty()||input.category_ids.contains(&item.input.category_id)).filter(|item|matches_export_dates(&input.date_filters,item.input.due_date.as_ref().and_then(|value|NaiveDate::parse_from_str(value,"%Y-%m-%d").ok()),&item.input.status,today)).collect::<Vec<_>>();items.sort_by(|a,b|match (&a.input.due_date,&b.input.due_date){(Some(left),Some(right))=>left.cmp(right).then_with(||b.created_at.cmp(&a.created_at)),(Some(_),None)=>std::cmp::Ordering::Less,(None,Some(_))=>std::cmp::Ordering::Greater,(None,None)=>b.created_at.cmp(&a.created_at)});let mut out=String::new();let mut ordinal=1;for category in &categories{let group=items.iter().filter(|item|item.input.category_id.as_deref()==Some(category.id.as_str())).collect::<Vec<_>>();if !group.is_empty(){write_export_group(&mut out,ordinal,&category.name,&group);ordinal+=1;}}let unclassified=items.iter().filter(|item|item.input.category_id.is_none()).collect::<Vec<_>>();if !unclassified.is_empty(){write_export_group(&mut out,ordinal,"未分类",&unclassified);ordinal+=1;}atomic_write(Path::new(&input.path),out.as_bytes(),"导出文件")?;Ok(WorkItemsExportResult{path:input.path.clone(),item_count:items.len(),category_count:ordinal-1})}
fn export_txt(st:&Store,input:&WorkItemsExportInput)->R<WorkItemsExportResult>{export_txt_at(st,input,Local::now().date_naive())}
fn quick_backup_at(st:&Store,dir:&Path,today:NaiveDate)->R<QuickBackupResult>{let backup=st.backup()?;let backup_dir=dir.join("备份");fs::create_dir_all(&backup_dir).map_err(|_|fail("无法创建备份目录。"))?;let mut suffix=1;let path=loop{let name=if suffix==1{format!("工作备份文件{}.json",today.format("%Y%m%d"))}else{format!("工作备份文件{}-{}.json",today.format("%Y%m%d"),suffix)};let candidate=backup_dir.join(name);if !candidate.exists(){break candidate}suffix+=1;};write(&path,&backup)?;Ok(QuickBackupResult{path:path.to_string_lossy().into(),info:info(&backup)})}
fn store(s:&AppState)->R<Store>{Store::open(s.dir.join("work-memo.sqlite3"))}
fn dir(app:&AppHandle)->R<PathBuf>{if let Some(p)=std::env::var_os("WORK_MEMO_DATA_DIR"){Ok(PathBuf::from(p))}else{app.path().app_data_dir().map_err(|_|fail("无法确定本地数据目录。"))}}
#[tauri::command] fn list_items(s:State<'_,AppState>)->R<Vec<Item>>{store(&s)?.items()}
#[tauri::command] fn list_categories(s:State<'_,AppState>)->R<Vec<Category>>{store(&s)?.cats()}
#[tauri::command] fn list_follow_up_templates(s:State<'_,AppState>)->R<Vec<FollowUpTemplate>>{store(&s)?.templates()}
#[tauri::command] fn create_follow_up_template(s:State<'_,AppState>,input:FollowUpTemplateInput)->R<Vec<FollowUpTemplate>>{let mut st=store(&s)?;st.template_new(input)}
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
#[tauri::command] fn quick_backup(s:State<'_,AppState>)->R<QuickBackupResult>{quick_backup_at(&store(&s)?,&s.dir,Local::now().date_naive())}
#[tauri::command] fn export_work_items(s:State<'_,AppState>,input:WorkItemsExportInput)->R<WorkItemsExportResult>{export_txt(&store(&s)?,&input)}
#[tauri::command] fn inspect_backup(path:String)->R<BackupInfo>{read(Path::new(&path)).map(|b|info(&b))}
#[tauri::command] fn restore_backup(s:State<'_,AppState>,path:String)->R<RestoreResult>{let b=read(Path::new(&path))?;let safety=s.dir.join("backups").join(format!("work-memo-safety-{}-{}.json",Utc::now().format("%Y%m%dT%H%M%S%3fZ"),Uuid::new_v4()));fs::create_dir_all(safety.parent().unwrap()).map_err(|_|fail("无法创建安全备份目录。"))?;let mut st=store(&s)?;let old=st.backup()?;write(&safety,&old)?;st.restore(&b)?;Ok(RestoreResult{safety_backup_path:safety.to_string_lossy().into(),item_count:b.items.len()})}
#[tauri::command] fn app_info(s:State<'_,AppState>)->R<AppInfo>{Ok(AppInfo{data_dir:s.dir.to_string_lossy().into(),version:env!("CARGO_PKG_VERSION").into()})}
pub fn run(){let b=tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_single_instance::init(|a,_,_|{if let Some(w)=a.get_webview_window("main"){let _=w.show();let _=w.set_focus();}}));b.setup(|a|{let d=dir(a.handle()).map_err(std::io::Error::other)?;Store::open(d.join("work-memo.sqlite3")).map_err(std::io::Error::other)?;a.manage(AppState{dir:d});Ok(())}).invoke_handler(tauri::generate_handler![list_items,list_categories,list_follow_up_templates,create_follow_up_template,create_item,update_item,add_progress,trash_item,restore_item,create_category,rename_category,delete_category,reorder_categories,export_backup,quick_backup,export_work_items,inspect_backup,restore_backup,app_info]).run(tauri::generate_context!()).expect("无法启动工作备忘录")}

#[cfg(test)] mod tests{use super::*;use tempfile::tempdir;fn input()->Input{Input{title:"A".into(),content:"".into(),category_id:None,due_date:Some("2026-09-10".into()),status:"todo".into(),notes:"".into(),follow_ups:vec![FollowUp{id:"f1".into(),text:"跟进".into(),done:false}]}}#[test]fn persistence_and_history(){let d=tempdir().unwrap();let p=d.path().join("x.db");let mut s=Store::open(p.clone()).unwrap();assert_eq!(s.cats().unwrap().len(),6);let a=s.create(input()).unwrap();s.progress_add(&a.id,"初稿").unwrap();let mut x=s.detail(&a.id).unwrap().input;x.title="B".into();s.update(&a.id,x).unwrap();drop(s);let s=Store::open(p).unwrap();let x=s.detail(&a.id).unwrap();assert_eq!(x.input.title,"B");assert_eq!(x.progress.len(),1)}#[test]fn invalid_backup_changes_nothing(){let d=tempdir().unwrap();let mut s=Store::open(d.path().join("x.db")).unwrap();let x=s.create(input()).unwrap();let p=d.path().join("bad.json");fs::write(&p,"{\"schemaVersion\":1,\"exportedAt\":\"bad\",\"categories\":[],\"items\":[]}").unwrap();assert!(read(&p).is_err());assert_eq!(s.items().unwrap()[0].id,x.id)}#[test]fn restore_safety_content(){let d=tempdir().unwrap();let mut s=Store::open(d.path().join("x.db")).unwrap();let x=s.create(input()).unwrap();let b=s.backup().unwrap();let p=d.path().join("i.json");write(&p,&b).unwrap();let safety=d.path().join("safety.json");write(&safety,&s.backup().unwrap()).unwrap();s.restore(&read(&p).unwrap()).unwrap();assert_eq!(read(&safety).unwrap().items[0].id,x.id)}}

#[cfg(test)]
mod export_tests {
    use super::*;
    use tempfile::tempdir;

    fn day(value: &str) -> NaiveDate { NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap() }
    fn export_input(path: PathBuf) -> WorkItemsExportInput { WorkItemsExportInput { path: path.to_string_lossy().into(), statuses: vec![], date_filters: vec![], category_ids: vec![] } }
    fn item(title: &str, category_id: Option<String>, due_date: Option<&str>, status: &str) -> Input {
        Input { title: title.into(), content: String::new(), category_id, due_date: due_date.map(str::to_owned), status: status.into(), notes: String::new(), follow_ups: vec![] }
    }

    #[test]
    fn date_filters_cover_local_calendar_boundaries() {
        let today = day("2026-09-06"); // Sunday; this week begins on Monday, August 31.
        assert!(matches_date_filter("today", Some(today), "done", today));
        assert!(matches_date_filter("thisWeek", Some(day("2026-08-31")), "done", today));
        assert!(!matches_date_filter("thisWeek", Some(day("2026-09-07")), "done", today));
        assert!(matches_date_filter("nextWeek", Some(day("2026-09-07")), "done", today));
        assert!(!matches_date_filter("nextWeek", Some(day("2026-09-14")), "done", today));
        assert!(matches_date_filter("thisMonth", Some(day("2026-09-30")), "done", today));
        assert!(matches_date_filter("nextMonth", Some(day("2026-10-01")), "done", today));
        assert!(!matches_date_filter("nextMonth", Some(day("2026-11-01")), "done", today));
        assert!(matches_date_filter("history", Some(day("2026-09-05")), "paused", today));
        assert!(matches_date_filter("overdue", Some(day("2026-09-05")), "todo", today));
        assert!(matches_date_filter("overdue", Some(day("2026-09-05")), "doing", today));
        assert!(!matches_date_filter("overdue", Some(day("2026-09-05")), "done", today));
        assert!(matches_export_dates(&["all".into(), "overdue".into()], None, "done", today));
    }

    #[test]
    fn export_groups_orders_and_formats_live_items() {
        let dir = tempdir().unwrap();
        let mut store = Store::open(dir.path().join("memo.sqlite3")).unwrap();
        let categories = store.cats().unwrap();
        let promotion = categories.iter().find(|category| category.name == "推广").unwrap().id.clone();
        let packaging = categories.iter().find(|category| category.name == "包装").unwrap().id.clone();
        let first = store.create(item("推广早", Some(promotion.clone()), Some("2026-09-02"), "todo")).unwrap();
        store.progress_add(&first.id, "已沟通").unwrap();
        store.create(item("推广晚", Some(promotion), Some("2026-09-04"), "doing")).unwrap();
        store.create(item("包装事项", Some(packaging), Some("2026-09-01"), "done")).unwrap();
        store.create(item("未分类事项", None, None, "paused")).unwrap();
        let deleted = store.create(item("不应导出", None, Some("2026-09-03"), "todo")).unwrap();
        store.trash(&deleted.id, true).unwrap();
        let output = dir.path().join("items.txt");
        let input = export_input(output.clone());
        let result = export_txt_at(&store, &input, day("2026-09-06")).unwrap();
        export_txt_at(&store, &input, day("2026-09-06")).unwrap();
        assert_eq!(result.item_count, 4);
        assert_eq!(result.category_count, 3);
        assert_eq!(fs::read_to_string(output).unwrap(), "一、推广\n1、2026年9月2日，推广早，已沟通；\n2、2026年9月4日，推广晚，暂无最新进度。\n\n二、包装\n1、2026年9月1日，包装事项，暂无最新进度。\n\n三、未分类\n1、未设日期，未分类事项，暂无最新进度。\n\n");
    }

    #[test]
    fn export_rejects_invalid_filters_and_unknown_categories() {
        let dir = tempdir().unwrap();
        let store = Store::open(dir.path().join("memo.sqlite3")).unwrap();
        let output = dir.path().join("items.txt");
        let mut invalid_date = export_input(output.clone());
        invalid_date.date_filters.push("tomorrow".into());
        assert!(export_txt_at(&store, &invalid_date, day("2026-09-06")).is_err());
        let mut invalid_status = export_input(output.clone());
        invalid_status.statuses.push("unknown".into());
        assert!(export_txt_at(&store, &invalid_status, day("2026-09-06")).is_err());
        let mut missing_category = export_input(output);
        missing_category.category_ids.push(Some("gone".into()));
        assert!(export_txt_at(&store, &missing_category, day("2026-09-06")).is_err());
    }

    #[test]
    fn quick_backup_uses_first_name_then_a_non_overwriting_suffix() {
        let dir = tempdir().unwrap();
        let store = Store::open(dir.path().join("memo.sqlite3")).unwrap();
        let today = day("2026-09-06");
        let first = quick_backup_at(&store, dir.path(), today).unwrap();
        let second = quick_backup_at(&store, dir.path(), today).unwrap();
        assert_eq!(Path::new(&first.path).file_name().unwrap(), "工作备份文件20260906.json");
        assert_eq!(Path::new(&second.path).file_name().unwrap(), "工作备份文件20260906-2.json");
        assert!(Path::new(&first.path).is_file() && Path::new(&second.path).is_file());
        assert_eq!(first.info.category_count, 6);
    }
}
