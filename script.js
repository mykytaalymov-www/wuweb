import * as THREE from 'three';
import { createGarment } from './garment.js?v=9';
import { OrbitControls } from './vendor/OrbitControls.js';
const viewer=document.getElementById('viewer');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{document.getElementById('status').textContent='Для просмотра включите WebGL в браузере.';throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2.5));renderer.setClearColor(0x080808);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;viewer.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.05,100);camera.position.set(0,.15,7.2);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=true;controls.screenSpacePanning=true;controls.minDistance=2.5;controls.maxDistance=13;controls.minPolarAngle=.04;controls.maxPolarAngle=Math.PI-.04;controls.rotateSpeed=.7;controls.zoomSpeed=.75;controls.target.set(0,0,0);
scene.add(new THREE.HemisphereLight(0xfff0df,0x5d5963,1.8));
function light(color,intensity,x,y,z){const l=new THREE.DirectionalLight(color,intensity);l.position.set(x,y,z);scene.add(l);}
light(0xffe0bf,4,-3,4,4);light(0xffead8,3,3,2,-3);light(0xfff4e7,2.5,1,-1,4);
const {skirt,surface,edgeMat,design}=createGarment(renderer);scene.add(skirt);
let verticalTarget=0;
let enabled=true,interacting=false,resumeAt=0,speed=0,last=performance.now(),distanceTarget=null;
controls.addEventListener('start',()=>{interacting=true;distanceTarget=null;});controls.addEventListener('end',()=>{interacting=false;resumeAt=performance.now()+1300;});
const rotate=document.getElementById('rotate');function sync(){rotate.textContent=enabled?'Ⅱ':'▷';rotate.setAttribute('aria-pressed',String(enabled));rotate.setAttribute('aria-label',enabled?'Остановить автовращение':'Включить автовращение');}rotate.onclick=()=>{enabled=!enabled;sync();};sync();
function zoom(factor){distanceTarget=THREE.MathUtils.clamp((distanceTarget??camera.position.distanceTo(controls.target))*factor,controls.minDistance,controls.maxDistance);}document.getElementById('zoom-in').onclick=()=>zoom(.8);document.getElementById('zoom-out').onclick=()=>zoom(1.25);document.getElementById('move-up').onclick=()=>verticalTarget=Math.min(1.2,verticalTarget+.2);document.getElementById('move-down').onclick=()=>verticalTarget=Math.max(-1.2,verticalTarget-.2);document.getElementById('reset').onclick=()=>{verticalTarget=0;lengthTarget=1;lengthInput.value=1;lengthOutput.textContent="ДЛИННАЯ";enabled=true;sync();camera.position.set(0,.15,7.2);controls.target.set(0,0,0);skirt.rotation.set(0,0,0);distanceTarget=null;controls.update();};
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);const fit=Math.max(7.2,2.4/camera.aspect);const direction=camera.position.clone().sub(controls.target).normalize();camera.position.copy(controls.target).add(direction.multiplyScalar(Math.min(fit,12)));controls.update();}addEventListener('resize',resize);resize();

const cutPlane=new THREE.Plane(new THREE.Vector3(0,1,0),2);renderer.clippingPlanes=[cutPlane];
let lengthValue=1,lengthTarget=1;
const lengthInput=document.getElementById('length'),lengthOutput=document.getElementById('length-value');
lengthInput.addEventListener('input',()=>{lengthTarget=Number(lengthInput.value);lengthOutput.textContent=lengthTarget<.66?'КОРОТКАЯ':lengthTarget<.9?'СРЕДНЯЯ':'ДЛИННАЯ';});
const cutHem=new THREE.Mesh(new THREE.TorusGeometry(.5,.003,8,128),edgeMat);cutHem.rotation.x=Math.PI/2;skirt.add(cutHem);
function updateLength(dt){lengthValue=THREE.MathUtils.lerp(lengthValue,lengthTarget,1-Math.exp(-12*dt));const y=design.height/2-2.48*lengthValue;cutPlane.constant=-(y+skirt.position.y);if(lengthValue>.994){cutPlane.constant=2-skirt.position.y;cutHem.visible=false;}else{cutHem.visible=true;const p=surface(0,lengthValue),q=surface(Math.PI/2,lengthValue);cutHem.position.y=y+.004;cutHem.scale.set(p.x/.5,q.z/.5,1);}}

function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.15);last=now;const target=enabled&&!interacting&&now>resumeAt ? .32 : 0;speed+=(target-speed)*(1-Math.exp(-5*dt));skirt.rotation.y+=speed*dt;skirt.position.y=THREE.MathUtils.lerp(skirt.position.y,verticalTarget,1-Math.exp(-10*dt));if(distanceTarget!==null){const direction=camera.position.clone().sub(controls.target),distance=direction.length(),next=THREE.MathUtils.lerp(distance,distanceTarget,1-Math.exp(-9*dt));camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(next));if(Math.abs(next-distanceTarget)<.001)distanceTarget=null;}updateLength(dt);controls.update();renderer.render(scene,camera);}requestAnimationFrame(animate);
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('status').textContent='Графический контекст потерян. Обновите страницу.';});

export {skirt,camera,controls};
