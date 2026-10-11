/* ===== Editor 3D de polos (integrado en la etapa de diseño) =====
   Usa el visor de Sketchfab: tiñe el tejido y estampa el logo sobre el mapa UV del modelo, y genera las vistas 2D.
   Se carga solo cuando el usuario abre el editor, para no afectar al resto de la página. */
const Designer=(()=>{
const E=id=>document.getElementById(id),QA=s=>[...document.querySelectorAll(s)];
const MODEL='97b22f6ab3a74beb8004cddac53dee19',SF_SRC='https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js';
const MOBILE=matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<820;
// Calibración medida sobre el mapa UV de este modelo (u a la derecha, v hacia abajo).
const CM=1/106,ZC=.336,FOV=20,TEX_LIVE=2048,TEX_HQ=MOBILE?3072:4096,NRM_RES=MOBILE?2048:4096;
const POS={
 pecho:{label:'Pecho izquierdo',u:.338,v:.548,logo:9,text:1.6,tw:11,view:'f',side:'izq'},
 centro:{label:'Centro del pecho',u:.2475,v:.665,logo:24,text:3.2,tw:30,view:'f'},
 derecho:{label:'Pecho derecho',u:.157,v:.548,logo:9,text:1.6,tw:11,view:'f',side:'der'},
 espalda:{label:'Espalda',u:.712,v:.575,logo:28,text:3.4,tw:23,view:'b'},
 nuca:{label:'Nuca',u:.712,v:.437,logo:7,text:1.2,tw:9,view:'b'},
 mangaIzq:{label:'Manga izquierda',u:.52,v:.27,logo:7,text:1.1,tw:8,view:'l',side:'izq'},
 mangaDer:{label:'Manga derecha',u:.178,v:.27,logo:7,text:1.1,tw:8,view:'l',side:'der'}};
// Puntos del selector visual (figura, x %, y %). La manga izquierda del polo queda a la derecha del frente.
const SPOT={pecho:['f',62,33],derecho:['f',38,33],centro:['f',50,58],mangaIzq:['f',88,29],mangaDer:['f',12,29],nuca:['b',50,18],espalda:['b',50,45]};
// Corpotex trabaja polos de 2 botones. Los 4 del modelo son una sola pieza: se ocultan y se dibujan 2 sobre la tapeta (color + relieve).
const BTN={v:.381,ru:.0049,rv:.0046,at:[.4745,.4245]};
const VIEWS={f:{label:'Frente',file:'frente',ang:0},q:{label:'Media lateral',file:'media-lateral',ang:45},l:{label:'Lateral',file:'lateral',ang:90},b:{label:'Espalda',file:'espalda',ang:180}},ORDER=['f','q','l','b'];
const RES={1600:[1600,2000],2400:[2400,3000]};
const STEPS=['Colores','Estampado','Ubicación','Vista previa'];
const COLORS=[['#ffffff','Blanco'],['#1e2225','Negro'],['#243c5c','Azul marino'],['#2f55b8','Azul rey'],['#8fb8de','Celeste'],['#aa3232','Rojo'],['#6d1f2f','Vino'],['#426044','Verde'],['#e9c367','Amarillo'],['#e0702c','Naranja'],['#b5b6b7','Gris'],['#d6c8b3','Beige']];
const DEF={color:'#ffffff',trim:'#ffffff',buttons:'#ffffff',trimLinked:true,btnLinked:true,text:'',textColor:'#242b2a',font:'Outfit',weight:700,textScale:1,logoScale:1,pos:'pecho',offX:0,offY:0,side:'izq',bg:'transparent',res:'1600'};
const LOGO_MAX=8*1024*1024,PNG_SIG=[0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A];
let st={...DEF,img:null,logoName:'',logoFile:null};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),clone=o=>JSON.parse(JSON.stringify(o));
let api=null,exporting=false,ver=0,spinT=0,step=0,mounted=false,failed=false,silent=false,small=null,loadT=0,ctxKey='pedido';
// Opciones que fija la página según el contexto (pedido nuevo o modificación de un pedido registrado).
const opts={allowStamp:true,stampNote:'',doneLabel:'Usar este diseño →',backLabel:'← Estilos'};
const sf={ready:false,angle:0,view:'f'},cv={},blobs=new Map(),contexts=new Map();let shots={};
const hooks={nav(){},back(){},change(){},done(){},skip(){}};
const call=(fn,...a)=>new Promise((res,rej)=>api[fn](...a,(err,val)=>err?rej(err):res(val)));
const loadImg=(src,cors)=>new Promise((res,rej)=>{const i=new Image();if(cors)i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=src});
const hexLin=h=>[1,3,5].map(i=>{const c=parseInt(h.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
const toBlob=c=>new Promise(r=>c.toBlob(r,'image/png'));
const mk=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const note=t=>(window.toast||console.log)(t);
function download(name,href){const a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove()}
function saveBlob(b,name){const u=URL.createObjectURL(b);download(name,u);setTimeout(()=>URL.revokeObjectURL(u),8000);note('Descargado: '+name)}
const canShare=(()=>{try{return!!(navigator.canShare&&navigator.canShare({files:[new File([new Blob(['x'])],'x.png',{type:'image/png'})]}))}catch(e){return false}})();
async function shareBlob(b,name,title){try{await navigator.share({files:[new File([b],name,{type:'image/png'})],title})}catch(e){if(e.name!=='AbortError')saveBlob(b,name)}}

/* ---------- Visor ---------- */
function setLoader(t,p,sub){if(t)E('d3LoaderTxt').textContent=t;if(p!=null)E('d3LoaderBar').style.width=Math.round(p*100)+'%';if(sub)E('d3LoaderSub').textContent=sub}
function fail(e){if(e)console.error(e);failed=true;const v=E('d3Loader');v.classList.add('on','err');setLoader('No se pudo cargar el polo 3D',null,'El editor necesita conexión a internet para descargar el modelo. Revisa tu conexión y recarga la página, o continúa sin editor: nuestro equipo de diseño preparará tu propuesta.');E('d3Skip').hidden=false;updateFoot()}
function loadScript(src){return new Promise((res,rej)=>{if(window.Sketchfab)return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
function loadFonts(){if(document.getElementById('d3Fonts'))return;const l=document.createElement('link');l.id='d3Fonts';l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=Outfit:wght@700&display=swap';document.head.appendChild(l)}
function startViewer(){loadFonts();loadT=setTimeout(()=>{if(!sf.ready&&!failed){setLoader(null,null,'La carga está tardando más de lo normal. Puedes esperar o continuar sin editor 3D.');E('d3Skip').hidden=false}},40000);
 loadScript(SF_SRC).then(()=>{const client=new Sketchfab(E('d3Frame'));client.init(MODEL,{autostart:1,preload:1,transparent:1,camera:0,dnt:1,ui_infos:0,ui_controls:0,ui_stop:0,ui_hint:0,ui_help:0,ui_settings:0,ui_inspector:0,ui_vr:0,ui_ar:0,ui_fullscreen:0,ui_annotations:0,ui_animations:0,ui_watermark:0,ui_watermark_link:0,
  success(a){api=a;api.start();api.addEventListener('modelLoadProgress',e=>setLoader(null,.15+.7*(e.progress||0)));api.addEventListener('viewerready',()=>setup().catch(fail))},error:fail})}).catch(fail)}
async function setup(){setLoader('Aplicando tejido y colores…',.88);
 const [mats,texs,nodes]=await Promise.all([call('getMaterialList'),call('getTextureList'),call('getNodeMap')]);
 const base=mats.find(m=>m.name==='fabric_Mat')||mats[0];sf.mainUid=base.channels.DiffusePBR.texture.uid;
 const best=(uid,max)=>{const t=texs.find(x=>x.uid===uid);return t&&t.images.filter(i=>i.width<=max).sort((a,b)=>b.width-a.width||/\.jpe?g$/.test(b.url)-/\.jpe?g$/.test(a.url))[0].url};
 try{sf.fabric=await loadImg(best(sf.mainUid,2048),true);mk(4).getContext('2d').drawImage(sf.fabric,0,0)}catch(e){sf.fabric=null}
 const nm=base.channels.NormalMap;sf.normalUid=nm&&nm.texture&&nm.texture.uid;sf.normalUrl=sf.normalUid&&best(sf.normalUid,NRM_RES);
 const list=Object.values(nodes),geo=k=>list.filter(n=>n.type==='Geometry'&&(n.name||'').includes(k));
 sf.rootId=(list.find(n=>n.name==='RootNode')||{instanceID:2}).instanceID;sf.btnNodes=[...geo('_buttons_'),...geo('_button_stitches_')].map(n=>n.instanceID);
 // Cuello y puños llevan su propio material para poder usar un color de contraste.
 sf.trimUid=await call('addTexture',fabricData(st.trim));const ch=clone(base.channels);
 for(const k of ['DiffusePBR','DiffuseColor'])if(ch[k]&&ch[k].texture)ch[k].texture={...ch[k].texture,uid:sf.trimUid};
 const trimMat=await call('createMaterial',{name:'cuello_punos',channels:ch});for(const n of [...geo('_collar_'),...geo('_sleeve_bottoms_')])await call('assignMaterial',n,trimMat.id);
 setLoader('Colocando botones…',.94);await applyButtons();
 await call('setFov',FOV);await uploadMain();await frame(sf.view,0);
 clearTimeout(loadT);sf.ready=true;setLoader(null,1);await sleep(600);E('d3Loader').classList.remove('on');E('d3Skip').hidden=true;flush();updateFoot();if(step===3&&isVisible())runPreview()}

/* ---------- Texturas: tejido teñido, botones y estampado sobre el mapa UV ---------- */
const canvasOf=S=>cv[S]||(cv[S]=mk(S));
// Se suaviza el contraste del tejido base (evita motas en colores vivos); el relieve lo aporta el mapa de normales.
function paintFabric(g,S,color){g.globalCompositeOperation='source-over';if(sf.fabric){g.drawImage(sf.fabric,0,0,S,S);g.fillStyle='rgba(207,204,204,.55)';g.fillRect(0,0,S,S)}else{g.fillStyle='#d1d0cd';g.fillRect(0,0,S,S)}g.globalCompositeOperation='multiply';g.fillStyle=color;g.fillRect(0,0,S,S);g.globalCompositeOperation='source-over'}
function fabricData(color){const c=canvasOf(TEX_LIVE);paintFabric(c.getContext('2d'),TEX_LIVE,color);return c.toDataURL('image/jpeg',.95)}
const HOLES=[[-.22,-.22],[.22,-.22],[-.22,.22],[.22,.22]];
function drawButtons(g,S){for(const u of BTN.at){g.save();g.translate(u*S,BTN.v*S);g.scale(BTN.ru*S,BTN.rv*S);
 let r=g.createRadialGradient(0,0,.85,0,0,1.45);r.addColorStop(0,'rgba(0,0,0,.3)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.beginPath();g.arc(0,0,1.45,0,7);g.fill();
 g.fillStyle=st.buttons;g.beginPath();g.arc(0,0,1,0,7);g.fill();
 r=g.createRadialGradient(0,0,.6,0,0,1);r.addColorStop(0,'rgba(0,0,0,0)');r.addColorStop(1,'rgba(0,0,0,.16)');g.fillStyle=r;g.beginPath();g.arc(0,0,1,0,7);g.fill();
 g.strokeStyle='rgba(0,0,0,.14)';g.lineWidth=.07;g.beginPath();g.arc(0,0,.72,0,7);g.stroke();
 g.fillStyle='rgba(0,0,0,.55)';for(const [x,y] of HOLES){g.beginPath();g.arc(x,y,.1,0,7);g.fill()}
 g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.09;g.lineCap='round';g.beginPath();g.moveTo(-.22,-.22);g.lineTo(.22,.22);g.moveTo(.22,-.22);g.lineTo(-.22,.22);g.stroke();g.restore()}}
// Relieve del botón en el mapa de normales (borde redondeado, centro cóncavo y 4 agujeros).
function buttonHeight(x,y){const r=Math.hypot(x,y);let z;if(r>=1)z=0;else if(r>.82){const t=(r-.82)/.18;z=.75*Math.sqrt(Math.max(0,1-t*t))}else if(r>.7)z=.62+.13*(r-.7)/.12;else z=.55+.07*(r/.7)**2;for(const [hx,hy] of HOLES)if(Math.hypot(x-hx,y-hy)<.1)z-=.25;return z}
function drawButtonNormals(g,S){const sx=BTN.ru*S,sy=BTN.rv*S,rx=Math.ceil(sx*1.1),ry=Math.ceil(sy*1.1),w=2*rx+1,h=2*ry+1,e=1/sx,H=buttonHeight;
 for(const u of BTN.at){const cx=Math.round(u*S),cy=Math.round(BTN.v*S),img=g.getImageData(cx-rx,cy-ry,w,h),d=img.data;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=(i-rx)/sx,y=(j-ry)/sy;if(Math.hypot(x,y)>1.02)continue;const nx=-(H(x+e,y)-H(x-e,y))/(2*e)*.9,ny=-(H(x,y+e)-H(x,y-e))/(2*e)*.9,L=Math.hypot(nx,ny,1),o=4*(j*w+i);d[o]=(nx/L*.5+.5)*255;d[o+1]=(ny/L*.5+.5)*255;d[o+2]=(1/L*.5+.5)*255}
  g.putImageData(img,cx-rx,cy-ry)}}
async function applyButtons(){for(const id of sf.btnNodes)await call('hide',id);if(!sf.normalUid)return;
 try{const img=await loadImg(sf.normalUrl,true),N=img.naturalWidth,c=mk(N),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);drawButtonNormals(g,N);const data=c.toDataURL('image/jpeg',.95);c.width=c.height=0;await call('updateTexture',data,sf.normalUid)}catch(e){console.warn('Relieve de botones no disponible',e)}}
function drawPrint(g,S){if(!opts.allowStamp)return;const p=POS[st.pos],cx=(p.u+st.offX*CM)*S,cy=(p.v-st.offY*CM)*S;let bottom=cy;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
 if(st.img){const w=p.logo*st.logoScale*CM*S,r=st.img.naturalWidth?st.img.naturalHeight/st.img.naturalWidth:1,h=w*r;g.drawImage(st.img,cx-w/2,cy-h/2,w,h);bottom=cy+h/2}
 if(st.text){const fs=p.text*st.textScale*CM*S/.72;g.font=`${st.weight} ${fs}px "${st.font}",Arial,sans-serif`;g.fillStyle=st.textColor;g.textAlign='center';g.textBaseline='middle';g.fillText(st.text,cx,st.img?bottom+fs*.78:cy,p.tw*CM*S)}}
async function uploadMain(S=TEX_LIVE){const c=canvasOf(S),g=c.getContext('2d');paintFabric(g,S,st.color);drawButtons(g,S);drawPrint(g,S);const data=c.toDataURL('image/jpeg',S>TEX_LIVE?.96:.94);if(S>TEX_LIVE){c.width=c.height=0;delete cv[S]}await call('updateTexture',data,sf.mainUid)}
const dirty=new Set(),ORDER_DIRTY=['trim','main'];let qT=0,flushP=null;
function queue(...k){k.forEach(x=>dirty.add(x));clearTimeout(qT);qT=setTimeout(flush,70)}
async function applyDirty(){while(dirty.size&&!exporting){const ks=ORDER_DIRTY.filter(k=>dirty.has(k));dirty.clear();for(const k of ks){if(k==='main')await uploadMain();else if(k==='trim')await call('updateTexture',fabricData(st.trim),sf.trimUid)}}}
function flush(){if(exporting||!sf.ready)return Promise.resolve();if(flushP)return flushP.then(()=>dirty.size?flush():0);flushP=applyDirty().catch(console.error).finally(()=>{flushP=null});return flushP}
// Aplica los cambios pendientes antes de capturar, para que la vista salga con el diseño actual.
async function settle(){clearTimeout(qT);await flush()}

/* ---------- Cámara, vistas y giro ---------- */
const isVisible=()=>{const v=E('d3Viewer');return !!(v&&v.offsetParent!==null&&v.clientWidth>0)};
function viewAng(k){const a=VIEWS[k].ang;return(k==='q'||k==='l')&&st.side==='der'?-a:a}
function camDist(aspect){return Math.max(2.4,.3/(Math.tan(FOV*Math.PI/360)*aspect))}
// El callback de rotate llega al terminar la animación; si la pestaña está en segundo plano puede no llegar nunca.
function rotateTo(deg,dur){sf.angle=deg;return Promise.race([call('rotate',sf.rootId,[deg*Math.PI/180,0,1,0],{duration:dur||1e-4,easing:'easeInOutQuad'}),sleep((dur||0)*1000+250)])}
// Encuadra el polo en el hueco libre sobre la barra de vistas.
function frame(k,dur=.9){sf.view=k;const v=E('d3Viewer'),W=v.clientWidth,H=Math.max(1,v.clientHeight),bar=v.querySelector('.d3-views'),low=Math.min(H*.45,Math.max(0,H-bar.offsetTop+6)),free=(H-low)/H,
 tan=Math.tan(FOV*Math.PI/360),vis=Math.max(.69/.86/free,.58*H/Math.max(1,W)),d=vis/(2*tan),zt=ZC-vis*low/H/2,t=viewAng(k),a=t+360*Math.round((sf.angle-t)/360);
 return Promise.all([rotateTo(a,dur),call('setCameraLookAt',[0,-d,zt+.05],[0,0,zt],dur)])}
function markView(k){QA('#d3 [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===k))}
function setView(k){stopSpin();markView(k);if(sf.ready&&!exporting&&isVisible())frame(k).catch(console.error);else sf.view=k}
function stopSpin(){clearTimeout(spinT);spinT=0;const a=E('d3Auto');if(a)a.checked=false}
function startSpin(){clearTimeout(spinT);markView(null);const tick=()=>{sf.angle+=90;api.rotate(sf.rootId,[sf.angle*Math.PI/180,0,1,0],{duration:4,easing:'easeLinear'});spinT=setTimeout(tick,4000)};tick()}

/* ---------- Vista previa y vistas 2D ---------- */
const busyTxt=t=>{E('d3BusyTxt').textContent=t};
// Espera fotogramas reales: si la pestaña queda en segundo plano el render se pausa y la captura saldría a medias.
function waitFrames(n){return new Promise(r=>{const f=()=>--n<=0?r():requestAnimationFrame(f);requestAnimationFrame(f)})}
const settleView=(ms=1100,n=50)=>Promise.all([sleep(ms),waitFrames(n)]);
function fresh(k){const s=shots[k];return !!s&&s.ver===ver&&s.res===st.res&&(k==='f'||k==='b'||s.side===st.side)}
const previewFresh=()=>!!small&&small.ver===ver&&ORDER.every(fresh);
function paintBg(g,x,y,w,h,bg){if(bg==='white'){g.fillStyle='#fff';g.fillRect(x,y,w,h)}else if(bg==='studio'){const r=g.createRadialGradient(x+w/2,y+h*.42,0,x+w/2,y+h*.42,Math.max(w,h)*.75);r.addColorStop(0,'#fbfbf9');r.addColorStop(1,'#dfe2dc');g.fillStyle=r;g.fillRect(x,y,w,h);g.save();g.translate(x+w/2,y+h*.925);g.scale(1,.07);const s=g.createRadialGradient(0,0,0,0,0,w*.3);s.addColorStop(0,'rgba(40,46,42,.26)');s.addColorStop(1,'rgba(40,46,42,0)');g.fillStyle=s;g.beginPath();g.arc(0,0,w*.3,0,Math.PI*2);g.fill();g.restore()}}
async function composeShot(k,bg=st.bg){const s=shots[k],[W,H]=RES[s.res],c=mk(W,H),g=c.getContext('2d');paintBg(g,0,0,W,H,bg);g.drawImage(await loadImg(s.raw),0,0,W,H);return c}
async function blobOf(k){const key=`${k}|${shots[k].raw.length}|${st.bg}`;if(!blobs.has(key)){const c=await composeShot(k);blobs.set(key,await toBlob(c));c.width=c.height=0}return blobs.get(key)}
async function sheetBlob(){const key=`sheet|${ORDER.map(k=>shots[k].raw.length).join()}|${st.bg}`;if(!blobs.has(key)){const c=await sheetCanvas();blobs.set(key,await toBlob(c));c.width=c.height=0}return blobs.get(key)}
async function prewarm(){if(!canShare)return;for(const k of ORDER)if(fresh(k))await blobOf(k).catch(()=>{});if(ORDER.every(fresh))await sheetBlob().catch(()=>{})}
// Miniaturas que se guardan con la solicitud (frente y espalda sobre fondo blanco).
async function makeSmall(){const out={ver};for(const k of ['f','b']){const img=await loadImg(shots[k].raw),c=mk(480,600),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,480,600);g.drawImage(img,0,0,480,600);out[k]=c.toDataURL('image/jpeg',.85)}small=out}
async function captureViews(keys){
 if(!sf.ready||exporting||!keys.length)return false;stopSpin();E('d3Busy').classList.add('on');E('d3').classList.add('busy');busyTxt('Aplicando el diseño…');await settle();exporting=true;
 const [W,H]=RES[st.res],ang0=sf.angle;let cam0=null,ok=true;
 try{busyTxt('Preparando estampado en alta resolución…');cam0=await call('getCameraLookAt');api.setUserInteraction(false);await uploadMain(TEX_HQ);dirty.delete('main');await settleView(600,20);
  const d=camDist(W/H);
  for(const [i,k] of keys.entries()){busyTxt(`Generando vista ${VIEWS[k].label.toLowerCase()} · ${i+1} de ${keys.length}`);await rotateTo(viewAng(k),0);await call('setCameraLookAt',[0,-d,ZC+.015],[0,0,ZC],0);await settleView();
   shots[k]={raw:await call('getScreenShot',W,H,'image/png'),ver,side:st.side,res:st.res};await renderThumb(k)}
 }catch(e){console.error(e);ok=false}
 finally{try{await rotateTo(ang0,0);if(cam0)await call('setCameraLookAt',cam0.position,cam0.target,0)}catch(e){}
  try{api.setUserInteraction(true)}catch(e){}exporting=false;E('d3Busy').classList.remove('on');E('d3').classList.remove('busy');queue('main');setTimeout(prewarm,300)}
 return ok&&keys.every(fresh)}
async function renderThumb(k){const card=document.querySelector(`#d3Thumbs [data-k="${k}"]`),s=shots[k];if(!card)return;card.classList.toggle('checker',st.bg==='transparent');card.classList.toggle('is-stale',!!s&&!fresh(k));
 if(!s){card.querySelector('.pic').textContent='Sin generar';return}const big=await composeShot(k),t=mk(320,400);t.getContext('2d').drawImage(big,0,0,320,400);big.width=big.height=0;card.querySelector('.pic').innerHTML=`<img alt="Vista ${VIEWS[k].label} de tu polo" src="${t.toDataURL('image/png')}">`}
function refreshThumbs(){ORDER.forEach(k=>{const c=document.querySelector(`#d3Thumbs [data-k="${k}"]`);if(!c)return;c.classList.toggle('checker',st.bg==='transparent');c.classList.toggle('is-stale',!!shots[k]&&!fresh(k))})}
async function ensure(keys){const need=keys.filter(k=>!fresh(k));if(need.length)await captureViews(need);return keys.every(fresh)}
async function sheetCanvas(){const cw=900,ch=1125,pad=48,cap=86,n=ORDER.length,c=mk(n*cw+(n+1)*pad,ch+cap+pad*2),g=c.getContext('2d');g.fillStyle=st.bg==='studio'?'#e9ebe6':'#fff';g.fillRect(0,0,c.width,c.height);
 for(const [i,k] of ORDER.entries()){const x=pad+i*(cw+pad);if(st.bg==='studio')paintBg(g,x,pad,cw,ch,'studio');g.drawImage(await loadImg(shots[k].raw),x,pad,cw,ch);g.fillStyle='#4d5652';g.font='700 30px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(VIEWS[k].label.toUpperCase(),x+cw/2,pad+ch+cap/2+6)}return c}
function prevStatus(html,cls=''){const el=E('d3PrevStatus');el.className='d3-status'+(cls?' '+cls:'');el.innerHTML=html;el.hidden=!html}
async function runPreview(){if(step!==3)return;renderRecap();
 if(failed){prevStatus('El editor 3D no está disponible. Puedes continuar sin él y nuestro equipo preparará la propuesta.','err');return}
 if(!sf.ready){prevStatus('<span class="d3-spin" style="width:18px;height:18px;border-width:2px"></span> El modelo 3D aún está cargando; la vista previa se generará en cuanto esté listo.');return}
 if(previewFresh()){prevStatus('✓ Vista previa lista. Si cambias algo, se volverá a generar.','ok');updateFoot();return}
 prevStatus('<span class="d3-spin" style="width:18px;height:18px;border-width:2px"></span> Generando la vista previa de tu polo…');updateFoot();
 const ok=await ensure(ORDER);if(step!==3)return;
 if(!ok){prevStatus('No se pudo generar la vista previa. <button class="btn btn-light btn-sm" type="button" id="d3Retry">Reintentar</button>','err');E('d3Retry').onclick=runPreview;updateFoot();return}
 try{await makeSmall()}catch(e){console.error(e)}
 prevStatus(small&&small.ver===ver?'✓ Vista previa lista. Si cambias algo, se volverá a generar.':'No se pudo preparar la miniatura del diseño.',small&&small.ver===ver?'ok':'err');updateFoot()}
function stampSummary(){if(!opts.allowStamp)return 'Sin personalización';const p=POS[st.pos],parts=[];if(st.img)parts.push(`Logo PNG (≈ ${(p.logo*st.logoScale).toFixed(1)} cm)`);if(st.text)parts.push(`Texto «${st.text}» (${st.font}, ${st.textColor})`);return parts.join(' + ')||'Sin estampado'}
function colorName(c){const n=COLORS.find(x=>x[0]===c);return n?n[1]+' ('+c+')':c}
function renderRecap(){const rows=[['Tejido',colorName(st.color)],['Cuello y puños',colorName(st.trim)],['Botones','2 · '+colorName(st.buttons)],['Estampado',stampSummary()],['Ubicación',POS[st.pos].label]];E('d3Recap').innerHTML=rows.map(r=>`<div><span>${r[0]}</span><b>${r[1].replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}</b></div>`).join('')}

/* ---------- Pasos del editor ---------- */
function show(i){step=Math.max(0,Math.min(3,i|0));QA('#d3Body .d3-step').forEach(s=>s.classList.toggle('on',+s.dataset.step===step));
 QA('#d3Stepper .d3-tab').forEach((t,j)=>{t.classList.toggle('on',j===step);t.classList.toggle('done',j<step);if(j===step)t.setAttribute('aria-current','step');else t.removeAttribute('aria-current')});
 revealTab();E('d3Body').scrollTop=0;updateFoot();
 setView(['f',POS[st.pos].view,POS[st.pos].view,'f'][step]);
 if(step===3)runPreview()}
function revealTab(){const bar=E('d3Stepper'),tab=QA('#d3Stepper .d3-tab')[step];if(!tab)return;const pad=16,b=bar.getBoundingClientRect(),t=tab.getBoundingClientRect();let left=bar.scrollLeft;
 if(step===0)left=0;else if(step===STEPS.length-1)left=bar.scrollWidth;else if(t.left<b.left+pad)left+=t.left-b.left-pad;else if(t.right>b.right-pad)left+=t.right-b.right+pad;if(left!==bar.scrollLeft)bar.scrollTo({left,behavior:'smooth'})}
function updateFoot(){const n=E('d3Next'),p=E('d3Prev');if(!n)return;p.textContent=step===0?opts.backLabel:'← Atrás';
 if(step<3){n.textContent=`Siguiente: ${STEPS[step+1]} →`;n.disabled=false}else{n.textContent=opts.doneLabel;n.disabled=!previewFresh()||exporting}
 if(failed){n.textContent='Continuar sin editor 3D →';n.disabled=false}}
function next(){if(failed){hooks.skip();return}if(step<3){hooks.nav(step+1);return}if(!previewFresh()){runPreview();return}hooks.done(exportDesign())}
function prev(){if(step===0)hooks.back();else hooks.nav(step-1)}
function exportDesign(){const p=POS[st.pos];return{version:ver,botones:2,colores:{tejido:st.color,cuello:st.trim,botones:st.buttons},posKey:st.pos,ubicacion:p.label,desplazamientoCm:{horizontal:st.offX,vertical:st.offY},
 estampado:{logo:!!st.img,logoNombre:st.img?st.logoName:null,logoAnchoCm:st.img?+(p.logo*st.logoScale).toFixed(1):null,logoEscala:st.logoScale,texto:st.text||null,tipografia:st.font,colorTexto:st.textColor,altoLetraCm:st.text?+(p.text*st.textScale).toFixed(1):null,textoEscala:st.textScale},
 resumenEstampado:stampSummary(),previews:{f:small.f,b:small.b},logoFile:st.img?st.logoFile:null}}

/* ---------- Diseño ---------- */
function touch(...k){ver++;queue(...k);refreshThumbs();labels();if(step===3){renderRecap();prevStatus(previewFresh()?'':'El diseño cambió: vuelve a generar la vista previa.');updateFoot()}if(!silent)hooks.change()}
function labels(){const p=POS[st.pos];E('d3LogoCm').textContent=`≈ ${(p.logo*st.logoScale).toFixed(1)} cm de ancho`;E('d3TextCm').textContent=`≈ ${(p.text*st.textScale).toFixed(1)} cm`;E('d3OffXv').textContent=`${st.offX>0?'+':''}${st.offX} cm`;E('d3OffYv').textContent=`${st.offY>0?'+':''}${st.offY} cm`;E('d3PosName').textContent=p.label}
function paintMini(){QA('#d3 .d3-mini .body').forEach(p=>p.style.fill=st.color);QA('#d3 .d3-mini .collar').forEach(p=>p.style.fill=st.trim)}
function setColor(c){st.color=c;E('d3Color').value=c;const n=COLORS.find(x=>x[0]===c);E('d3Cname').textContent=n?n[1]:c.toUpperCase();QA('#d3Sw button').forEach(x=>x.classList.toggle('on',x.dataset.c===c));const k=['main'];if(st.trimLinked){st.trim=c;E('d3Trim').value=c;k.push('trim')}if(st.btnLinked){st.buttons=c;E('d3Buttons').value=c}paintMini();touch(...k)}
function renderPos(){QA('#d3 [data-pos]').forEach(b=>b.classList.toggle('on',b.dataset.pos===st.pos))}
function setPos(k){st.pos=k;const p=POS[k];if(p.side)setSide(p.side);renderPos();touch('main');setView(p.view)}
function setSide(s){st.side=s;QA('#d3Side [data-side]').forEach(b=>b.classList.toggle('on',b.dataset.side===s));refreshThumbs()}
function logoError(msg){const el=E('d3LogoErr');el.textContent=msg;el.hidden=false;E('d3Logo').value='';note(msg)}
// Solo PNG: se comprueban extensión, tipo declarado y la firma real del archivo (no basta con renombrarlo).
async function loadLogo(file){E('d3LogoErr').hidden=true;if(!file)return;
 const name=file.name||'archivo',okExt=/\.png$/i.test(name),okType=file.type==='image/png';
 if(!okExt||!okType)return logoError(`Solo se aceptan archivos PNG. «${name}» no es un PNG.`);
 if(file.size>LOGO_MAX)return logoError('El PNG supera el tamaño máximo de 8 MB.');
 let head;try{head=new Uint8Array(await file.slice(0,8).arrayBuffer())}catch(e){return logoError('No se pudo leer el archivo.')}
 if(!PNG_SIG.every((b,i)=>head[i]===b))return logoError(`«${name}» no es un PNG válido: su contenido no corresponde a una imagen PNG.`);
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>{if(img.naturalWidth<16||img.naturalHeight<16||img.naturalWidth>8000||img.naturalHeight>8000){URL.revokeObjectURL(url);return logoError('El PNG debe medir entre 16 y 8000 píxeles por lado.')}
  if(st.img)URL.revokeObjectURL(st.img.src);st.img=img;st.logoName=name;st.logoFile=file;E('d3LogoPrev').src=url;E('d3LogoName').textContent=name;E('d3LogoRow').hidden=false;E('d3Drop').hidden=true;touch('main');note('Logo aplicado')};
 img.onerror=()=>{URL.revokeObjectURL(url);logoError('No se pudo leer la imagen PNG (archivo dañado).')};img.src=url}
function removeLogo(){if(st.img)URL.revokeObjectURL(st.img.src);st.img=null;st.logoName='';st.logoFile=null;E('d3Logo').value='';E('d3LogoRow').hidden=true;E('d3Drop').hidden=false;E('d3LogoErr').hidden=true;touch('main')}
function applyOpts(){QA('#d3Body [data-step="1"] .d3-card').forEach(c=>c.classList.toggle('off',!opts.allowStamp));const n=E('d3StampNote');if(n){n.hidden=opts.allowStamp;n.textContent=opts.stampNote||''}}
function syncInputs(){applyOpts();E('d3Color').value=st.color;E('d3Trim').value=st.trim;E('d3Buttons').value=st.buttons;const n=COLORS.find(x=>x[0]===st.color);E('d3Cname').textContent=n?n[1]:st.color.toUpperCase();QA('#d3Sw button').forEach(x=>x.classList.toggle('on',x.dataset.c===st.color));
 E('d3Text').value=st.text;E('d3TextColor').value=st.textColor;E('d3Font').value=`${st.font}|${st.weight}`;E('d3TextScale').value=st.textScale;E('d3LogoScale').value=st.logoScale;E('d3OffX').value=st.offX;E('d3OffY').value=st.offY;E('d3Bg').value=st.bg;E('d3Res').value=st.res;
 E('d3LogoRow').hidden=!st.img;E('d3Drop').hidden=!!st.img;E('d3LogoErr').hidden=true;if(st.img){E('d3LogoPrev').src=st.img.src;E('d3LogoName').textContent=st.logoName}
 setSide(st.side);renderPos();paintMini();labels()}

/* ---------- Montaje de la interfaz ---------- */
function build(){
 E('d3Stepper').innerHTML=STEPS.map((t,i)=>`<button class="d3-tab" type="button" data-go="${i}"><span class="n">${i+1}</span>${t}</button>`).join('');
 E('d3Stepper').onclick=e=>{const b=e.target.closest('[data-go]');if(b&&!exporting)hooks.nav(+b.dataset.go)};
 E('d3Sw').innerHTML=COLORS.map(([c,n])=>`<button type="button" data-c="${c}" style="background:${c}" title="${n}" aria-label="${n}"></button>`).join('');
 E('d3Sw').onclick=e=>{const b=e.target.closest('[data-c]');if(b)setColor(b.dataset.c)};
 E('d3Color').oninput=e=>setColor(e.target.value);
 E('d3Trim').oninput=e=>{st.trim=e.target.value;st.trimLinked=st.trim===st.color;paintMini();touch('trim')};
 E('d3Buttons').oninput=e=>{st.buttons=e.target.value;st.btnLinked=st.buttons===st.color;touch('main')};
 E('d3Sync').onclick=()=>{st.trimLinked=st.btnLinked=true;setColor(st.color)};
 const bind={d3Text:'text',d3TextColor:'textColor',d3TextScale:'textScale',d3LogoScale:'logoScale',d3OffX:'offX',d3OffY:'offY'},num=['textScale','logoScale','offX','offY'];
 for(const [id,key] of Object.entries(bind))E(id).addEventListener('input',e=>{st[key]=num.includes(key)?+e.target.value:e.target.value;touch('main')});
 E('d3Font').onchange=e=>{[st.font,st.weight]=e.target.value.split('|');st.weight=+st.weight;document.fonts.load(`${st.weight} 40px "${st.font}"`).catch(()=>{}).then(()=>touch('main'))};
 E('d3Chips').innerHTML=Object.entries(POS).map(([k,p])=>`<button type="button" data-pos="${k}">${p.label}</button>`).join('');
 for(const [k,[fig,x,y]] of Object.entries(SPOT))document.querySelector(`#d3 .d3-mini[data-fig="${fig}"]`).insertAdjacentHTML('beforeend',`<button class="d3-spot" type="button" data-pos="${k}" style="left:calc(8px + (100% - 16px)*${x/100});top:calc(8px + (100% - 34px)*${y/100})" title="${POS[k].label}" aria-label="${POS[k].label}"></button>`);
 E('d3Body').addEventListener('click',e=>{const b=e.target.closest('[data-pos]');if(b)setPos(b.dataset.pos)});
 E('d3Center').onclick=()=>{st.offX=st.offY=0;E('d3OffX').value=E('d3OffY').value=0;touch('main')};
 E('d3Logo').onchange=e=>loadLogo(e.target.files[0]);
 const drop=E('d3Drop');['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));['dragleave','drop'].forEach(t=>drop.addEventListener(t,()=>drop.classList.remove('over')));drop.addEventListener('drop',e=>{e.preventDefault();loadLogo(e.dataTransfer.files[0])});
 E('d3RmLogo').onclick=removeLogo;
 QA('#d3 [data-v]').forEach(b=>b.onclick=()=>setView(b.dataset.v));
 E('d3Auto').onchange=e=>{if(!sf.ready){e.target.checked=false;return}e.target.checked?startSpin():stopSpin()};
 E('d3Thumbs').innerHTML=ORDER.map(k=>`<div class="d3-thumb" data-k="${k}"><span class="stale">Desactualizada</span><div class="pic">Sin generar</div><footer><span>${VIEWS[k].label}</span><button type="button" data-dl="${k}" aria-label="Descargar ${VIEWS[k].label}">PNG ↓</button>${canShare?`<button type="button" data-sh="${k}" aria-label="Compartir ${VIEWS[k].label}">Compartir</button>`:''}</footer></div>`).join('');
 E('d3Thumbs').onclick=async e=>{const b=e.target.closest('button');if(!b||exporting)return;const k=b.dataset.dl||b.dataset.sh,name=`polo-${VIEWS[k].file}.png`;if(!await ensure([k]))return;const blob=await blobOf(k);b.dataset.sh?shareBlob(blob,name,`Polo · ${VIEWS[k].label}`):saveBlob(blob,name)};
 E('d3ShareSheet').hidden=!canShare;
 E('d3DlSheet').onclick=()=>downloadSheet().catch(()=>note('No se pudo preparar la lámina.'));
 E('d3ShareSheet').onclick=async()=>{if(await ensure(ORDER))shareBlob(await sheetBlob(),'polo-lamina-vistas.png','Polo · Vistas 2D')};
 E('d3DlZip').onclick=async()=>{if(!await ensure(ORDER))return;try{await loadScript2('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')}catch(e){note('No se pudo cargar el compresor ZIP. Descarga las vistas por separado.');return}
  const z=new JSZip();for(const k of ORDER)z.file(`polo-${VIEWS[k].file}.png`,await blobOf(k));z.file('polo-lamina-vistas.png',await sheetBlob());saveBlob(await z.generateAsync({type:'blob'}),'polo-vistas-2d.zip')};
 E('d3Export').onclick=exportCurrent;
 E('d3Bg').onchange=e=>{st.bg=e.target.value;ORDER.forEach(k=>shots[k]?renderThumb(k):0);refreshThumbs();setTimeout(prewarm,300)};
 E('d3Res').onchange=e=>{st.res=e.target.value;refreshThumbs();if(step===3)runPreview()};
 QA('#d3Side [data-side]').forEach(b=>b.onclick=()=>{setSide(b.dataset.side);if('ql'.includes(sf.view))setView(sf.view);if(step===3)runPreview()});
 E('d3Prev').onclick=prev;E('d3Next').onclick=next;E('d3Skip').onclick=()=>hooks.skip();
 let rzT=0;new ResizeObserver(()=>{clearTimeout(rzT);rzT=setTimeout(()=>{if(sf.ready&&!exporting&&!spinT&&isVisible())frame(sf.view,.4).catch(()=>{})},250)}).observe(E('d3Viewer'));
 document.fonts.ready.then(()=>{if(sf.ready)queue('main')});
 syncInputs();prevStatus('')}
function fieldsFrom(t){return{color:t.colores.tejido||DEF.color,trim:t.colores.cuello||DEF.trim,buttons:t.colores.botones||DEF.buttons,pos:POS[t.posKey]?t.posKey:DEF.pos,offX:t.desplazamientoCm?.horizontal||0,offY:t.desplazamientoCm?.vertical||0,text:t.estampado?.texto||'',textColor:t.estampado?.colorTexto||DEF.textColor,font:t.estampado?.tipografia||DEF.font,weight:t.estampado?.tipografia==='Impact'?400:700,logoScale:t.estampado?.logoEscala||1,textScale:t.estampado?.textoEscala||1,side:POS[t.posKey]?.side||DEF.side}}
async function applyDesign(t,logoBlob){if(!t||!t.colores)return;st={...DEF,img:null,logoName:'',logoFile:null,...fieldsFrom(t)};st.trimLinked=st.trim===st.color;st.btnLinked=st.buttons===st.color;
 if(logoBlob){try{const url=URL.createObjectURL(logoBlob),img=await loadImg(url);st.img=img;st.logoFile=logoBlob;st.logoName=t.estampado?.logoNombre||'logo.png'}catch(e){console.warn('No se pudo cargar el logo guardado',e)}}}
// Cada contexto (pedido nuevo, modificación de COT-…) conserva su propio diseño y sus vistas.
async function useContext(key,design,logoBlob){if(key===ctxKey&&!design)return;stopSpin();contexts.set(ctxKey,{st,shots,small,ver,step});ctxKey=key;const saved=design?null:contexts.get(key);
 if(saved)({st,shots,small,ver,step}=saved);else{st={...DEF,img:null,logoName:'',logoFile:null};shots={};small=null;ver+=1000;step=0;if(design)await applyDesign(design,logoBlob)}
 blobs.clear();if(mounted){syncInputs();ORDER.forEach(k=>renderThumb(k));prevStatus('');if(sf.ready){queue('trim','main')}}}
function loadScript2(src){return new Promise((res,rej)=>{if(window.JSZip)return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function exportCurrent(){if(!sf.ready||exporting)return;stopSpin();E('d3Busy').classList.add('on');busyTxt('Renderizando la vista actual…');await settle();exporting=true;
 try{await uploadMain(TEX_HQ);dirty.delete('main');await settleView(600,20);const v=E('d3Viewer'),H=RES[st.res][1],W=Math.min(4096,Math.round(H*v.clientWidth/Math.max(1,v.clientHeight))),c=mk(W,H),g=c.getContext('2d');paintBg(g,0,0,W,H,st.bg);g.drawImage(await loadImg(await call('getScreenShot',W,H,'image/png')),0,0,W,H);saveBlob(await toBlob(c),'polo-vista-3d.png')}
 catch(e){console.error(e);note('No se pudo exportar la vista.')}finally{exporting=false;E('d3Busy').classList.remove('on');queue('main')}}
async function viewJPEG(k,maxW=1200){const img=await loadImg(shots[k].raw),w=Math.min(maxW,img.naturalWidth),h=Math.round(w*img.naturalHeight/img.naturalWidth),c=mk(w,h),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);const d=c.toDataURL('image/jpeg',.88);c.width=c.height=0;return{data:d,w,h}}
async function downloadSheet(){if(!ORDER.every(fresh)&&!(await ensure(ORDER)))throw Error('sin vistas');saveBlob(await sheetBlob(),'polo-lamina-vistas.png')}

/* ---------- API pública para la página ---------- */
return{
 hooks,
 mount(){if(!mounted){mounted=true;build();startViewer()}else if(sf.ready)setTimeout(()=>{if(isVisible()&&!exporting)frame(sf.view,.3).catch(()=>{})},80)},
 show,
 pause(){stopSpin()},
 // Nueva solicitud: vuelve al diseño inicial y descarta logo, texto, vistas y miniaturas del pedido anterior.
 reset(){if(st.img)URL.revokeObjectURL(st.img.src);st={...DEF,img:null,logoName:'',logoFile:null};for(const k of ORDER)delete shots[k];blobs.clear();small=null;ver++;step=0;
  if(mounted){syncInputs();ORDER.forEach(k=>renderThumb(k));prevStatus('');stopSpin();if(sf.ready){queue('trim','main');sf.view='f';markView('f');if(isVisible())frame('f',0).catch(()=>{})}}},
 // Restaura colores, ubicación y texto de un borrador (el logo no se guarda en el navegador y hay que volver a subirlo).
 load(t){if(!t||!t.colores)return;silent=true;try{st={...st,color:t.colores.tejido||DEF.color,trim:t.colores.cuello||DEF.trim,buttons:t.colores.botones||DEF.buttons,pos:POS[t.posKey]?t.posKey:DEF.pos,offX:t.desplazamientoCm?.horizontal||0,offY:t.desplazamientoCm?.vertical||0,text:t.estampado?.texto||'',textColor:t.estampado?.colorTexto||DEF.textColor,font:t.estampado?.tipografia||DEF.font,logoScale:t.estampado?.logoEscala||1,textScale:t.estampado?.textoEscala||1};st.trimLinked=st.trim===st.color;st.btnLinked=st.buttons===st.color;if(mounted)syncInputs()}finally{silent=false}},
 hasShots:()=>ORDER.every(k=>!!shots[k]),
 setOptions(o){Object.assign(opts,o);if(mounted){applyOpts();updateFoot();renderRecap&&step===3&&renderRecap()}if(sf.ready)queue('main')},
 useContext,
 dropContext:k=>{contexts.delete(k)},
 currentContext:()=>ctxKey,
 viewsReady:()=>ORDER.every(fresh),
 viewJPEG,
 VIEWS,ORDER,
 downloadSheet
}})();
