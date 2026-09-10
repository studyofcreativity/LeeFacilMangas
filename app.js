let mangas=[];
let readerSize=localStorage.getItem('lfm_reader_size') || 'normal';
let readerWidth=localStorage.getItem('lfm_reader_width') || 'normal';
let chapterViewMode=localStorage.getItem('lfm_chapter_view_mode') || 'tomos';
let readerControlsHidden=false;

const app=document.getElementById('app');

async function loadMangas(){
 app.innerHTML='<div class="loading">Cargando mangas...</div>';
 const {data,error}=await supabaseClient.from('mangas').select('*').order('nombre');
 if(error){app.innerHTML='<div class="empty">Error: '+escapeHtml(error.message)+'</div>';return}
 mangas=data||[];
 renderHome(mangas);
}

function escapeHtml(s=''){
 const d=document.createElement('div');
 d.textContent=s;
 return d.innerHTML;
}

function setChapterViewMode(mode){
 chapterViewMode=mode==='capitulos'?'capitulos':'tomos';
 localStorage.setItem('lfm_chapter_view_mode',chapterViewMode);
 renderHome(mangas);
}

function chapterModeMenu(){
 return `
 <section class="view-mode-panel">
   <div class="view-mode-title">Modo de visualización</div>
   <div class="view-mode-options">
     <button class="view-mode-btn ${chapterViewMode==='tomos'?'active':''}" onclick="setChapterViewMode('tomos')">
       📚 Ver dividido en tomos
     </button>
     <button class="view-mode-btn ${chapterViewMode==='capitulos'?'active':''}" onclick="setChapterViewMode('capitulos')">
       📖 Ver solo capítulos
     </button>
   </div>
   <div class="view-mode-help">
     ${chapterViewMode==='tomos'
       ? 'Los capítulos se muestran dentro de cada tomo.'
       : 'Los capítulos aparecen juntos y se indica a qué tomo pertenece cada uno.'}
   </div>
 </section>`;
}

function renderHome(list){
 app.innerHTML=`
 <h1>Todos los mangas</h1>
 ${chapterModeMenu()}
 ${list.length
 ?'<div class="grid">'+list.map(m=>`
 <article class="card" onclick="openManga('${m.id}')">
   <img src="${m.portada_url||''}" alt="">
   <h3>${escapeHtml(m.nombre)}</h3>
 </article>`).join('')+'</div>'
 :'<div class="empty">Todavía no hay mangas.</div>'}`;
}

function filterMangas(){
 const q=document.getElementById('search').value.toLowerCase();
 renderHome(mangas.filter(m=>m.nombre.toLowerCase().includes(q)));
}

function goHome(){
 history.pushState({},'',location.pathname);
 document.getElementById('search').value='';
 document.body.classList.remove('reader-mode','reader-controls-hidden');
 readerControlsHidden=false;
 renderHome(mangas);
}

async function openManga(id){
 document.body.classList.remove('reader-mode','reader-controls-hidden');
 readerControlsHidden=false;
 const {data:m,error:mangaError}=await supabaseClient.from('mangas').select('*').eq('id',id).single();
 if(mangaError||!m){app.innerHTML='<div class="empty">No se pudo cargar el manga.</div>';return}
 const {data:ts}=await supabaseClient.from('tomos').select('*').eq('manga_id',id).order('numero');

 if(chapterViewMode==='capitulos'){
   const allChapters=[];
   for(const t of (ts||[])){
     const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',t.id).order('numero');
     (cs||[]).forEach(c=>allChapters.push({...c,tomoNumero:t.numero,tomoId:t.id}));
   }

   app.innerHTML=`
   <button class="back" onclick="goHome()">← Inicio</button>
   <h1>${escapeHtml(m.nombre)}</h1>
   ${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}
   <div class="chapter-view-heading">Todos los capítulos</div>
   <div class="chapters chapters-all">
     ${allChapters.map(c=>`
       <div class="chapter chapter-all-item" onclick="openChapter('${id}','${c.tomoId}','${c.id}',${c.tomoNumero},${c.numero})">
         <span>Capítulo ${escapeHtml(String(c.numero))}</span>
         <small>Tomo ${escapeHtml(String(c.tomoNumero))}</small>
       </div>`).join('')||'<div class="empty">Sin capítulos todavía.</div>'}
   </div>`;
   return;
 }

 app.innerHTML=`
 <button class="back" onclick="goHome()">← Inicio</button>
 <h1>${escapeHtml(m.nombre)}</h1>
 ${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}
 <h2>Tomos</h2>
 <div class="tomos">
 ${(ts||[]).map(t=>`
 <div class="tomo" onclick="openTomo('${id}','${t.id}',${t.numero})">
 Tomo ${escapeHtml(String(t.numero))}
 </div>`).join('')||'<div class="empty">Sin tomos todavía.</div>'}
 </div>`;
}

