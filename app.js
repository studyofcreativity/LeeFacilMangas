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

async function openChapter(mid,tid,cid,tomo,cap){
 app.innerHTML='<div class="loading">Cargando capítulo...</div>';

 const {data:pages,error}=await supabaseClient
   .from('paginas')
   .select('*')
   .eq('capitulo_id',cid)
   .order('numero');

 if(error){
   app.innerHTML='<div class="empty">Error al cargar.</div>';
   return;
 }

 app.innerHTML=`
 <button class="back" onclick="openTomo('${mid}','${tid}',${tomo})">← Volver al tomo</button>

 <div class="reader-header">
   <h2 class="reader-title">Tomo ${tomo} / Capítulo ${cap}</h2>

   <div class="reader-settings">

     <div class="setting-group">
       <span class="settings-label">Tamaño:</span>
       <button class="size-btn ${readerSize==='chico'?'active':''}" onclick="setReaderSize('chico')">Chico</button>
       <button class="size-btn ${readerSize==='normal'?'active':''}" onclick="setReaderSize('normal')">Normal</button>
       <button class="size-btn ${readerSize==='grande'?'active':''}" onclick="setReaderSize('grande')">Grande</button>
       <button class="size-btn ${readerSize==='muy-grande'?'active':''}" onclick="setReaderSize('muy-grande')">Muy grande</button>
     </div>

     <div class="setting-group width-group">
       <span class="settings-label width-label">Ancho de página:</span>
       <button title="Página más estrecha" class="width-btn ${readerWidth==='estrecho'?'active':''}" onclick="setReaderWidth('estrecho')">Estrecho</button>
       <button title="Ancho normal" class="width-btn ${readerWidth==='normal'?'active':''}" onclick="setReaderWidth('normal')">Normal</button>
       <button title="Página más ancha" class="width-btn ${readerWidth==='gordo'?'active':''}" onclick="setReaderWidth('gordo')">Gordo</button>
       <button title="Página mucho más ancha" class="width-btn ${readerWidth==='muy-gordo'?'active':''}" onclick="setReaderWidth('muy-gordo')">Muy gordo</button>
     </div>

   </div>
 </div>

 <div class="reader-wrap">
   <div id="reader" class="reader size-${readerSize} width-${readerWidth}">
   ${(pages||[]).map(p=>`
     <img loading="lazy" src="${p.imagen_url}" alt="Página ${p.numero}">
   `).join('')||'<div class="empty">Este capítulo no tiene páginas.</div>'}
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
