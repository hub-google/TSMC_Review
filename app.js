(() => {
"use strict";
const $ = id => document.getElementById(id);
const label = {1:"雙項達標",2:"新客未達",3:"雙項未達",4:"FYC 未達"};
const roman = {1:"Ⅰ",2:"Ⅱ",3:"Ⅲ",4:"Ⅳ"};
const statusMap = {1:[true,true],2:[true,false],3:[false,false],4:[false,true]};
const qCss = q => "q"+q;
const fmt = n => Number(n||0).toLocaleString("zh-TW",{maximumFractionDigits:0});
const money = n => Math.abs(n)>=10000?(Number(n)/10000).toLocaleString("zh-TW",{maximumFractionDigits:1})+" 萬":fmt(n);
const e = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const serial = s => Number.isFinite(Number(s))&&Number(s)>1000?new Date(Date.UTC(1899,11,30)+Math.floor(Number(s))*86400000).toISOString().slice(0,10):"—";
let offices = [],region = "all", query="", activeKey="",lastFocus=null;
let data = null;
function officeKey(o){return o.region+"::"+o.office}
function normalize(raw) {
  const [region,area,office,factory,date,fyc,fycGap,clients,clientGap,quadrant]=raw;
  const q=Number(quadrant), s=statusMap[q]||[Number(fycGap)>=0,Number(clientGap)>=0];
  return {region:String(region??""),area:String(area??""),office:String(office??""),factory:String(factory??""),date,fyc:Number(fyc)||0,fycGap:Number(fycGap)||0,clients:Number(clients)||0,clientGap:Number(clientGap)||0,quadrant:q||((s[0]?1:3)+(s[1]?0:1)),fycOK:s[0],clientOK:s[1]};
}
function aggregate(raw) {
  const g=new Map();
  raw.map(normalize).filter(f=>f.region&&f.office).forEach(f=>{
    const k=f.region+"::"+f.office;
    if(!g.has(k))g.set(k,{region:f.region,office:f.office,areas:new Set(),factories:[],fyc:0,clients:0,fycOK:true,clientOK:true,fycGap:0,clientGap:0});
    const o=g.get(k);o.areas.add(f.area);o.factories.push(f);o.fyc+=f.fyc;o.clients+=f.clients;
    o.fycOK=o.fycOK&&f.fycOK;o.clientOK=o.clientOK&&f.clientOK;
    o.fycGap+=Math.min(0,f.fycGap);o.clientGap+=Math.min(0,f.clientGap);
  });
  return [...g.values()].map(o=>({...o,areas:[...o.areas],q:o.fycOK?(o.clientOK?1:2):(o.clientOK?4:3)}))
    .sort((a,b)=>a.region.localeCompare(b.region,"zh-Hant")||a.office.localeCompare(b.office,"zh-Hant"));
}
function relevant(o) {const s=[o.region,o.office,...o.areas,...o.factories.map(f=>f.factory)].join(" ").toLowerCase();return s.includes(query.toLowerCase());}
function displayed(){return offices.filter(o=>region==="all"||o.region===region)}
function counts(arr){return [1,2,3,4].map(q=>arr.filter(x=>x.q===q).length)}
function paintStats(){
  const arr=displayed(),c=counts(arr),notOk=c[1]+c[2]+c[3];
  const boxes=[
    ["通訊處總數",arr.length,"個","依通訊處去重"],
    ["雙項達標",c[0],"個","第一象限"],
    ["需關注",notOk,"個","至少一項未達標"],
    ["雙項未達",c[2],"個","第三象限"]
  ];
  $("stats").innerHTML=boxes.map((v,i)=>'<div class="stat '+(i===2||i===3?'warn':'')+'"><small>'+v[0]+'</small><strong>'+fmt(v[1])+'<em>'+v[2]+'</em></strong><div class="sub">'+v[3]+'</div></div>').join("");
}
function drawTabs(){
 const regions=[...new Set(offices.map(o=>o.region))];
 $("tabs").innerHTML=[{k:"all",n:"各區一覽"},...regions.map(r=>({k:r,n:r.replace("區域","")}))].map(t=>'<button type="button" class="tab '+(t.k===region?'on':'')+'" data-region="'+e(t.k)+'">'+e(t.n)+'</button>').join("");
 $("tabs").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{region=btn.dataset.region;paint();window.scrollTo({top:0,behavior:"smooth"})}));
}
function quadrantMarkup(q,ar){
 const members=ar.filter(o=>o.q===q).sort((a,b)=>b.factories.length-a.factories.length||b.fyc-a.fyc);
 const maxCols=members.length>=7?3:members.length>=3?2:1, nrows=Math.ceil(members.length/maxCols);
 const dots=members.map((o,i)=>{
    const col=i%maxCols, row=Math.floor(i/maxCols);
    const x=(col+1)/(maxCols+1)*100, y=members.length===1?56:(row+1)/(nrows+1)*78+13;
    const hit=relevant(o),active=activeKey===officeKey(o);
    const title=o.office+"｜"+label[q]+"｜"+o.factories.length+" 個廠區";
    return '<button type="button" class="dot '+(hit?'':'is-search-miss ')+(active?'active':'')+'" style="left:'+x+'%;top:'+Math.min(y,90)+'%" data-key="'+e(officeKey(o))+'" title="'+e(title)+'" aria-label="'+e(title)+'"><span class="circle"></span><span class="name">'+e(o.office)+'</span>'+(o.factories.length>1?'<span class="factory-count">'+o.factories.length+' 廠</span>':'')+'</button>';
 }).join("");
 return '<div class="quad '+qCss(q)+'"><div class="qh"><span>'+roman[q]+' '+label[q]+'</span><small>'+members.length+'</small></div>'+(!members.length?'<div class="quad-empty">無資料</div>':'')+dots+'</div>';
}
function panel(regionName, ar, isSingle){
 const c=counts(ar);
 return '<article class="panel '+(isSingle?'single':'')+'"><div class="panelhead"><div><h3>'+e(regionName)+'</h3><div class="count">'+ar.length+' 個通訊處 · '+ar.reduce((s,o)=>s+o.factories.length,0)+' 個廠區紀錄</div></div>'+(isSingle?'':'<button type="button" class="expand" data-open-region="'+e(regionName)+'">放大查看 ↗</button>')+'</div><div class="quad-layout"><div class="yaxis"><span>新客戶 未達 → 達標</span></div><div class="quad-grid">'+[4,1,3,2].map(q=>quadrantMarkup(q,ar)).join("")+'</div><div class="xaxis">累月 FYC　未達標 ←　→ 達標</div></div><div class="region-foot"><span>每個通訊處一個點 · 點選查看各廠區明細</span><div class="pills">'+c.map((n,i)=>'<span class="pill q'+(i+1)+'">'+roman[i+1]+' '+n+'</span>').join("")+'</div></div></article>';
}
function paintDashboard(){
 const arr=displayed(),regions=region==="all"?[...new Set(offices.map(o=>o.region))]:[region];
 $("dashboard").className="dashboard"+(region!=="all"?" single":"");
 $("dashboard").innerHTML=regions.map(r=>panel(r,arr.filter(o=>o.region===r),region!=="all")).join("");
 $("dashboard").querySelectorAll("button[data-key]").forEach(b=>b.addEventListener("click",()=>openDetails(b.dataset.key,b)));
 $("dashboard").querySelectorAll("button[data-open-region]").forEach(b=>b.addEventListener("click",()=>{region=b.dataset.openRegion;paint();$("dashboard").scrollIntoView({behavior:"smooth",block:"start"})}));
}
function paintTable(){
 const ar=displayed().filter(relevant).sort((a,b)=>b.q-a.q||a.region.localeCompare(b.region,"zh-Hant")||a.office.localeCompare(b.office,"zh-Hant"));
 $("rowcount").textContent=ar.length+" 筆通訊處";
 $("list-note").textContent="加總為廠區紀錄值；新客戶數非跨廠去重";
 $("rows").innerHTML=ar.map(o=>'<tr class="data-row" data-key="'+e(officeKey(o))+'" tabindex="0"><td>'+e(o.region)+'</td><td><strong>'+e(o.office)+'</strong><div class="muted">'+e(o.areas.join("、"))+'</div></td><td>'+o.factories.length+'</td><td class="number">'+fmt(o.fyc)+'</td><td class="number">'+fmt(o.clients)+'</td><td><span class="tb-q q'+o.q+'">'+roman[o.q]+' '+label[o.q]+'</span></td><td style="color:#2b598e">查看明細 →</td></tr>').join("")||'<tr><td colspan="7" style="text-align:center;padding:32px;color:#8a99ac">找不到符合條件的通訊處</td></tr>';
 $("rows").querySelectorAll("tr[data-key]").forEach(tr=>{tr.addEventListener("click",()=>openDetails(tr.dataset.key,tr));tr.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();openDetails(tr.dataset.key,tr)}})});
}
function paint(){drawTabs();paintStats();paintDashboard();paintTable()}
function gap(v,suffix=""){if(Number(v)>=0)return '<b>已達標</b>';return '<b class="neg">'+fmt(v)+(suffix?' '+suffix:'')+'</b>'}
function openDetails(key,el){
 const o=offices.find(o=>officeKey(o)===key);if(!o)return;
 activeKey=key;lastFocus=el||null;
 $("drawer").innerHTML='<div class="drawer-top"><button type="button" class="back" id="close-details">關閉 ×</button><small>'+e(o.region)+' / '+roman[o.q]+' '+label[o.q]+'</small><h2>'+e(o.office)+'</h2><p>'+e(o.areas.join("、"))+' · '+o.factories.length+' 個廠區</p></div><div class="drawer-content"><div class="drawer-summary"><div class="stat"><small>廠區 FYC 加總</small><strong>'+money(o.fyc)+'</strong></div><div class="stat"><small>廠區新客數加總</small><strong>'+fmt(o.clients)+'</strong></div></div><h3 class="sect-title">各廠區考核明細</h3>'+o.factories.map(f=>'<div class="factory"><div class="factory-head"><span>'+e(f.factory)+'</span><span class="tb-q q'+f.quadrant+'">'+roman[f.quadrant]+' '+label[f.quadrant]+'</span></div><small>'+e(f.area)+'｜駐廠日期 '+serial(f.date)+'</small><div class="factory-lines"><span>FYC 實績</span><b>'+fmt(f.fyc)+'</b><span>累月 FYC 差額</span>'+gap(f.fycGap)+'<span>新個險客戶數</span><b>'+fmt(f.clients)+'</b><span>累月新客戶數差額</span>'+gap(f.clientGap,"人")+'</div></div>').join("")+'<div class="notice">原始「象限」欄位為各廠區分類。通訊處若負責多廠，彙整以任一廠未達即預警。正向差額在來源檔可能已歸零，因此 0 代表達標，<b>不代表超標量為 0</b>。</div></div>';
 $("drawer").classList.add("show");$("backdrop").classList.add("show");document.body.style.overflow="hidden";
 $("close-details").addEventListener("click",closeDetails);$("close-details").focus();
 paintDashboard();
}
function closeDetails(){
 $("drawer").classList.remove("show");$("backdrop").classList.remove("show");document.body.style.overflow="";
 activeKey="";paintDashboard();if(lastFocus&&lastFocus.isConnected)lastFocus.focus();
}
$("backdrop").addEventListener("click",closeDetails);
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&$("drawer").classList.contains("show"))closeDetails()});
$("search").addEventListener("input",ev=>{query=ev.target.value.trim();paintDashboard();paintTable()});
async function load(){
 try{
  const response=await fetch("./data/data.json?ts="+Date.now(),{cache:"no-store"});if(!response.ok)throw new Error("無法下載資料（HTTP "+response.status+"）");
  data=await response.json();if(!Array.isArray(data.rows)||!data.rows.length)throw new Error("資料表尚無有效資料");
  offices=aggregate(data.rows);if(!offices.length)throw new Error("資料沒有可辨識的通訊處");
  $("updated").textContent="原始廠區紀錄 "+data.rows.length+" 筆 · 通訊處 "+offices.length+" 個 · "+new Set(offices.map(o=>o.region)).size+" 個區域中心";
  $("sync-pill").textContent=(data.syncedAt?"資料同步 "+new Date(data.syncedAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false}):"載入原始資料");
  paint();
 }catch(err){
  $("sync-pill").textContent="資料讀取異常";
  $("stats").innerHTML='<div class="err">'+e(err.message)+'</div>';
  $("dashboard").innerHTML='<div class="err">資料尚未成功同步。請確認 GitHub Actions 的「同步資料與部署網站」執行紀錄。</div>';
  $("rows").innerHTML="";
 }
}
load();
})();