async function openTomo(mid,tid,num){
 document.body.classList.remove('reader-mode','reader-controls-hidden');
 readerControlsHidden=false;
 const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',tid).order('numero');

 app.innerHTML=`
 <button class="back" onclick="openManga('${mid}')">← Volver al manga</button>
 <h1>Tomo ${escapeHtml(String(num))}</h1>
 <div class="chapters">
 ${(cs||[]).map(c=>`
 <div class="chapter" onclick="openChapter('${mid}','${tid}','${c.id}',${num},${c.numero})">
 Capítulo ${escapeHtml(String(c.numero))}
 </div>`).join('')||'<div class="empty">Sin capítulos todavía.</div>'}
 </div>`;
}

async function getChapterNavigation(mid, tid, cid, currentTomo, currentCap){
  const {data:manga} = await supabaseClient
    .from('mangas')
    .select('id,nombre')
    .eq('id',mid)
    .single();

  const {data:tomos,error:tomosError} = await supabaseClient
    .from('tomos')
    .select('id,numero')
    .eq('manga_id',mid)
    .order('numero');

  if(tomosError || !tomos){
    return {mangaName:manga?.nombre || 'Manga', chapters:[], index:-1};
  }

  const chapters=[];
  for(const tomo of tomos){
    const {data:cs} = await supabaseClient
      .from('capitulos')
      .select('id,numero')
      .eq('tomo_id',tomo.id)
      .order('numero');

    (cs||[]).forEach(c=>{
      chapters.push({
        id:c.id,
        tomoId:tomo.id,
        tomo:tomo.numero,
        cap:c.numero
      });
    });
  }

  const index=chapters.findIndex(c=>c.id===cid);
  return {
    mangaName:manga?.nombre || 'Manga',
    chapters,
    index
  };
}

