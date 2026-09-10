let mangas=[];
let readerSize=localStorage.getItem('lfm_reader_size') || 'normal';
let readerWidth=localStorage.getItem('lfm_reader_width') || 'normal';
let chapterViewMode=localStorage.getItem('lfm_chapter_view_mode') || 'tomos';
let readerMode=localStorage.getItem('lfm_reader_mode') || 'normal';
let colorMode=localStorage.getItem('lfm_color_mode') || 'normal';
let readerControlsHidden=false;
let bookState=null;
const app=document.getElementById('app');

function escapeHtml(s=''){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function normalizeTag(s=''){return s.trim().replace(/\\s+/g,' ');}
function mangaIsColor(m){return !!m.es_color;}
function getMangaTags(m){return Array.isArray(m.tags)?m.tags:[];}

async function loadMangas(){
 app.innerHTML='<div class="loading">Cargando mangas...</div>';
 const {data,error}=await supabaseClient.from('mangas').select('*,manga_etiquetas(etiqueta_id,etiquetas(id,nombre))').order('nombre');
 if(error){app.innerHTML='<div class="empty">Error: '+escapeHtml(error.message)+'</div>';return}
 mangas=(data||[]).map(m=>({...m,tags:(m.manga_etiquetas||[]).map(x=>x.etiquetas).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre))}));
 renderHome(mangas);
}

function setChapterViewMode(mode){chapterViewMode=mode==='capitulos'?'capitulos':'tomos';localStorage.setItem('lfm_chapter_view_mode',chapterViewMode);renderHome(mangas);}
function setReaderMode(mode){readerMode=mode==='libro'?'libro':'normal';localStorage.setItem('lfm_reader_mode',readerMode);renderHome(mangas);}
function setColorMode(mode){colorMode=mode==='color'?'color':'normal';localStorage.setItem('lfm_color_mode',colorMode);renderHome(mangas);}

function chapterModeMenu(){return `
<section class="view-mode-panel">
 <div class="view-mode-title">Modo de visualización</div>
 <div class="view-mode-options">
  <button class="view-mode-btn ${colorMode==='normal'?'active':''}" onclick="setColorMode('normal')">📚 Mangas normales</button>
  <button class="view-mode-btn ${colorMode==='color'?'active':''}" onclick="setColorMode('color')">🎨 Mangas con colores</button>
 </div>
 <div class="view-mode-title view-mode-subtitle">Organización de capítulos</div>
 <div class="view-mode-options">
  <button class="view-mode-btn ${chapterViewMode==='tomos'?'active':''}" onclick="setChapterViewMode('tomos')">📚 Ver dividido en tomos</button>
  <button class="view-mode-btn ${chapterViewMode==='capitulos'?'active':''}" onclick="setChapterViewMode('capitulos')">📖 Ver solo capítulos</button>
 </div>
 <div class="view-mode-title view-mode-subtitle">Modo de lectura</div>
 <div class="view-mode-options">
  <button class="view-mode-btn ${readerMode==='normal'?'active':''}" onclick="setReaderMode('normal')">📄 Lector normal</button>
  <button class="view-mode-btn ${readerMode==='libro'?'active':''}" onclick="setReaderMode('libro')">📕 Libro</button>
 </div>
</section>`;}

