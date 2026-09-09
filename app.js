let mangas=[];
let readerSize=localStorage.getItem('lfm_reader_size') || 'normal';
let readerWidth=localStorage.getItem('lfm_reader_width') || 'normal';

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

function renderHome(list){
 app.innerHTML='<h1>Todos los mangas</h1>'+(list.length
 ?'<div class="grid">'+list.map(m=>`
 <article class="card" onclick="openManga('${m.id}')">
 <img src="${m.portada_url||''}" alt="">
 <h3>${escapeHtml(m.nombre)}</h3>
 </article>`).join('')+'</div>'
 :'<div class="empty">Todavía no hay mangas.</div>');
}

function filterMangas(){
 const q=document.getElementById('search').value.toLowerCase();
 renderHome(mangas.filter(m=>m.nombre.toLowerCase().includes(q)));
}

function goHome(){
 history.pushState({},'',location.pathname);
 document.getElementById('search').value='';
 renderHome(mangas);
}

async function openManga(id){
 document.body.classList.remove('reader-mode');
 const {data:m}=await supabaseClient.from('mangas').select('*').eq('id',id).single();
 const {data:ts}=await supabaseClient.from('tomos').select('*').eq('manga_id',id).order('numero');

 app.innerHTML=`
 <button class="back" onclick="goHome()">← Inicio</button>
 <h1>${escapeHtml(m.nombre)}</h1>
 ${m.descripcion?'<p>'+escapeHtml(m.descripcion)+'</p>':''}
 <h2>Tomos</h2>
 <div class="tomos">
 ${(ts||[]).map(t=>`
 <div class="tomo" onclick="openTomo('${id}','${t.id}',${t.numero})">
 Tomo ${t.numero}
 </div>`).join('')||'<div class="empty">Sin tomos todavía.</div>'}
 </div>`;
}

async function openTomo(mid,tid,num){
 document.body.classList.remove('reader-mode');
 const {data:cs}=await supabaseClient.from('capitulos').select('*').eq('tomo_id',tid).order('numero');

 app.innerHTML=`
 <button class="back" onclick="openManga('${mid}')">← Volver al manga</button>
 <h1>Tomo ${num}</h1>
 <div class="chapters">
 ${(cs||[]).map(c=>`
 <div class="chapter" onclick="openChapter('${mid}','${tid}','${c.id}',${num},${c.numero})">
 Capítulo ${c.numero}
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

function chapterButton(direction, chapter, label){
  if(!chapter) return `<button class="chapter-nav-btn disabled" disabled>${direction}</button>`;
  return `<button class="chapter-nav-btn" onclick="openChapter('${chapter.mangaId}','${chapter.tomoId}','${chapter.id}',${chapter.tomo},${chapter.cap})">${direction}</button>`;
}

async function openChapter(mid,tid,cid,tomo,cap){
 document.body.classList.add('reader-mode');
 app.innerHTML='<div class="loading">Cargando capítulo...</div>';

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
   app.innerHTML='<div class="empty">Error al cargar.</div>';
   return;
 }

 const index=nav.index;
 const previous=index>0 ? {...nav.chapters[index-1],mangaId:mid} : null;
 const next=index>=0 && index<nav.chapters.length-1 ? {...nav.chapters[index+1],mangaId:mid} : null;
 const totalChapters=nav.chapters.length || 1;

 app.innerHTML=`
 <div class="chapter-reader-page">
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
   </aside>

   <div class="chapter-reader-content">
     <button class="back" onclick="openTomo('${mid}','${tid}',${tomo})">← Volver al tomo</button>

     <div class="reader-header reader-meta-top">
       <div class="reader-meta-name">${escapeHtml(nav.mangaName)}</div>
       <div class="reader-meta-location">Tomo ${tomo} · Capítulo ${cap}</div>
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
         <div class="chapter-location">Tomo ${tomo} · Capítulo ${cap}</div>
         <div class="chapter-counter">Capítulo ${index>=0?index+1:cap} de ${totalChapters}</div>
       </div>

       <button class="chapter-nav-btn ${next?'':'disabled'}"
         ${next ? `onclick="openChapter('${mid}','${next.tomoId}','${next.id}',${next.tomo},${next.cap})"` : 'disabled'}
         aria-label="Capítulo siguiente">›</button>
     </div>
   </div>
 </div>`;

 window.scrollTo(0,0);
}

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
