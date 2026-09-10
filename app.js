let mangas=[];
let readerSize=localStorage.getItem('lfm_reader_size') || 'normal';
let readerWidth=localStorage.getItem('lfm_reader_width') || 'normal';
let chapterViewMode=localStorage.getItem('lfm_chapter_view_mode') || 'tomos';
let readerMode=localStorage.getItem('lfm_reader_mode') || 'normal';
let colorMode=localStorage.getItem('lfm_color_mode') || 'normal';
let readerControlsHidden=false;
let bookState=null;
const app=document.getElementById('app');

function waitMs(ms){return new Promise(r=>setTimeout(r,ms));}

function bookReaderEl(){return document.getElementById('book-reader');}

function clearBookAnimClasses(){
  const reader=bookReaderEl();
  if(!reader)return;
  reader.classList.remove(
    'book-anim-open','book-anim-close',
    'book-anim-tomo-exit-next','book-anim-tomo-exit-prev',
    'book-anim-tomo-enter-next','book-anim-tomo-enter-prev',
    'book-anim-tomo-open'
  );
  document.querySelector('.book-stage')?.classList.remove('book-animating');
}

async function playBookAnim(className,durationMs,opts={}){
  const reader=bookReaderEl();
  if(!reader)return;
  clearBookAnimClasses();
  const stage=document.querySelector('.book-stage');
  if(stage)stage.classList.add('book-animating');
  // force reflow so animation restarts
  void reader.offsetWidth;
  reader.classList.add(className);
  await waitMs(durationMs);
  if(!opts.keepClass){
    reader.classList.remove(className);
    stage?.classList.remove('book-animating');
  }
}