function renderTags(m){return getMangaTags(m).length?`<div class="manga-tags">${getMangaTags(m).map(t=>`<span class="tag">${escapeHtml(t.nombre)}</span>`).join('')}</div>`:'';}
function renderHome(list){
 const filtered=list.filter(m=>mangaIsColor(m)===(colorMode==='color'));
 app.innerHTML=`<h1>${colorMode==='color'?'Mangas con colores':'Todos los mangas'}</h1>${chapterModeMenu()}
 ${filtered.length?'<div class="grid">'+filtered.map(m=>`<article class="card" onclick="openManga('${m.id}')"><img src="${escapeHtml(m.portada_url||'')}" alt=""><h3>${escapeHtml(m.nombre)}</h3>${renderTags(m)}</article>`).join('')+'</div>':'<div class="empty">No hay mangas en este modo todavía.</div>'}`;
}
function filterMangas(){const q=(document.getElementById('search')?.value||'').toLowerCase().trim();const list=mangas.filter(m=>m.nombre.toLowerCase().includes(q)||getMangaTags(m).some(t=>t.nombre.toLowerCase().includes(q)));renderHome(list);}
function goHome(){history.pushState({},'',location.pathname);const s=document.getElementById('search');if(s)s.value='';document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');readerControlsHidden=false;bookState=null;renderHome(mangas);}

async function getTomoCover(t){return t?.portada_url||'';}

async function openManga(id){
 document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');readerControlsHidden=false;
 const {data:m,error:mangaError}=await supabaseClient.from('mangas').select('*,manga_etiquetas(etiqueta_id,etiquetas(id,nombre))').eq('id',id).single();
 if(mangaError||!m){app.innerHTML='<div class="empty">No se pudo cargar el manga.</div>';return}
 m.tags=(m.manga_etiquetas||[]).map(x=>x.etiquetas).filter(Boolean).sort((a,b)=>a.nombre.localeCompare(b.nombre));
 const {data:ts}=await supabaseClient.from('tomos').select('*').eq('manga_id',id).order('numero');
 const tagHtml=renderTags(m);
 if(chapterViewMode==='capitulos'){
  const allChapters=[];
  for(const t of (ts||[])){const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',t.id).order('numero');(cs||[]).forEach(c=>allChapters.push({...c,tomoNumero:t.numero,tomoId:t.id,tomoCover:t.portada_url}));}
  app.innerHTML=`<button class="back" onclick="goHome()">← Inicio</button><div class="manga-detail-head"><div><h1>${escapeHtml(m.nombre)}</h1>${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}${tagHtml}</div></div><div class="chapter-view-heading">Todos los capítulos</div><div class="chapters chapters-all">${allChapters.map(c=>`<div class="chapter chapter-all-item" onclick="openChapter('${id}','${c.tomoId}','${c.id}',${c.tomoNumero},${c.numero})"><span>Capítulo ${escapeHtml(String(c.numero))}</span><small>Tomo ${escapeHtml(String(c.tomoNumero))}</small></div>`).join('')||'<div class="empty">Sin capítulos todavía.</div>'}</div>`;return;
 }
 app.innerHTML=`<button class="back" onclick="goHome()">← Inicio</button><h1>${escapeHtml(m.nombre)}</h1>${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}${tagHtml}<h2>Tomos</h2><div class="tomos">${(ts||[]).map(t=>`<div class="tomo" onclick="openTomo('${id}','${t.id}',${t.numero})">${t.portada_url?`<img class="tomo-cover" src="${escapeHtml(t.portada_url)}" alt="">`:''}<span>Tomo ${escapeHtml(String(t.numero))}</span></div>`).join('')||'<div class="empty">Sin tomos todavía.</div>'}</div>`;
}

async function openTomo(mid,tid,num){
 document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');readerControlsHidden=false;
 const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',tid).order('numero');
 const {data:t}=await supabaseClient.from('tomos').select('*').eq('id',tid).single();
 const bookButton=readerMode==='libro'?`<button class="book-open-btn" onclick="openBookTomo('${mid}','${tid}')">📕 Abrir tomo como libro</button>`:'';
 app.innerHTML=`<button class="back" onclick="openManga('${mid}')">← Volver al manga</button><div class="tomo-page-head">${t?.portada_url?`<img class="tomo-cover-large" src="${escapeHtml(t.portada_url)}" alt="Portada del Tomo ${escapeHtml(String(num))}">`:''}<div><h1>Tomo ${escapeHtml(String(num))}</h1>${bookButton}</div></div><div class="chapters">${(cs||[]).map(c=>`<div class="chapter" onclick="openChapter('${mid}','${tid}','${c.id}',${num},${c.numero})">Capítulo ${escapeHtml(String(c.numero))}</div>`).join('')||'<div class="empty">Sin capítulos todavía.</div>'}</div>`;
}

async function getChapterNavigation(mid,tid,cid){
 const {data:manga}=await supabaseClient.from('mangas').select('id,nombre').eq('id',mid).single();
 const {data:tomos,error:tomosError}=await supabaseClient.from('tomos').select('id,numero,portada_url').eq('manga_id',mid).order('numero');
 if(tomosError||!tomos)return {mangaName:manga?.nombre||'Manga',chapters:[],index:-1,tomos:[]};
 const chapters=[];
 for(const tomo of tomos){const {data:cs}=await supabaseClient.from('capitulos').select('id,numero').eq('tomo_id',tomo.id).order('numero');(cs||[]).forEach(c=>chapters.push({id:c.id,tomoId:tomo.id,tomo:tomo.numero,cap:c.numero,tomoCover:tomo.portada_url}));}
 return {mangaName:manga?.nombre||'Manga',chapters,index:chapters.findIndex(c=>c.id===cid),tomos};
}

function progressKey(mid){return 'lfm_progress_'+mid;}
function saveProgress(mid,tid,cid,page){localStorage.setItem(progressKey(mid),JSON.stringify({tomoId:tid,chapterId:cid,page:Math.max(0,page||0)}));}
function getProgress(mid){try{return JSON.parse(localStorage.getItem(progressKey(mid))||'null')}catch(e){return null}}

async function openChapter(mid,tid,cid,tomo,cap){
 if(readerMode==='libro'){return openBookChapter(mid,tid,cid,tomo,cap);}
 const existingPage=document.querySelector('.chapter-reader-page');const wasReaderOpen=!!existingPage;const wasControlsHidden=readerControlsHidden;
 document.body.classList.add('reader-mode');if(!wasReaderOpen){readerControlsHidden=false;document.body.classList.remove('reader-controls-hidden');}
 if(existingPage){const content=existingPage.querySelector('.chapter-reader-content');if(content)content.innerHTML='<div class="loading">Cargando capítulo...</div>';}else app.innerHTML='<div class="chapter-reader-page"><div class="chapter-reader-content"><div class="loading">Cargando capítulo...</div></div></div>';
 const [pagesResult,nav]=await Promise.all([supabaseClient.from('paginas').select('*').eq('capitulo_id',cid).order('numero'),getChapterNavigation(mid,tid,cid)]);
 if(pagesResult.error){document.querySelector('.chapter-reader-content').innerHTML='<div class="empty">Error al cargar.</div>';return}
 const pages=pagesResult.data||[],index=nav.index,previous=index>0?{...nav.chapters[index-1],mangaId:mid}:null,next=index>=0&&index<nav.chapters.length-1?{...nav.chapters[index+1],mangaId:mid}:null,totalChapters=nav.chapters.length||1,target=document.querySelector('.chapter-reader-page');
 if(!target)return;
 readerControlsHidden=wasReaderOpen?wasControlsHidden:false;document.body.classList.toggle('reader-controls-hidden',readerControlsHidden);
 target.innerHTML=normalReaderHtml(mid,tid,cid,tomo,cap,pages,nav,index,previous,next,totalChapters);
 updateEyeButton();updateFullscreenButton();setupChapterEndPrompt(target);
 restoreNormalProgress(mid,tid,cid,pages.length,target);
 setupNormalProgress(target,mid,tid,cid);
 if(target&&(document.fullscreenElement===target||document.webkitFullscreenElement===target))target.scrollTop=0;else window.scrollTo(0,0);
}
function normalReaderHtml(mid,tid,cid,tomo,cap,pages,nav,index,previous,next,totalChapters){return `
<aside class="reader-toolbar"><div class="toolbar-title">Lectura</div><div class="toolbar-section"><div class="toolbar-label">Tamaño</div><button class="size-btn ${readerSize==='chico'?'active':''}" onclick="setReaderSize('chico')">Chico</button><button class="size-btn ${readerSize==='normal'?'active':''}" onclick="setReaderSize('normal')">Normal</button><button class="size-btn ${readerSize==='grande'?'active':''}" onclick="setReaderSize('grande')">Grande</button><button class="size-btn ${readerSize==='muy-grande'?'active':''}" onclick="setReaderSize('muy-grande')">Muy grande</button></div><div class="toolbar-section"><div class="toolbar-label">Ancho</div><button class="width-btn ${readerWidth==='estrecho'?'active':''}" onclick="setReaderWidth('estrecho')">Estrecho</button><button class="width-btn ${readerWidth==='normal'?'active':''}" onclick="setReaderWidth('normal')">Normal</button><button class="width-btn ${readerWidth==='gordo'?'active':''}" onclick="setReaderWidth('gordo')">Gordo</button><button class="width-btn ${readerWidth==='muy-gordo'?'active':''}" onclick="setReaderWidth('muy-gordo')">Muy gordo</button></div><div class="toolbar-section toolbar-fullscreen"><button id="fullscreenBtn" class="fullscreen-btn" onclick="toggleFullscreen()">⛶ Pantalla completa</button></div><div class="toolbar-section"><button class="reader-book-switch" onclick="readerMode='libro';localStorage.setItem('lfm_reader_mode','libro');openBookChapter('${mid}','${tid}','${cid}',${tomo},${cap})">📕 Modo Libro</button></div></aside>
<div class="chapter-reader-content"><button class="back" onclick="openTomo('${mid}','${tid}',${tomo})">← Volver al tomo</button><div class="reader-header reader-meta-top"><div class="reader-meta-title-row"><div class="reader-meta-name">${escapeHtml(nav.mangaName)}</div><button id="reader-eye-toggle" class="reader-eye-toggle" type="button" onclick="toggleReaderControls()" aria-label="${readerControlsHidden?'Mostrar menú':'Ocultar menú'}" title="${readerControlsHidden?'Mostrar menú':'Ocultar menú'}">${readerControlsHidden?eyeClosedIcon():eyeOpenIcon()}</button></div><div class="reader-meta-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div></div><button class="reader-side-nav reader-side-prev ${previous?'':'disabled'}" ${previous?`onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"`:'disabled'} aria-label="Capítulo anterior">‹</button><button class="reader-side-nav reader-side-next ${next?'':'disabled'}" ${next?`onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"`:'disabled'} aria-label="Capítulo siguiente">›</button><div class="reader-wrap"><div id="reader" class="reader size-${readerSize} width-${readerWidth}">${pages.map(p=>`<img loading="lazy" src="${escapeHtml(p.imagen_url)}" alt="Página ${escapeHtml(String(p.numero))}" data-page-number="${p.numero}">`).join('')||'<div class="empty">Este capítulo no tiene páginas.</div>'}</div></div><div class="chapter-bottom-nav"><button class="chapter-nav-btn ${previous?'':'disabled'}" ${previous?`onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"`:'disabled'}>‹</button><div class="chapter-info"><div class="chapter-manga-name">${escapeHtml(nav.mangaName)}</div><div class="chapter-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div><div class="chapter-counter">Capítulo ${index>=0?index+1:escapeHtml(String(cap))} de ${totalChapters}</div></div><button class="chapter-nav-btn ${next?'':'disabled'}" ${next?`onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"`:'disabled'}>›</button></div><div id="chapter-end-prompt" class="chapter-end-prompt" aria-live="polite"><button class="chapter-end-arrow chapter-end-prev ${previous?'':'disabled'}" ${previous?`onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"`:'disabled'}>‹</button><div class="chapter-end-info"><div class="chapter-end-manga">${escapeHtml(nav.mangaName)}</div><div class="chapter-end-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div></div><button class="chapter-end-arrow chapter-end-next ${next?'':'disabled'}" ${next?`onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"`:'disabled'}>›</button></div></div>`;}

function setupChapterEndPrompt(target){if(!target)return;if(target._endPromptCleanup)target._endPromptCleanup();const prompt=target.querySelector('#chapter-end-prompt');if(!prompt)return;const isFullscreen=()=>document.fullscreenElement===target||document.webkitFullscreenElement===target;const getScrollMetrics=()=>isFullscreen()?{top:target.scrollTop,height:target.scrollHeight,view:target.clientHeight}:{top:window.scrollY,height:document.documentElement.scrollHeight,view:window.innerHeight};const check=()=>{const m=getScrollMetrics(),nearBottom=(m.top+m.view)>=m.height-70,showEndPrompt=nearBottom&&readerControlsHidden;prompt.classList.toggle('show',showEndPrompt);target.classList.toggle('chapter-at-end',showEndPrompt);target.querySelectorAll('.reader-side-nav').forEach(el=>el.style.display=showEndPrompt?'none':'');const bottom=target.querySelector('.chapter-bottom-nav');if(bottom)bottom.style.display=showEndPrompt?'none':'';prompt.style.display=showEndPrompt?'flex':'';};const onWindowScroll=()=>{if(!isFullscreen())check()},onTargetScroll=()=>{if(isFullscreen())check()};window.addEventListener('scroll',onWindowScroll,{passive:true});target.addEventListener('scroll',onTargetScroll,{passive:true});window.addEventListener('resize',check,{passive:true});target._checkChapterEnd=check;target._endPromptCleanup=()=>{window.removeEventListener('scroll',onWindowScroll);target.removeEventListener('scroll',onTargetScroll);window.removeEventListener('resize',check)};check();}
function eyeOpenIcon(){return '<svg class="eye-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>'}
function eyeClosedIcon(){return '<svg class="eye-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4.5 9.5C6.3 7.4 8.8 6 12 6c6.5 0 10 6 10 6-.9 1.5-2.1 2.8-3.5 3.8M4.5 9.5C3 10.7 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'}
function updateEyeButton(){const btn=document.getElementById('reader-eye-toggle');if(!btn)return;btn.innerHTML=readerControlsHidden?eyeClosedIcon():eyeOpenIcon();btn.setAttribute('aria-label',readerControlsHidden?'Mostrar menú':'Ocultar menú');btn.setAttribute('title',readerControlsHidden?'Mostrar menú':'Ocultar menú');btn.classList.toggle('closed',readerControlsHidden);}
function toggleReaderControls(){if(!document.body.classList.contains('reader-mode'))return;readerControlsHidden=!readerControlsHidden;document.body.classList.toggle('reader-controls-hidden',readerControlsHidden);updateEyeButton();const target=document.querySelector('.chapter-reader-page');if(target&&typeof target._checkChapterEnd==='function')target._checkChapterEnd();}
async function toggleFullscreen(){const target=document.querySelector('.chapter-reader-page');if(!target)return;try{if(!document.fullscreenElement&&!document.webkitFullscreenElement){if(target.requestFullscreen)await target.requestFullscreen();else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();}else{if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}}catch(e){console.error(e)}}
function updateFullscreenButton(){const btn=document.getElementById('fullscreenBtn');if(btn)btn.textContent=(document.fullscreenElement||document.webkitFullscreenElement)?'⛶ Salir de pantalla completa':'⛶ Pantalla completa';}
document.addEventListener('fullscreenchange',updateFullscreenButton);document.addEventListener('webkitfullscreenchange',updateFullscreenButton);
function updateReaderClass(){const r=document.getElementById('reader');if(r)r.className='reader size-'+readerSize+' width-'+readerWidth;}
function setReaderSize(s){readerSize=s;localStorage.setItem('lfm_reader_size',s);updateReaderClass();document.querySelectorAll('.size-btn').forEach(b=>b.classList.remove('active'));const map={chico:0,normal:1,grande:2,'muy-grande':3},buttons=[...document.querySelectorAll('.size-btn')];if(buttons[map[s]])buttons[map[s]].classList.add('active');}
function setReaderWidth(w){readerWidth=w;localStorage.setItem('lfm_reader_width',w);updateReaderClass();document.querySelectorAll('.width-btn').forEach(b=>b.classList.remove('active'));const map={estrecho:0,normal:1,gordo:2,'muy-gordo':3},buttons=[...document.querySelectorAll('.width-btn')];if(buttons[map[w]])buttons[map[w]].classList.add('active');}

// ---------------- MODO LIBRO ----------------
async function fetchTomoBook(mid,tid){
 const {data:t,error:te}=await supabaseClient.from('tomos').select('*').eq('id',tid).single();if(te||!t)throw te||new Error('Tomo no encontrado');
 const {data:cs,error:ce}=await supabaseClient.from('capitulos').select('id,numero').eq('tomo_id',tid).order('numero');if(ce)throw ce;
 const chapters=[];for(const c of (cs||[])){const {data:ps,error:pe}=await supabaseClient.from('paginas').select('id,numero,imagen_url').eq('capitulo_id',c.id).order('numero');if(pe)throw pe;chapters.push({id:c.id,numero:c.numero,pages:ps||[]});}
 return {tomo:t,chapters};
}
function flattenBook(book){const items=[{type:'cover',src:book.tomo.portada_url||'',tomo:book.tomo.numero}];book.chapters.forEach(c=>c.pages.forEach((p,i)=>items.push({type:'page',src:p.imagen_url,chapterId:c.id,chapter:c.numero,page:i+1,numero:p.numero})));return items;}
function bookProgressPosition(book,mid,tid){const p=getProgress(mid);if(!p||p.tomoId!==tid)return 0;let pos=1;for(const c of book.chapters){if(c.id===p.chapterId)return pos+Math.max(0,(p.page||1)-1);pos+=c.pages.length;}return 0;}
async function openBookTomo(mid,tid){
 const book=await fetchTomoBook(mid,tid);
 const start=bookProgressPosition(book,mid,tid);
 openBookUI(mid,tid,book,start,true);
}
async function openBookChapter(mid,tid,cid,tomo,cap){
 try{const book=await fetchTomoBook(mid,tid);const pos=bookProgressPosition(book,mid,tid);let start=pos;const chapterStart=book.chapters.findIndex(c=>c.id===cid);if(!getProgress(mid)&&chapterStart>=0)start=1+book.chapters.slice(0,chapterStart).reduce((n,c)=>n+c.pages.length,0);openBookUI(mid,tid,book,start,false);}catch(e){app.innerHTML='<div class="empty">No se pudo cargar el libro.</div>';}}
function bookIndexToChapter(book,index){if(index<=0)return null;let n=index-1;for(const c of book.chapters){if(n<c.pages.length)return {chapter:c,page:n+1};n-=c.pages.length;}return null;}
function bookCanGoPrev(state){return state.index>0;}
function bookCanGoNext(state){return state.index<state.items.length-1;}
function renderBookPage(state,slot){const item=state.items[slot];if(!item)return '<div class="book-blank"></div>';if(item.type==='cover')return `<div class="book-sheet book-cover-sheet"><img src="${escapeHtml(item.src)}" alt="Portada del Tomo ${escapeHtml(String(state.book.tomo.numero))}"><div class="book-cover-fallback">Tomo ${escapeHtml(String(state.book.tomo.numero))}</div></div>`;return `<div class="book-sheet"><img loading="eager" src="${escapeHtml(item.src)}" alt="Página ${escapeHtml(String(item.numero))}"></div>`;}
function renderBook(){
 const s=bookState;if(!s)return;
 const two=s.index>0&&s.index+1<s.items.length&&window.innerWidth>=900;
 const leftSlot=two?s.index:s.index;
 const rightSlot=two?s.index+1:-1;
 const nextVisible=s.index<s.items.length-1 || s.navTomos.findIndex(t=>t.id===s.tid)<s.navTomos.length-1;
 const prevVisible=s.index>0 || s.navTomos.findIndex(t=>t.id===s.tid)>0;
 const meta=s.index===0?`Portada · Tomo ${s.book.tomo.numero}`:(()=>{const cp=bookIndexToChapter(s.book,s.index);return cp?`Tomo ${s.book.tomo.numero} · Capítulo ${cp.chapter.numero} · Página ${cp.page}`:`Tomo ${s.book.tomo.numero}`})();
 const reader=document.getElementById('book-reader');if(!reader)return;
 reader.innerHTML=`<div class="book-topbar"><button class="book-eye" onclick="toggleBookControls()">${s.controlsHidden?eyeClosedIcon():eyeOpenIcon()}</button><div class="book-title">${escapeHtml(s.mangaName)}<small>${escapeHtml(meta)}</small></div><button class="book-full" onclick="toggleBookFullscreen()">⛶</button></div><div class="book-stage ${two?'book-two-pages':''}"><button class="book-arrow book-arrow-left ${nextVisible?'':'disabled'}" onclick="bookNext()" ${nextVisible?'':'disabled'}>‹</button><div class="book-spread ${s.animDirection==='next'?'page-flip-next':''} ${s.animDirection==='prev'?'page-flip-prev':''}">${renderBookPage(s,leftSlot)}${two?renderBookPage(s,rightSlot):''}</div><button class="book-arrow book-arrow-right ${prevVisible?'':'disabled'}" onclick="bookPrev()" ${prevVisible?'':'disabled'}>›</button></div><div class="book-bottom"><span>${escapeHtml(meta)}</span><span>${s.index+1} / ${s.items.length}</span></div>${s.chapterFlash?`<div class="book-chapter-flash">Capítulo ${escapeHtml(String(bookIndexToChapter(s.book,s.index)?.chapter?.numero??''))}</div>`:''}`;
 reader.classList.toggle('book-controls-hidden',s.controlsHidden);document.body.classList.toggle('book-controls-hidden',s.controlsHidden);
 s.animDirection='';
}
async function bookNext(){
 if(!bookState)return;
 if(bookCanGoNext(bookState)){
   const before=bookIndexToChapter(bookState.book,bookState.index)?.chapter?.id;
   bookState.index++;
   const after=bookIndexToChapter(bookState.book,bookState.index)?.chapter?.id;
   bookState.animDirection='next';
   bookState.chapterFlash=before&&after&&before!==after;
   saveBookProgress();renderBook();preloadBookNeighbors();
   if(bookState.chapterFlash)setTimeout(()=>{if(bookState) {bookState.chapterFlash=false;renderBook()}},900);
   return;
 }
 const i=bookState.navTomos.findIndex(t=>t.id===bookState.tid);
 if(i>=0&&i<bookState.navTomos.length-1){
   await openBookTomo(bookState.mid,bookState.navTomos[i+1].id);
 }
}
async function bookPrev(){
 if(!bookState)return;
 if(bookCanGoPrev(bookState)){
   const before=bookIndexToChapter(bookState.book,bookState.index)?.chapter?.id;
   bookState.index--;
   const after=bookIndexToChapter(bookState.book,bookState.index)?.chapter?.id;
   bookState.animDirection='prev';
   bookState.chapterFlash=before&&after&&before!==after;
   saveBookProgress();renderBook();preloadBookNeighbors();
   if(bookState.chapterFlash)setTimeout(()=>{if(bookState){bookState.chapterFlash=false;renderBook()}},900);
   return;
 }
 const i=bookState.navTomos.findIndex(t=>t.id===bookState.tid);
 if(i>0){
   await openBookTomo(bookState.mid,bookState.navTomos[i-1].id);
 }
}
function saveBookProgress(){const s=bookState,cp=bookIndexToChapter(s.book,s.index);if(cp)saveProgress(s.mid,s.tid,cp.chapter.id,cp.page);}
function preloadBookNeighbors(){const s=bookState;[s.index-1,s.index+1,s.index+2].forEach(i=>{const x=s.items[i];if(x?.src){const im=new Image();im.src=x.src;}})}
function openNextTomoFromBook(){const s=bookState;if(!s)return;const ti=s.navTomos.findIndex(t=>t.id===s.tid);if(ti>=0&&ti<s.navTomos.length-1)openBookTomo(s.mid,s.navTomos[ti+1].id);}
function openPrevTomoFromBook(){const s=bookState;if(!s)return;const ti=s.navTomos.findIndex(t=>t.id===s.tid);if(ti>0)openBookTomo(s.mid,s.navTomos[ti-1].id);}
async function openBookUI(mid,tid,book,start,fromTomo){
 const oldPage=document.querySelector('.book-reader-page');
 const wasFullscreen=!!(oldPage&&(document.fullscreenElement===oldPage||document.webkitFullscreenElement===oldPage));
 const oldHidden=bookState?.controlsHidden||false;
 const {data:m}=await supabaseClient.from('mangas').select('id,nombre').eq('id',mid).single();const {data:tomos}=await supabaseClient.from('tomos').select('id,numero,portada_url').eq('manga_id',mid).order('numero');
 const items=flattenBook(book);
 bookState={mid,tid,book,items,index:Math.min(Math.max(start,0),Math.max(items.length-1,0)),controlsHidden:oldHidden,mangaName:m?.nombre||'Manga',navTomos:tomos||[],chapterFlash:false};
 document.body.classList.add('reader-mode','book-mode');document.body.classList.toggle('book-controls-hidden',oldHidden);
 if(oldPage){oldPage.innerHTML='<div id="book-reader"></div>';}else{app.innerHTML='<div class="chapter-reader-page book-reader-page"><div id="book-reader"></div></div>';}
 renderBook();preloadBookNeighbors();
 const page=document.querySelector('.book-reader-page');
 if(wasFullscreen&&page&&!document.fullscreenElement){try{if(page.requestFullscreen)await page.requestFullscreen();else if(page.webkitRequestFullscreen)page.webkitRequestFullscreen();}catch(e){console.warn(e)}}
 try{if(document.fullscreenElement&&screen.orientation?.lock)await screen.orientation.lock('landscape');}catch(e){}
}
function toggleBookControls(){if(!bookState)return;bookState.controlsHidden=!bookState.controlsHidden;renderBook();}
async function toggleBookFullscreen(){const p=document.querySelector('.book-reader-page');if(!p)return;try{if(!document.fullscreenElement){if(p.requestFullscreen)await p.requestFullscreen();else if(p.webkitRequestFullscreen)p.webkitRequestFullscreen();}else if(document.exitFullscreen)await document.exitFullscreen();}catch(e){console.error(e)}}
document.addEventListener('keydown',e=>{if(!bookState)return;if(e.key==='ArrowLeft')bookNext();else if(e.key==='ArrowRight')bookPrev();else if(e.key==='Escape'&&document.fullscreenElement)document.exitFullscreen?.();});

document.addEventListener('touchstart',e=>{if(!bookState||e.touches.length!==1)return;bookState.touchX=e.touches[0].clientX;},{passive:true});
document.addEventListener('touchend',e=>{if(!bookState||bookState.touchX==null)return;const dx=e.changedTouches[0].clientX-bookState.touchX;bookState.touchX=null;if(Math.abs(dx)>55){if(dx<0)bookNext();else bookPrev();}},{passive:true});

function restoreNormalProgress(mid,tid,cid,pagesLength,target){const p=getProgress(mid);if(!p||p.tomoId!==tid||p.chapterId!==cid)return;const page=Math.max(1,Math.min(p.page||1,pagesLength||1));setTimeout(()=>{const img=target.querySelector(`img[data-page-number="${page}"]`);if(img)img.scrollIntoView({block:'start'});},80);}

function setupNormalProgress(target,mid,tid,cid){
 if(target._progressCleanup)target._progressCleanup();
 const save=()=>{
  const imgs=[...target.querySelectorAll('.reader img[data-page-number]')];
  if(!imgs.length)return;
  const isFs=document.fullscreenElement===target||document.webkitFullscreenElement===target;
  const scrollTop=isFs?target.scrollTop:window.scrollY;
  let best=null,bestY=-Infinity;
  imgs.forEach(img=>{const r=img.getBoundingClientRect();const y=(isFs?target.scrollTop:window.scrollY)+r.top;if(y<=scrollTop+90&&y>bestY){best=img;bestY=y}});
  if(best)saveProgress(mid,tid,cid,Number(best.dataset.pageNumber)||1);
 };
 const handler=()=>requestAnimationFrame(save);
 window.addEventListener('scroll',handler,{passive:true});
 target.addEventListener('scroll',handler,{passive:true});
 target._progressCleanup=()=>{window.removeEventListener('scroll',handler);target.removeEventListener('scroll',handler)};
}
window.addEventListener('scroll',()=>{if(!bookState)return;const cp=bookIndexToChapter(bookState.book,bookState.index);if(cp)saveProgress(bookState.mid,bookState.tid,cp.chapter.id,cp.page);},{passive:true});
loadMangas();