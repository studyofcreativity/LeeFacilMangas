let mangas=[];
const app=document.getElementById('app');
async function loadMangas(){
 app.innerHTML='<div class="loading">Cargando mangas...</div>';
 const {data,error}=await supabaseClient.from('mangas').select('*').order('nombre');
 if(error){app.innerHTML='<div class="empty">Error: '+escapeHtml(error.message)+'</div>';return}
 mangas=data||[]; renderHome(mangas);
}
function escapeHtml(s=''){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function renderHome(list){
 app.innerHTML='<h1>Todos los mangas</h1>'+(list.length?'<div class="grid">'+list.map(m=>`<article class="card" onclick="openManga('${m.id}')"><img src="${m.portada_url||''}" alt=""><h3>${escapeHtml(m.nombre)}</h3></article>`).join('')+'</div>':'<div class="empty">Todavía no hay mangas.</div>');
}
function filterMangas(){const q=document.getElementById('search').value.toLowerCase();renderHome(mangas.filter(m=>m.nombre.toLowerCase().includes(q)))}
function goHome(){history.pushState({},'',location.pathname);document.getElementById('search').value='';renderHome(mangas)}
async function openManga(id){
 const {data:m}=await supabaseClient.from('mangas').select('*').eq('id',id).single();
 const {data:ts}=await supabaseClient.from('tomos').select('*').eq('manga_id',id).order('numero');
 app.innerHTML=`<button class="back" onclick="goHome()">← Inicio</button><h1>${escapeHtml(m.nombre)}</h1>${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}<h2>Tomos</h2><div class="tomos">${(ts||[]).map(t=>`<div class="tomo" onclick="openTomo('${id}','${t.id}',${t.numero})">Tomo ${t.numero}</div>`).join('')||'<div class="empty">Sin tomos todavía.</div>'}</div>`;
}
async function openTomo(mid,tid,num){
 const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',tid).order('numero');
 app.innerHTML=`<button class="back" onclick="openManga('${mid}')">← Volver al manga</button><h1>Tomo ${num}</h1><div class="chapters">${(cs||[]).map(c=>`<div class="chapter" onclick="openChapter('${mid}','${tid}','${c.id}',${num},${c.numero})">Capítulo ${c.numero}</div>`).join('')||'<div class="empty">Sin capítulos todavía.</div>'}</div>`;
}
async function openChapter(mid,tid,cid,tomo,cap){
 app.innerHTML='<div class="loading">Cargando capítulo...</div>';
 const {data:pages,error}=await supabaseClient.from('paginas').select('*').eq('capitulo_id',cid).order('numero');
 if(error){app.innerHTML='<div class="empty">Error al cargar.</div>';return}
 app.innerHTML=`<button class="back" onclick="openTomo('${mid}','${tid}',${tomo})">← Volver al tomo</button><h2 class="reader-title">Tomo ${tomo} / Capítulo ${cap}</h2><div class="reader">${(pages||[]).map(p=>`<img loading="lazy" src="${p.imagen_url}" alt="Página ${p.numero}">`).join('')||'<div class="empty">Este capítulo no tiene páginas.</div>'}</div>`;
 window.scrollTo(0,0);
}
loadMangas();