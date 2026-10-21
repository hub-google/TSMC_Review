(()=>{
"use strict";
const $=id=>document.getElementById(id), names={1:"雙項達標",2:"新客戶未達標",3:"雙項未達標",4:"FYC 未達標"};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=n=>Number(n||0).toLocaleString("zh-TW",{maximumFractionDigits:1});
const date=n=>Number.isFinite(+n)&& +n>1000?new Date(Date.UTC(1899,11,30)+Math.floor(+n)*86400000).toISOString().slice(0,10):"—";
let all=[],region="all",query="",selected=null;
const visible=()=>all.filter(x=>region==="all"||x.region===region);
const find=x=>[x.factory,x.office,x.area,x.region].join(" ").toLowerCase().includes(query);
function parse(rows){return rows.map((r,i)=>({id:i,region:String(r[0]||""),area:String(r[1]||""),office:String(r[2]||""),factory:String(r[3]||""),date:r[4],fyc:+r[5]||0,fycGap:+r[6]||0,clients:+r[7]||0,clientGap:+r[8]||0,q:+r[9]})).filter(r=>r.region&&r.factory&&r.office&&[1,2,3,4].includes(r.q))}
function xy(r){
 // X: FYC attainment relative to a 600,000 benchmark derived from source's 72C threshold;
 // Y: new-customer gap relative to a 16 2/3-person source threshold.
 // Actual FYC and customer attainment can be reconstructed from the raw observed metric
 // and negative shortfall. The original sheet clips positive shortfall to zero.
 // Use fixed expected benchmarks from observed raw source, and show them as approximate.
 const ftarget=r.fyc-r.fycGap,ctarget=r.clients-r.clientGap;
 const fr=ftarget>0?r.fyc/ftarget:1,cr=ctarget>0?r.clients/ctarget:1;
 // For reached goals the gap is clipped to 0, but observed performance
 // still differentiates, using source's 600k/16.667 nominal scale.
 const fx=r.fycGap<0?Math.max(0.03,Math.min(.97,fr)):Math.max(0.03,Math.min(.97,r.fyc/600000));
 const cy=r.clientGap<0?Math.max(0.03,Math.min(.97,cr)):Math.max(0.03,Math.min(.97,r.clients/(50/3)));
 // Convert to coordinates within quadrant; clip to avoid edges.
 const x=r.q===1||r.q===2?Math.min(.92,Math.max(.10,(fx-1)*1.3+.20)) : Math.min(.90,Math.max(.10,fx*.85));
 const y=r.q===1||r.q===4?Math.min(.9,Math.max(.1,(cy-1)*.7+.18)) : Math.min(.9,Math.max(.1,cy*.85));
 return {x,y};
}
function positions(arr){
 const grid=new Map();return [...arr].sort((a,b)=>a.fyc-b.fyc||a.clients-b.clients).map(r=>{
  let {x,y}=xy(r);const px=9+x*82,py=91-y*80;
  let best={x:px,y:py,score:Infinity};
  // Keep point proximity to measured attainment while reducing label overlaps.
  for(let k=0;k<38;k++){const xx=Math.max(13,Math.min(87,px+((k%7)-3)*8));const yy=Math.max(20,Math.min(84,py+(Math.floor(k/7)-2)*10));
   let score=Math.pow(xx-px,2)*.42+Math.pow(yy-py,2)*.46;
   for(const p of grid.values()){let dx=Math.abs(xx-p.x),dy=Math.abs(yy-p.y);if(dx<24&&dy<24)score+=450+(24-dx)*(24-dy);}
   if(score<best.score)best={x:xx,y:yy,score};
  }grid.set(r.id,best);return {...r,pos:best};
 });
}
function stats(){
 const a=visible();const units=new Set(a.map(r=>r.region+"|"+r.office));
 $("stats").innerHTML=[
  ["廠區總數",a.length,"筆廠區紀錄"],["涉及通訊處",units.size,"通訊處名稱去重"],["至少一項未達標",a.filter(x=>x.q!==1).length,"需關注廠區"],["雙項未達標",a.filter(x=>x.q===3).length,"優先追蹤廠區"]
 ].map((s,i)=>'<div class="stat '+(i>1?'warn':'')+'"><small>'+s[0]+'</small><strong>'+num(s[1])+'<em>個</em></strong><div class="sub">'+s[2]+'</div></div>').join("");
}
function tabs(){
 $("tabs").innerHTML=[["all","各區一覽"],...[...new Set(all.map(r=>r.region))].map(r=>[r,r])].map(([r,name])=>'<button class="tab '+(r===region?'on':'')+'" data-region="'+esc(r)+'">'+esc(name)+'</button>').join("");
 $("tabs").querySelectorAll("button").forEach(b=>b.onclick=()=>{region=b.dataset.region;render()});
}
function quad(q,a){
 const r=positions(a.filter(x=>x.q===q));
 return '<div class="quad q'+q+'"><div class="qh"><span>'+names[q]+'（'+r.length+' 個廠區）</span></div>'+
 (r.length?r.map(x=>'<button class="dot '+(find(x)?'':'is-search-miss')+'" data-id="'+x.id+'" style="left:'+x.pos.x+'%;top:'+x.pos.y+'%" aria-label="'+esc(x.factory+'（'+x.office+'）')+'" title="'+esc(x.factory+'（'+x.office+'）')+'"><span class="circle"></span><span class="name">'+esc(x.factory)+'<span class="office-inline">（'+esc(x.office)+'）</span></span></button>').join(""):'<div class="quad-empty">無廠區</div>')+'</div>';
}
function panel(name,a,single){
 return '<article class="panel '+(single?'single':'')+'"><div class="panelhead"><div><h3>'+esc(name)+'</h3><div class="count">'+a.length+' 個廠區 · '+new Set(a.map(x=>x.office)).size+' 個通訊處</div></div>'+(single?'':'<button class="expand" data-open="'+esc(name)+'">放大查看 ↗</button>')+'</div>'+
 '<div class="plot-wrap"><div class="y-axis"><span class="axis-end">達標 ↑</span><span class="axis-name">新個險客戶數</span><span class="axis-end">未達標 ↓</span></div>'+
 '<div class="quad-grid">'+[4,1,3,2].map(q=>quad(q,a)).join("")+'</div></div>'+
 '<div class="x-axis"><span>← 未達標</span><b>累月 FYC</b><span>達標 →</span></div></article>';
}
function dashboard(){
 const a=visible(),names=region==="all"?[...new Set(all.map(r=>r.region))]:[region];
 $("dashboard").className="dashboard"+(region==="all"?"":" single");
 $("dashboard").innerHTML=names.map(r=>panel(r,a.filter(x=>x.region===r),region!=="all")).join("");
 $("dashboard").querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>details(+b.dataset.id));
 $("dashboard").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{region=b.dataset.open;render();$("dashboard").scrollIntoView({behavior:"smooth"})});
}
function table(){
 const a=visible().filter(find).sort((a,b)=>b.q-a.q||a.region.localeCompare(b.region,"zh-Hant")||a.factory.localeCompare(b.factory,"zh-Hant"));
 $("list-note").textContent="每筆資料代表一個廠區，數值與象限直接取自原始工作表";
 $("rowcount").textContent=a.length+" 個廠區";
 $("rows").innerHTML=a.map(r=>'<tr class="data-row" tabindex="0" data-id="'+r.id+'"><td>'+esc(r.region)+'</td><td><strong>'+esc(r.factory)+'（'+esc(r.office)+'）</strong><div class="muted">'+esc(r.area)+'</div></td><td>'+num(r.fyc)+'</td><td class="number">'+num(r.fycGap)+'</td><td>'+num(r.clients)+'</td><td class="number">'+num(r.clientGap)+'</td><td><span class="tb-q q'+r.q+'">'+names[r.q]+'</span></td></tr>').join("")||'<tr><td colspan="7" style="text-align:center;padding:25px">沒有符合條件的廠區</td></tr>';
 $("rows").querySelectorAll("[data-id]").forEach(t=>{t.onclick=()=>details(+t.dataset.id);t.onkeydown=e=>{if(e.key==="Enter")details(+t.dataset.id)}});
}
function details(i){
 const r=all.find(r=>r.id===i);if(!r)return;selected=i;
 $("drawer").innerHTML='<div class="drawer-top"><button class="back" id="close-details">關閉 ×</button><small>'+esc(r.region)+' / '+esc(r.area)+'</small><h2>'+esc(r.factory)+'（'+esc(r.office)+'）</h2><p>'+names[r.q]+'</p></div><div class="drawer-content"><h3 class="sect-title">廠區考核數據</h3><div class="factory"><div class="factory-lines"><span>廠區</span><b>'+esc(r.factory)+'</b><span>通訊處</span><b>'+esc(r.office)+'</b><span>駐廠日期</span><b>'+date(r.date)+'</b><span>FYC 實績</span><b>'+num(r.fyc)+'</b><span>FYC 累月差額</span><b class="'+(r.fycGap<0?'neg':'')+'">'+num(r.fycGap)+'</b><span>新個險客戶數</span><b>'+num(r.clients)+'</b><span>新客戶數累月差額</span><b class="'+(r.clientGap<0?'neg':'')+'">'+num(r.clientGap)+'</b></div></div><div class="notice">象限直接採用來源 Excel 的「象限」欄。點位依實績與未達標差額估計相對位置，並為避免文字重疊小幅調整；來源達標差額已截為 0，不能視為精確達標百分比。</div></div>';
 $("drawer").classList.add("show");$("backdrop").classList.add("show");document.body.style.overflow="hidden";
 $("close-details").onclick=close;$("close-details").focus();
}
function close(){$("drawer").classList.remove("show");$("backdrop").classList.remove("show");document.body.style.overflow="";selected=null}
function render(){tabs();stats();dashboard();table()}
$("backdrop").onclick=close;document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
$("search").oninput=e=>{query=e.target.value.trim().toLowerCase();dashboard();table()};
fetch("./data/data.json?t="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(d=>{all=parse(d.rows);$("sync-pill").textContent="資料同步 "+new Date(d.syncedAt).toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false});$("updated").textContent=all.length+" 個廠區 · "+[...new Set(all.map(r=>r.region))].length+" 個區域中心";render()}).catch(e=>{$("stats").innerHTML='<div class="err">資料讀取失敗：'+esc(e.message)+'</div>';});
})();