function escapeHtml(s=''){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function normalizeTag(s=''){return s.trim().replace(/\s+/g,' ');}
function mangaIsColor(m){return !!m.es_color;}
function getMangaTags(m){return Array.isArray(m.tags)?m.tags:[];}

async function loadMangas(){
 app.innerHTML='<div class="loading">Cargando mangas...</div>';
 try{
   const {data,error}=await supabaseClient.from('mangas').select('*').order('nombre');
   if(error) throw error;
   const rows=data||[];
   if(!rows.length){mangas=[];renderHome(mangas);return;}
   const ids=rows.map(m=>m.id);
   const {data:links,error:linkError}=await supabaseClient
     .from('manga_etiquetas')
     .select('manga_id,etiqueta_id')
     .in('manga_id',ids);
   if(linkError) throw linkError;
   const tagIds=[...new Set((links||[]).map(x=>x.etiqueta_id).filter(Boolean))];
   let tags=[];
   if(tagIds.length){
     const {data:tagRows,error:tagError}=await supabaseClient.from('etiquetas').select('id,nombre').in('id',tagIds);
     if(tagError) throw tagError;
     tags=tagRows||[];
   }
   const tagMap=new Map(tags.map(t=>[t.id,t]));
   const byManga=new Map();
   for(const link of (links||[])){
     const tag=tagMap.get(link.etiqueta_id);
     if(tag){if(!byManga.has(link.manga_id))byManga.set(link.manga_id,[]);byManga.get(link.manga_id).push(tag);}
   }
   mangas=rows.map(m=>({...m,tags:(byManga.get(m.id)||[]).sort((a,b)=>a.nombre.localeCompare(b.nombre))}));
   renderHome(mangas);
 }catch(error){
   console.error('LeeMangasCross: error cargando mangas',error);
   app.innerHTML='<div class="empty">No se pudieron cargar los mangas.<br><small>'+escapeHtml(error?.message||'Error desconocido')+'</small><br><button onclick="loadMangas()">↻ Reintentar</button></div>';
 }
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
async function goHome(){
  history.pushState({},'',location.pathname);
  const s=document.getElementById('search');
  if(s)s.value='';
  if(bookState&&document.body.classList.contains('book-mode')){
    await closeBookAnimated();
  }else{
    document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');
    readerControlsHidden=false;
    bookState=null;
  }
  renderHome(mangas);
}

async function closeBookAnimated(){
  if(!bookState){
    document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');
    readerControlsHidden=false;
    return;
  }
  // Ir a portada y animar cierre
  if(bookState.index!==0){
    bookState.index=0;
    bookState.animDirection='';
    renderBook();
    await waitMs(80);
  }
  await playBookAnim('book-anim-close',450);
  clearBookAnimClasses();
  document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');
  readerControlsHidden=false;
  bookState=null;
}

async function getTomoCover(t){return t?.portada_url||'';}

async function openManga(id){
 if(bookState&&document.body.classList.contains('book-mode')) await closeBookAnimated();
 else { document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');readerControlsHidden=false; bookState=null; }
 const {data:m,error:mangaError}=await supabaseClient.from('mangas').select('*').eq('id',id).single();
 if(mangaError||!m){app.innerHTML='<div class="empty">No se pudo cargar el manga.<br><small>'+escapeHtml(mangaError?.message||'Error desconocido')+'</small><br><button onclick="openManga(\''+id+'\')">↻ Reintentar</button></div>';return}
 m.tags=getMangaTags(m);
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
 if(bookState&&document.body.classList.contains('book-mode')) await closeBookAnimated();
 else { document.body.classList.remove('reader-mode','reader-controls-hidden','book-mode');readerControlsHidden=false; bookState=null; }
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
// El Libro mantiene un único índice sobre las páginas reales del tomo.
// La precarga solo crea Image() en memoria y nunca añade páginas al DOM.
async function fetchTomoBook(mid,tid){
  const {data:t,error:te}=await supabaseClient
    .from('tomos').select('*').eq('id',tid).single();
  if(te||!t) throw te||new Error('Tomo no encontrado');

  const {data:cs,error:ce}=await supabaseClient
    .from('capitulos').select('id,numero').eq('tomo_id',tid).order('numero');
  if(ce) throw ce;

  const chapters=[];
  for(const c of (cs||[])){
    const {data:ps,error:pe}=await supabaseClient
      .from('paginas')
      .select('id,numero,imagen_url')
      .eq('capitulo_id',c.id)
      .order('numero',{ascending:true});
    if(pe) throw pe;

    // El orden es exclusivamente el número guardado en public.paginas.
    // No se usa el orden accidental de Storage.
    const pages=(ps||[])
      .slice()
      .sort((a,b)=>Number(a.numero)-Number(b.numero))
      .map((p,i)=>({
        id:p.id,
        numero:p.numero,
        src:p.imagen_url,
        page:i+1
      }));

    chapters.push({id:c.id,numero:c.numero,pages});
  }
  return {tomo:t,chapters};
}

function flattenBook(book){
  const items=[{type:'cover',src:book.tomo.portada_url||'',tomo:book.tomo.numero}];
  for(const c of book.chapters){
    for(const p of c.pages){
      items.push({
        type:'page',
        src:p.src,
        id:p.id,
        chapterId:c.id,
        chapter:c.numero,
        page:p.page,
        numero:p.numero
      });
    }
  }
  return items;
}

function getBookItem(state,index){
  return state?.items?.[index]||null;
}

function bookIsDesktopSpread(state){
  const item=getBookItem(state,state.index);
  return !!(window.innerWidth>=900 && item && item.type==='page');
}

function chapterFirstIndex(items,chapterId){
  return items.findIndex(x=>x.type==='page'&&x.chapterId===chapterId);
}

function bookProgressPosition(book,mid,tid){
  const p=getProgress(mid);
  if(!p||p.tomoId!==tid) return 0;

  let index=1;
  for(const c of book.chapters){
    if(c.id===p.chapterId){
      const page=Math.max(1,Math.min(Number(p.page)||1,c.pages.length||1));
      return index+page-1;
    }
    index+=c.pages.length;
  }
  return 0;
}

async function openBookTomo(mid,tid,options={}){
  try{
    const direction=options.direction||null; // 'next' | 'prev' | null
    const animateOpen=options.animateOpen!==false;
    const isSwitch=!!(bookState&&bookState.mid===mid&&bookState.tid!==tid&&direction);

    if(isSwitch){
      await switchTomoAnimated(mid,tid,direction);
      return;
    }

    const book=await fetchTomoBook(mid,tid);
    const saved=getProgress(mid);
    // En apertura fresca desde el menú de tomo, empezar en portada (índice 0)
    // salvo que se pida restaurar progreso explícitamente.
    const start=options.restoreProgress && saved && saved.tomoId===tid
      ? bookProgressPosition(book,mid,tid)
      : (saved&&saved.tomoId===tid&&!animateOpen ? bookProgressPosition(book,mid,tid) : 0);
    await openBookUI(mid,tid,book,start,{fromTomo:true,animateOpen,direction:null});
  }catch(e){
    console.error(e);
    app.innerHTML='<div class="empty">No se pudo cargar el libro.</div>';
  }
}

async function switchTomoAnimated(mid,tid,direction){
  const s=bookState;
  if(!s)return;

  // 1) Cerrar hacia la portada si no estamos en ella
  if(s.index!==0){
    s.index=0;
    s.animDirection='';
    renderBook();
    await playBookAnim('book-anim-close',420);
  }

  // 2) Portada actual sale de la pantalla (mantener estado final hasta montar el nuevo)
  const exitClass=direction==='prev'?'book-anim-tomo-exit-prev':'book-anim-tomo-exit-next';
  await playBookAnim(exitClass,480,{keepClass:true});

  // 3) Cargar tomo nuevo
  let book;
  try{
    book=await fetchTomoBook(mid,tid);
  }catch(e){
    console.error(e);
    app.innerHTML='<div class="empty">No se pudo cargar el libro.</div>';
    return;
  }

  // 4) Montar estado en portada del tomo nuevo
  const {data:m}=await supabaseClient.from('mangas').select('id,nombre').eq('id',mid).single();
  const {data:tomos}=await supabaseClient.from('tomos').select('id,numero,portada_url').eq('manga_id',mid).order('numero');
  const items=flattenBook(book);
  const oldHidden=s.controlsHidden||false;

  bookState={
    mid,tid,book,items,
    index:0,
    controlsHidden:oldHidden,
    mangaName:m?.nombre||'Manga',
    navTomos:tomos||[],
    chapterFlash:false,
    animDirection:'',
    touchX:null,
    imageCache:new Map()
  };

  document.body.classList.add('reader-mode','book-mode');
  document.body.classList.toggle('book-controls-hidden',oldHidden);

  let page=document.querySelector('.book-reader-page');
  if(!page){
    app.innerHTML='<div class="chapter-reader-page book-reader-page"><div id="book-reader"></div></div>';
    page=document.querySelector('.book-reader-page');
  }else if(!document.getElementById('book-reader')){
    page.innerHTML='<div id="book-reader"></div>';
  }

  // 5) Nueva portada entra
  clearBookAnimClasses();
  renderBook();
  const enterClass=direction==='prev'?'book-anim-tomo-enter-prev':'book-anim-tomo-enter-next';
  await playBookAnim(enterClass,480);

  // 6) Se abre solo (animación de apertura sobre la portada)
  await playBookAnim('book-anim-tomo-open',420);

  preloadBookNeighbors();
  window.setTimeout(()=>{ if(bookState) preloadBookNeighbors(); }, 120);
}

async function openBookChapter(mid,tid,cid,tomo,cap){
  try{
    const book=await fetchTomoBook(mid,tid);
    const items=flattenBook(book);
    const start=chapterFirstIndex(items,cid);
    await openBookUI(mid,tid,book,start>0?start:0,{fromTomo:false,animateOpen:true});
  }catch(e){
    console.error(e);
    app.innerHTML='<div class="empty">No se pudo cargar el libro.</div>';
  }
}

function bookIndexToChapter(book,index){
  if(index<=0) return null;
  // Preferir items ya aplanados en bookState para no recalcular flattenBook
  const item=(bookState&&bookState.book===book?bookState.items:null)?.[index]
    || (book?flattenBook(book)[index]:null);
  if(!item||item.type!=='page') return null;
  return {
    chapter:{id:item.chapterId,numero:item.chapter},
    page:item.page,
    numero:item.numero,
    chapterId:item.chapterId
  };
}

function bookCanGoPrev(state){return !!state && (state.index>0 || state.navTomos.findIndex(t=>t.id===state.tid)>0);}
function bookCanGoNext(state){return !!state && (state.index<state.items.length-1 || state.navTomos.findIndex(t=>t.id===state.tid)<state.navTomos.length-1);}

function renderBookPage(item,state,side){
  if(!item){
    return '<div class="book-sheet book-blank" aria-hidden="true"></div>';
  }
  if(item.type==='cover'){
    if(!item.src) return '<div class="book-sheet book-cover-sheet" aria-label="Portada sin imagen"></div>';
    return `<div class="book-sheet book-cover-sheet"><img decoding="async" loading="eager" fetchpriority="high" src="${escapeHtml(item.src)}" alt="Portada del tomo"></div>`;
  }
  return `<div class="book-sheet book-page-sheet"><img decoding="async" loading="eager" fetchpriority="high" src="${escapeHtml(item.src)}" alt="Página ${escapeHtml(String(item.page))}" data-book-page-id="${escapeHtml(item.id||'')}"></div>`;
}

function bookSpreadForState(state){
  const item=getBookItem(state,state.index);
  if(!item) return {desktop:false,left:null,right:null};
  if(item.type==='cover') return {desktop:false,left:null,right:item};
  const desktop=window.innerWidth>=900;
  if(!desktop) return {desktop:false,left:null,right:item};

  // Una pareja N/N+1 jamás cruza de capítulo.
  const next=getBookItem(state,state.index+1);
  const right=item.page%2===1 ? item : getBookItem(state,state.index-1);
  const left=(right && next && next.type==='page' && next.chapterId===right.chapterId && next.page===right.page+1) ? next : null;
  return {desktop:true,left,right};
}

function renderBook(){
  const s=bookState;if(!s) return;

  // Al volver de móvil a escritorio, normalizamos un cursor que haya quedado
  // en una página par para que la página impar vuelva a quedar a la derecha.
  const current=getBookItem(s,s.index);
  if(window.innerWidth>=900 && current?.type==='page' && current.page%2===0){
    const prev=getBookItem(s,s.index-1);
    if(prev?.type==='page' && prev.chapterId===current.chapterId) s.index--;
  }

  const spread=bookSpreadForState(s);
  const currentRight=spread.right;
  const chapterMeta=currentRight?.type==='page'
    ? `Tomo ${s.book.tomo.numero} · Capítulo ${currentRight.chapter} · Página ${currentRight.page}${spread.left?`-${spread.left.page}`:''}`
    : `Portada`;
  const tomoMeta=`Tomo ${s.book.tomo.numero}`;
  const chapterId=currentRight?.type==='page'?currentRight.chapterId:null;

  const nextVisible=bookCanGoNext(s);
  const prevVisible=bookCanGoPrev(s);
  const reader=document.getElementById('book-reader');
  if(!reader) return;

  const nextClass=s.animDirection==='next'?'book-flip-next':s.animDirection==='prev'?'book-flip-prev':'';

  reader.innerHTML=`
    <div class="book-topbar">
      <button class="book-eye" onclick="toggleBookControls()">${s.controlsHidden?eyeClosedIcon():eyeOpenIcon()}</button>
      <div class="book-title">${escapeHtml(s.mangaName)}<small>${escapeHtml(chapterMeta)}</small></div>
      <button class="book-full" onclick="toggleBookFullscreen()">⛶</button>
    </div>
    <div class="book-stage ${spread.desktop?'book-two-pages':''}">
      <button class="book-arrow book-arrow-left ${nextVisible?'':'disabled'}" onclick="bookNext()" ${nextVisible?'':'disabled'} aria-label="Página siguiente">‹</button>
      <div class="book-spread ${nextClass}">
        ${spread.desktop?renderBookPage(spread.left,s,'left'):''}
        ${renderBookPage(spread.right,s,'right')}
      </div>
      <button class="book-arrow book-arrow-right ${prevVisible?'':'disabled'}" onclick="bookPrev()" ${prevVisible?'':'disabled'} aria-label="Página anterior">›</button>
    </div>
    <div class="book-bottom"><span>${escapeHtml(tomoMeta)}</span><span>${s.index===0?'Portada':escapeHtml(chapterMeta)}</span></div>
    ${s.chapterFlash?`<div class="book-chapter-flash">Capítulo ${escapeHtml(String(currentRight?.chapter??''))}</div>`:''}`;

  reader.classList.toggle('book-controls-hidden',s.controlsHidden);
  document.body.classList.toggle('book-controls-hidden',s.controlsHidden);

  const direction=s.animDirection;
  s.animDirection='';
  preloadBookNeighbors();
  if(direction){
    window.setTimeout(()=>{
      if(bookState===s) preloadBookNeighbors();
    },50);
  }
}

function setBookIndex(index,direction){
  const s=bookState;if(!s)return false;
  const next=Math.max(0,Math.min(index,s.items.length-1));
  if(next===s.index)return false;
  s.index=next;
  s.animDirection=direction;
  const currCh=bookIndexToChapter(s.book,s.index)?.chapterId||null;
  const prevCh=bookIndexToChapter(s.book,s.index-(direction==='next'?2:1))?.chapterId||null;
  s.chapterFlash=currCh!==prevCh;
  saveBookProgress();
  renderBook();
  // Precarga inmediata de las siguientes páginas al cambiar de página
  preloadBookNeighbors();
  if(s.chapterFlash){
    window.setTimeout(()=>{if(bookState===s){s.chapterFlash=false;renderBook();}},700);
  }
  return true;
}

async function bookNext(){
  const s=bookState;if(!s)return;
  if(s.index===0){
    if(s.items.length>1){
      setBookIndex(1,'next');
    }else{
      const i=s.navTomos.findIndex(t=>t.id===s.tid);
      if(i>=0&&i<s.navTomos.length-1) await openBookTomo(s.mid,s.navTomos[i+1].id,{direction:'next',animateOpen:false});
    }
    return;
  }

  const item=getBookItem(s,s.index);
  if(!item)return;

  if(window.innerWidth>=900){
    // Si el cursor se encuentra en una página par por una transición de layout,
    // primero se coloca en la pareja correcta.
    if(item.page%2===0){
      setBookIndex(s.index+1,'next');
      return;
    }
    const afterPair=getBookItem(s,s.index+2);
    if(afterPair?.type==='page' && afterPair.chapterId===item.chapterId){
      setBookIndex(s.index+2,'next');
      return;
    }
    // Fin del capítulo -> primera página del siguiente capítulo.
    const nextChapterIndex=s.items.findIndex((x,i)=>i>s.index && x.type==='page' && x.chapterId!==item.chapterId);
    if(nextChapterIndex>0){
      setBookIndex(nextChapterIndex,'next');
      return;
    }
  }else{
    if(s.index<s.items.length-1){
      setBookIndex(s.index+1,'next');
      return;
    }
  }

  const i=s.navTomos.findIndex(t=>t.id===s.tid);
  if(i>=0&&i<s.navTomos.length-1) await openBookTomo(s.mid,s.navTomos[i+1].id,{direction:'next',animateOpen:false});
}

async function bookPrev(){
  const s=bookState;if(!s)return;
  if(s.index===0){
    const i=s.navTomos.findIndex(t=>t.id===s.tid);
    if(i>0) await openBookTomo(s.mid,s.navTomos[i-1].id,{direction:'prev',animateOpen:false});
    return;
  }

  const item=getBookItem(s,s.index);
  if(!item)return;

  if(window.innerWidth>=900){
    if(item.page%2===0){
      setBookIndex(Math.max(1,s.index-1),'prev');
      return;
    }
    if(item.page>2){
      setBookIndex(s.index-2,'prev');
      return;
    }
    // Página 1 de un capítulo: vuelve a la portada si es el primer capítulo,
    // o a la última página (pareja) del capítulo anterior.
    // renderBook corrige automáticamente si caemos en una página par.
    const prevItem=getBookItem(s,s.index-1);
    if(prevItem?.type==='page'&&prevItem.chapterId!==item.chapterId){
      setBookIndex(Math.max(1,s.index-1),'prev');
      return;
    }
    setBookIndex(0,'prev');
    return;
  }

  setBookIndex(s.index-1,'prev');
}

function saveBookProgress(){
  const s=bookState;if(!s)return;
  const cp=bookIndexToChapter(s.book,s.index);
  if(cp) saveProgress(s.mid,s.tid,cp.chapter.id,cp.page);
}

function preloadBookNeighbors(){
  const s=bookState;if(!s)return;
  if(!s.imageCache)s.imageCache=new Map();

  // Prioridad: las 4 siguientes, luego 2 anteriores, luego un poco más adelante.
  // Así al avanzar siempre hay margen de páginas ya en caché del navegador.
  const ordered=[];
  for(let d=1;d<=4;d++) ordered.push(s.index+d);
  for(let d=1;d<=2;d++) ordered.push(s.index-d);
  for(let d=5;d<=8;d++) ordered.push(s.index+d);

  const seen=new Set();
  for(const i of ordered){
    if(i<0||i>=s.items.length||seen.has(i))continue;
    seen.add(i);
    const x=s.items[i];
    if(!x||x.type!=='page'||!x.src)continue;
    if(s.imageCache.has(x.src))continue;
    const im=new Image();
    im.decoding='async';
    // fetchpriority alto solo para las 2 primeras siguientes
    if(i===s.index+1||i===s.index+2){
      try{im.fetchPriority='high';}catch(_){}
    }
    im.src=x.src;
    s.imageCache.set(x.src,im);
  }

  // Limitar tamaño de caché en memoria (mantener ~30 URLs recientes)
  if(s.imageCache.size>40){
    const keys=[...s.imageCache.keys()];
    for(let k=0;k<keys.length-30;k++) s.imageCache.delete(keys[k]);
  }
}

function openNextTomoFromBook(){const s=bookState;if(!s)return;const ti=s.navTomos.findIndex(t=>t.id===s.tid);if(ti>=0&&ti<s.navTomos.length-1)openBookTomo(s.mid,s.navTomos[ti+1].id,{direction:'next',animateOpen:false});}
function openPrevTomoFromBook(){const s=bookState;if(!s)return;const ti=s.navTomos.findIndex(t=>t.id===s.tid);if(ti>0)openBookTomo(s.mid,s.navTomos[ti-1].id,{direction:'prev',animateOpen:false});}

async function openBookUI(mid,tid,book,start,opts={}){
  // Compat: openBookUI(..., true) o openBookUI(..., {fromTomo,animateOpen})
  if(typeof opts==='boolean') opts={fromTomo:opts};
  const fromTomo=!!opts.fromTomo;
  const animateOpen=opts.animateOpen!==false;

  const oldPage=document.querySelector('.book-reader-page');
  const wasFullscreen=!!(oldPage&&(document.fullscreenElement===oldPage||document.webkitFullscreenElement===oldPage));
  const oldHidden=bookState?.controlsHidden||false;
  const wasAlreadyBook=!!bookState && document.body.classList.contains('book-mode');

  const {data:m}=await supabaseClient.from('mangas').select('id,nombre').eq('id',mid).single();
  const {data:tomos}=await supabaseClient.from('tomos').select('id,numero,portada_url').eq('manga_id',mid).order('numero');
  const items=flattenBook(book);
  bookState={
    mid,tid,book,items,
    index:Math.max(0,Math.min(Number(start)||0,Math.max(items.length-1,0))),
    controlsHidden:oldHidden,
    mangaName:m?.nombre||'Manga',
    navTomos:tomos||[],
    chapterFlash:false,
    animDirection:'',
    touchX:null,
    imageCache:bookState?.imageCache instanceof Map ? bookState.imageCache : new Map()
  };

  // En escritorio, nunca arrancamos en una página par como derecha.
  const initial=getBookItem(bookState,bookState.index);
  const prev=getBookItem(bookState,bookState.index-1);
  if(window.innerWidth>=900 && initial?.type==='page' && initial.page%2===0 && prev?.type==='page'&&prev.chapterId===initial.chapterId){
    bookState.index--;
  }

  document.body.classList.add('reader-mode','book-mode');
  document.body.classList.toggle('book-controls-hidden',oldHidden);
  if(oldPage){
    if(!document.getElementById('book-reader')) oldPage.innerHTML='<div id="book-reader"></div>';
  }else{
    app.innerHTML='<div class="chapter-reader-page book-reader-page"><div id="book-reader"></div></div>';
  }

  renderBook();
  preloadBookNeighbors();
  window.setTimeout(()=>{ if(bookState) preloadBookNeighbors(); }, 120);

  // Animación de apertura del libro (solo si no venimos de un cambio de tomo animado)
  if(animateOpen && !wasAlreadyBook){
    await playBookAnim('book-anim-open',560);
  }

  const page=document.querySelector('.book-reader-page');
  if(wasFullscreen&&page&&!document.fullscreenElement){
    try{
      if(page.requestFullscreen) await page.requestFullscreen();
      else if(page.webkitRequestFullscreen) page.webkitRequestFullscreen();
    }catch(e){console.warn(e)}
  }
  try{
    if(document.fullscreenElement&&screen.orientation?.lock) await screen.orientation.lock('landscape');
  }catch(e){}
}

function toggleBookControls(){if(!bookState)return;bookState.controlsHidden=!bookState.controlsHidden;renderBook();}
async function toggleBookFullscreen(){const p=document.querySelector('.book-reader-page');if(!p)return;try{if(!document.fullscreenElement){if(p.requestFullscreen)await p.requestFullscreen();else if(p.webkitRequestFullscreen)p.webkitRequestFullscreen();}else if(document.exitFullscreen)await document.exitFullscreen();}catch(e){console.error(e)}}

document.addEventListener('keydown',e=>{
  if(!bookState)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if(e.key==='ArrowLeft'){e.preventDefault();bookNext();}
  else if(e.key==='ArrowRight'){e.preventDefault();bookPrev();}
  else if(e.key==='Escape'&&document.fullscreenElement)document.exitFullscreen?.();
});

document.addEventListener('touchstart',e=>{if(!bookState||e.touches.length!==1)return;bookState.touchX=e.touches[0].clientX;},{passive:true});
document.addEventListener('touchend',e=>{if(!bookState||bookState.touchX==null)return;const dx=e.changedTouches[0].clientX-bookState.touchX;bookState.touchX=null;if(Math.abs(dx)>55){if(dx<0)bookNext();else bookPrev();}},{passive:true});


function setupNormalProgress(target,mid,tid,cid){
  if(!target)return;
  if(target._progressCleanup)target._progressCleanup();
  let lastSaved=0;
  const isFs=()=>document.fullscreenElement===target||document.webkitFullscreenElement===target;
  const saveCurrent=()=>{
    const imgs=[...target.querySelectorAll('#reader img[data-page-number]')];
    if(!imgs.length)return;
    const viewH=isFs()?target.clientHeight:window.innerHeight;
    let best=null,bestScore=-Infinity;
    for(const img of imgs){
      const r=img.getBoundingClientRect();
      // Prefer the page whose top is near the upper third of the viewport
      if(r.bottom<=40||r.top>=viewH-20)continue;
      const score=-(Math.abs(r.top-viewH*0.12))+Math.min(r.height,viewH)*0.001;
      if(score>bestScore){bestScore=score;best=img;}
    }
    if(!best){
      for(const img of imgs){
        const r=img.getBoundingClientRect();
        if(r.bottom>60&&r.top<viewH-60){best=img;break;}
      }
    }
    if(best){
      const page=Number(best.getAttribute('data-page-number'))||1;
      if(page!==lastSaved){
        lastSaved=page;
        saveProgress(mid,tid,cid,page);
      }
    }
  };
  let ticking=false;
  const onScroll=()=>{
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(()=>{saveCurrent();ticking=false;});
  };
  const onWindowScroll=()=>{if(!isFs())onScroll();};
  const onTargetScroll=()=>{if(isFs())onScroll();};
  window.addEventListener('scroll',onWindowScroll,{passive:true});
  target.addEventListener('scroll',onTargetScroll,{passive:true});
  target._progressCleanup=()=>{
    window.removeEventListener('scroll',onWindowScroll);
    target.removeEventListener('scroll',onTargetScroll);
  };
  setTimeout(saveCurrent,120);
}

function restoreNormalProgress(mid,tid,cid,pagesLength,target){const p=getProgress(mid);if(!p||p.tomoId!==tid||p.chapterId!==cid)return;const page=Math.max(1,Math.min(p.page||1,pagesLength||1));setTimeout(()=>{const img=target.querySelector(`img[data-page-number="${page}"]`);if(img)img.scrollIntoView({block:'start'});},80);}


window.addEventListener('error', e => {
  console.error('LeeMangasCross:', e.error || e.message);
});
window.addEventListener('unhandledrejection', e => {
  console.error('LeeMangasCross:', e.reason);
});

loadMangas();
