const video=document.getElementById('source'),canvas=document.getElementById('skirt'),ctx=canvas.getContext('2d',{willReadFrequently:true}),viewer=document.getElementById('viewer'),status=document.getElementById('status');
let target=0,zoom=1,ready=false,seeking=false;const pointers=new Map();let pinch=0;
const frames=new Map();let requestedFrame=1;
function seek(){const index=1+Math.floor(target*60)%60;requestedFrame=index;let image=frames.get(index);if(!image){image=new Image();frames.set(index,image);image.onload=()=>{if(requestedFrame===index)draw(image);};image.onerror=()=>status.textContent='Не удалось загрузить юбку. Обновите страницу.';image.src='assets/turn/frame-'+String(index).padStart(3,'0')+'.jpg';}if(image.complete&&image.naturalWidth)draw(image);}
function draw(image){ctx.drawImage(image,0,0,540,960);const frame=ctx.getImageData(0,0,540,960),d=frame.data;for(let i=0;i<d.length;i+=4){if(Math.min(d[i],d[i+1],d[i+2])>210)d[i]=d[i+1]=d[i+2]=255;}ctx.putImageData(frame,0,0);status.textContent='';ready=true;}
function turn(delta){if(!ready)return;target=(target+delta+1*100)%1;seek();}
function scale(value){zoom=Math.max(.6,Math.min(2.5,value));canvas.style.setProperty('--zoom',zoom);}
canvas.width=540;canvas.height=960;seek();
viewer.addEventListener('pointerdown',e=>{viewer.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
viewer.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)turn((e.clientX-old.x)/Math.max(viewer.clientWidth,300)*1*1.5);else if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)scale(zoom*distance/pinch);pinch=distance;}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewer.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=0;});
viewer.addEventListener('wheel',e=>{e.preventDefault();scale(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
viewer.addEventListener('dblclick',()=>{target=0;scale(1);seek();});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','+','=','-','0'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')turn(-1/36);if(e.key==='ArrowRight')turn(1/36);if(e.key==='+'||e.key==='=')scale(zoom*1.1);if(e.key==='-')scale(zoom/1.1);if(e.key==='0'){target=0;scale(1);seek();}});