async function openChapter(mid,tid,cid,tomo,cap){
 const existingPage=document.querySelector('.chapter-reader-page');
 const wasReaderOpen=!!existingPage;
 const wasControlsHidden=readerControlsHidden;
 
 document.body.classList.add('reader-mode');
 if(!wasReaderOpen){
   readerControlsHidden=false;
   document.body.classList.remove('reader-controls-hidden');
 }
 
 // Important: when changing chapters, keep the existing .chapter-reader-page.
 // This preserves browser fullscreen automatically instead of replacing the fullscreen element.
 const pageTarget=existingPage || null;
 if(pageTarget){
   const content=pageTarget.querySelector('.chapter-reader-content');
   if(content) content.innerHTML='<div class="loading">Cargando capítulo...</div>';
 }else{
   app.innerHTML='<div class="chapter-reader-page"><div class="chapter-reader-content"><div class="loading">Cargando capítulo...</div></div></div>';
 }
 
 const [pagesResult, nav] = await Promise.all([
   supabaseClient
     .from('paginas')
     .select('*')
     .eq('capitulo_id',cid)
     .order('numero'),
   getChapterNavigation(mid,tid,cid,tomo,cap)
 ]);
 
 const pages=pagesResult.data;
 const error=pagesResult.error;
 if(error){
   const target=document.querySelector('.chapter-reader-page');
   if(target) target.querySelector('.chapter-reader-content').innerHTML='<div class="empty">Error al cargar.</div>';
   return;
 }
 
 const index=nav.index;
 const previous=index>0 ? {...nav.chapters[index-1],mangaId:mid} : null;
 const next=index>=0 && index<nav.chapters.length-1 ? {...nav.chapters[index+1],mangaId:mid} : null;
 const totalChapters=nav.chapters.length || 1;
 
 const target=document.querySelector('.chapter-reader-page');
 if(!target) return;
 
 // Keep the reader controls state when moving to another chapter.
 readerControlsHidden=wasReaderOpen ? wasControlsHidden : false;
 document.body.classList.toggle('reader-controls-hidden',readerControlsHidden);
 
 target.innerHTML=`
   <aside class="reader-toolbar">
     <div class="toolbar-title">Lectura</div>
     <div class="toolbar-section">
       <div class="toolbar-label">Tamaño</div>
       <button class="size-btn ${readerSize==='chico'?'active':''}" onclick="setReaderSize('chico')">Chico</button>
       <button class="size-btn ${readerSize==='normal'?'active':''}" onclick="setReaderSize('normal')">Normal</button>
       <button class="size-btn ${readerSize==='grande'?'active':''}" onclick="setReaderSize('grande')">Grande</button>
       <button class="size-btn ${readerSize==='muy-grande'?'active':''}" onclick="setReaderSize('muy-grande')">Muy grande</button>
     </div>
     <div class="toolbar-section">
       <div class="toolbar-label">Ancho</div>
       <button class="width-btn ${readerWidth==='estrecho'?'active':''}" onclick="setReaderWidth('estrecho')">Estrecho</button>
       <button class="width-btn ${readerWidth==='normal'?'active':''}" onclick="setReaderWidth('normal')">Normal</button>
       <button class="width-btn ${readerWidth==='gordo'?'active':''}" onclick="setReaderWidth('gordo')">Gordo</button>
       <button class="width-btn ${readerWidth==='muy-gordo'?'active':''}" onclick="setReaderWidth('muy-gordo')">Muy gordo</button>
     </div>
     <div class="toolbar-section toolbar-fullscreen">
       <button id="fullscreenBtn" class="fullscreen-btn" onclick="toggleFullscreen()">⛶ Pantalla completa</button>
     </div>
   </aside>
 
   <div class="chapter-reader-content">
     <button class="back" onclick="openTomo('${mid}','${tid}',${tomo})">← Volver al tomo</button>
 
     <div class="reader-header reader-meta-top">
       <div class="reader-meta-title-row">
         <div class="reader-meta-name">${escapeHtml(nav.mangaName)}</div>
         <button id="reader-eye-toggle" class="reader-eye-toggle" type="button" onclick="toggleReaderControls()" aria-label="${readerControlsHidden?'Mostrar menú':'Ocultar menú'}" title="${readerControlsHidden?'Mostrar menú':'Ocultar menú'}">
           ${readerControlsHidden?eyeClosedIcon():eyeOpenIcon()}
         </button>
       </div>
       <div class="reader-meta-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div>
     </div>
 
     <button class="reader-side-nav reader-side-prev ${previous?'':'disabled'}"
       ${previous ? `onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"` : 'disabled'}
       aria-label="Capítulo anterior">‹</button>
 
     <button class="reader-side-nav reader-side-next ${next?'':'disabled'}"
       ${next ? `onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"` : 'disabled'}
       aria-label="Capítulo siguiente">›</button>
 
     <div class="reader-wrap">
       <div id="reader" class="reader size-${readerSize} width-${readerWidth}">
       ${(pages||[]).map(p=>`
         <img loading="lazy" src="${p.imagen_url}" alt="Página ${p.numero}">
       `).join('')||'<div class="empty">Este capítulo no tiene páginas.</div>'}
       </div>
     </div>
 
     <div class="chapter-bottom-nav">
       <button class="chapter-nav-btn ${previous?'':'disabled'}"
         ${previous ? `onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"` : 'disabled'}
         aria-label="Capítulo anterior">‹</button>
 
       <div class="chapter-info">
         <div class="chapter-manga-name">${escapeHtml(nav.mangaName)}</div>
         <div class="chapter-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div>
         <div class="chapter-counter">Capítulo ${index>=0?index+1:escapeHtml(String(cap))} de ${totalChapters}</div>
       </div>
 
       <button class="chapter-nav-btn ${next?'':'disabled'}"
         ${next ? `onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"` : 'disabled'}
         aria-label="Capítulo siguiente">›</button>
     </div>
 
     <div id="chapter-end-prompt" class="chapter-end-prompt" aria-live="polite">
       <button class="chapter-end-arrow chapter-end-prev ${previous?'':'disabled'}"
         ${previous ? `onclick="openChapter('${mid}','${previous.tomoId}','${previous.id}',${previous.tomo},${previous.cap})"` : 'disabled'}
         aria-label="Capítulo anterior">‹</button>
       <div class="chapter-end-info">
         <div class="chapter-end-manga">${escapeHtml(nav.mangaName)}</div>
         <div class="chapter-end-location">Tomo ${escapeHtml(String(tomo))} · Capítulo ${escapeHtml(String(cap))}</div>
       </div>
       <button class="chapter-end-arrow chapter-end-next ${next?'':'disabled'}"
         ${next ? `onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"` : 'disabled'}
         aria-label="Capítulo siguiente">›</button>
     </div>
   </div>`;
 
 updateEyeButton();
 updateFullscreenButton();
 setupChapterEndPrompt(target);
 
 // Scroll to the beginning of the new chapter without leaving fullscreen.
 if(target && (document.fullscreenElement===target || document.webkitFullscreenElement===target)){
   target.scrollTop=0;
 }else{
   window.scrollTo(0,0);
 }
}

function setupChapterEndPrompt(target){
 if(!target) return;
 if(target._endPromptCleanup) target._endPromptCleanup();
 const prompt=target.querySelector('#chapter-end-prompt');
 if(!prompt) return;
 
 const isFullscreen=()=>document.fullscreenElement===target || document.webkitFullscreenElement===target;
 const getScrollMetrics=()=> isFullscreen()
   ? {top:target.scrollTop,height:target.scrollHeight,view:target.clientHeight}
   : {top:window.scrollY,height:document.documentElement.scrollHeight,view:window.innerHeight};
 
 const check=()=>{
   const m=getScrollMetrics();
   const nearBottom=(m.top+m.view)>=m.height-70;
   prompt.classList.toggle('show',nearBottom);
   target.classList.toggle('chapter-at-end',nearBottom);

   // At the end of a chapter there must be ONLY the end-of-chapter navigation.
   // Hide the normal side/bottom navigation explicitly as well as through CSS,
   // so it cannot appear duplicated in browsers with different CSS support.
   const sideNavs=target.querySelectorAll('.reader-side-nav');
   const bottomNav=target.querySelector('.chapter-bottom-nav');
   sideNavs.forEach(el=>{ el.style.display=nearBottom?'none':''; });
   if(bottomNav) bottomNav.style.display=nearBottom?'none':'';
   prompt.style.display=nearBottom?'flex':'';
 };
 const onWindowScroll=()=>{ if(!isFullscreen()) check(); };
 const onTargetScroll=()=>{ if(isFullscreen()) check(); };
 window.addEventListener('scroll',onWindowScroll,{passive:true});
 target.addEventListener('scroll',onTargetScroll,{passive:true});
 window.addEventListener('resize',check,{passive:true});
 
 target._endPromptCleanup=()=>{
   window.removeEventListener('scroll',onWindowScroll);
   target.removeEventListener('scroll',onTargetScroll);
   window.removeEventListener('resize',check);
 };
 check();
}

function eyeOpenIcon(){
 return '<svg class="eye-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
}
function eyeClosedIcon(){
 return '<svg class="eye-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4.5 9.5C6.3 7.4 8.8 6 12 6c6.5 0 10 6 10 6-.9 1.5-2.1 2.8-3.5 3.8M4.5 9.5C3 10.7 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function updateEyeButton(){
 const btn=document.getElementById('reader-eye-toggle');
 if(!btn) return;
 btn.innerHTML=readerControlsHidden?eyeClosedIcon():eyeOpenIcon();
 btn.setAttribute('aria-label',readerControlsHidden?'Mostrar menú':'Ocultar menú');
 btn.setAttribute('title',readerControlsHidden?'Mostrar menú':'Ocultar menú');
 btn.classList.toggle('closed',readerControlsHidden);
}

function toggleReaderControls(){
 if(!document.body.classList.contains('reader-mode')) return;
 readerControlsHidden=!readerControlsHidden;
 document.body.classList.toggle('reader-controls-hidden',readerControlsHidden);
 updateEyeButton();
}

async function toggleFullscreen(){
 const target=document.querySelector('.chapter-reader-page');
 if(!target) return;
 try{
   if(!document.fullscreenElement && !document.webkitFullscreenElement){
     if(target.requestFullscreen) await target.requestFullscreen();
     else if(target.webkitRequestFullscreen) target.webkitRequestFullscreen();
   }else{
     if(document.exitFullscreen) await document.exitFullscreen();
     else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
   }
 }catch(e){
   console.error('No se pudo activar pantalla completa:',e);
 }
}

function updateFullscreenButton(){
 const btn=document.getElementById('fullscreenBtn');
 if(!btn) return;
 btn.textContent=(document.fullscreenElement || document.webkitFullscreenElement) ? '⛶ Salir de pantalla completa' : '⛶ Pantalla completa';
}

document.addEventListener('fullscreenchange',updateFullscreenButton);
document.addEventListener('webkitfullscreenchange',updateFullscreenButton);

function updateReaderClass(){
 const reader=document.getElementById('reader');
 if(reader){
   reader.className='reader size-'+readerSize+' width-'+readerWidth;
 }
}

function setReaderSize(size){
 readerSize=size;
 localStorage.setItem('lfm_reader_size',size);
 updateReaderClass();
 document.querySelectorAll('.size-btn').forEach(btn=>btn.classList.remove('active'));
 const map={chico:0,normal:1,grande:2,'muy-grande':3};
 const buttons=[...document.querySelectorAll('.size-btn')];
 if(buttons[map[size]]) buttons[map[size]].classList.add('active');
}

function setReaderWidth(width){
 readerWidth=width;
 localStorage.setItem('lfm_reader_width',width);
 updateReaderClass();
 document.querySelectorAll('.width-btn').forEach(btn=>btn.classList.remove('active'));
 const map={estrecho:0,normal:1,gordo:2,'muy-gordo':3};
 const buttons=[...document.querySelectorAll('.width-btn')];
 if(buttons[map[width]]) buttons[map[width]].classList.add('active');
}

loadMangas();
