const video=document.getElementById('source'),canvas=document.getElementById('skirt'),ctx=canvas.getContext('2d',{willReadFrequently:true}),viewer=document.getElementById('viewer'),status=document.getElementById('status');
let target=0,zoom=1,ready=false,seeking=false;const pointers=new Map();let pinch=0;
function render(){ctx.drawImage(video,0,0,canvas.width,canvas.height);const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data;for(let i=0;i<d.length;i+=4){if(Math.min(d[i],d[i+1],d[i+2])>210){d[i]=d[i+1]=d[i+2]=255;}}ctx.putImageData(frame,0,0);}
function seek(){if(!ready)return;const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,canvas.width,canvas.height);const frame=ctx.getImageData(0,0,canvas.width,canvas.height),d=frame.data;for(let i=0;i<d.length;i+=4){if(Math.min(d[i],d[i+1],d[i+2])>210)d[i]=d[i+1]=d[i+2]=255;}ctx.putImageData(frame,0,0);};image.src='assets/turn/frame-'+String(Math.min(60,1+Math.floor(target/video.duration*60))).padStart(3,'0')+'.jpg';}
function turn(delta){if(!ready)return;target=(target+delta+video.duration*100)%video.duration;seek();}
function scale(value){zoom=Math.max(.6,Math.min(2.5,value));canvas.style.setProperty('--zoom',zoom);}
video.addEventListener('loadeddata',()=>{canvas.width=540;canvas.height=960;ready=true;render();});
video.addEventListener('seeked',()=>{seeking=false;render();if(Math.abs(video.currentTime-target)>.025)seek();});
video.addEventListener('error',()=>status.textContent='Не удалось загрузить юбку. Обновите страницу.');
viewer.addEventListener('pointerdown',e=>{viewer.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}});
viewer.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===1)turn((e.clientX-old.x)/Math.max(viewer.clientWidth,300)*video.duration*1.5);else if(pointers.size===2){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)scale(zoom*distance/pinch);pinch=distance;}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])viewer.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=0;});
viewer.addEventListener('wheel',e=>{e.preventDefault();scale(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
viewer.addEventListener('dblclick',()=>{target=0;scale(1);seek();});
canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','+','=','-','0'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')turn(-video.duration/36);if(e.key==='ArrowRight')turn(video.duration/36);if(e.key==='+'||e.key==='=')scale(zoom*1.1);if(e.key==='-')scale(zoom/1.1);if(e.key==='0'){target=0;scale(1);seek();}});
