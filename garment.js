import * as THREE from 'three';
export function createGarment(renderer){
 const skirt=new THREE.Group();
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),data=ctx.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4,v=150+Math.sin((x+y)*Math.PI/4)*16+Math.sin(x*2.2+y*.7)*4;data.data[i]=data.data[i+1]=data.data[i+2]=v;data.data[i+3]=255;}ctx.putImageData(data,0,0);const weave=new THREE.CanvasTexture(canvas);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(7,14);weave.anisotropy=renderer.capabilities.getMaxAnisotropy();
 const cloth=new THREE.MeshStandardMaterial({color:0x292b30,roughness:.95,metalness:0,bumpMap:weave,bumpScale:.0018,side:THREE.DoubleSide});
 const stitching=new THREE.MeshStandardMaterial({color:0x34363a,roughness:1});const rope=new THREE.MeshStandardMaterial({color:0xd8d8d3,roughness:.65});const metal=new THREE.MeshStandardMaterial({color:0xd3d7dc,metalness:.88,roughness:.23});
 const height=2.75;
 function surface(theta,t,offset=0){const hip=.075*Math.exp(-Math.pow((t-.2)/.17,2));const rx=.46+.20*t+hip,rz=.29+.13*t+hip*.6;const front=Math.max(0,Math.sin(theta));const drape=.028*Math.sin(theta*3+t*3.4)*Math.sin(t*Math.PI)+front*.035*Math.sin(t*14+theta*2)*Math.exp(-t*3.5);return new THREE.Vector3((rx+drape+offset)*Math.cos(theta),height/2-2.48*t,(rz+drape+offset)*Math.sin(theta));}
 function geometry(sample,cols=120,rows=64){const positions=[],uv=[],indices=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const p=sample(i/cols,j/rows);positions.push(p.x,p.y,p.z);uv.push(i/cols,j/rows);}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+cols+1,a+cols+2,a+1);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
 function mesh(g,material=cloth){const m=new THREE.Mesh(g,material);skirt.add(m);return m;}
 function tube(points,r,material=stitching,segments=100){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),segments,r,8,false),material);}
 mesh(geometry((u,t)=>surface(u*Math.PI*2,t)));
 // Broad front wrap. Its free edge travels diagonally and ends in a long corner.
 function wrap(u,t){const edge=2.00-.9*t,theta=.02+u*(edge-.02),p=surface(theta,t,.016);p.y-=.28*Math.pow(t,5)*Math.pow(u,3);p.z+=Math.sin(theta)*.045*Math.sin(t*Math.PI);return p;}
 mesh(geometry(wrap,84,80));
 tube(Array.from({length:81},(_,i)=>wrap(1,i/80)),.0018);
 tube(Array.from({length:85},(_,i)=>wrap(i/84,1)),.002);
 tube(Array.from({length:161},(_,i)=>surface(i/160*Math.PI*2,1,.004)),.002);
 mesh(geometry((u,t)=>surface(u*Math.PI*2,t*.039,.008),120,6));
 for(const t of [.001,.039])tube(Array.from({length:161},(_,i)=>surface(i/160*Math.PI*2,t,.012)),.0017);
 for(let i=0;i<7;i++){const theta=.2+i/7*Math.PI*2,p=surface(theta,.022,.021),loop=mesh(new THREE.BoxGeometry(.038,.13,.017));loop.position.copy(p);loop.rotation.y=Math.PI/2-theta;}
 // Single doubled silver cord with fine braided strands.
 for(let strand=0;strand<3;strand++){const points=[];for(let i=0;i<=360;i++){const theta=i/360*Math.PI*2,phase=theta*72+strand*Math.PI*2/3,p=surface(theta,.018,.027+Math.cos(phase)*.002);p.y+=Math.sin(phase)*.002;points.push(p);}tube(points,.0034,rope,360);}
 const end=new THREE.Vector3(.88,.88,.30);
 for(let strand=0;strand<2;strand++)tube([new THREE.Vector3(.35,1.31,.23),new THREE.Vector3(.50,1.21,.31),new THREE.Vector3(.71,1.08+strand*.01,.34),end.clone().add(new THREE.Vector3(0,strand*.012,0))],.005,rope,70);
 tube([new THREE.Vector3(.4,1.36,.23),new THREE.Vector3(.37,1.25,.34),new THREE.Vector3(.31,1.21,.36)],.006,rope,35);
 // Pear-shaped carabiner, including its gate and sleeve.
 const ringPoints=[new THREE.Vector3(.88,.88,.30),new THREE.Vector3(.84,.72,.30),new THREE.Vector3(.83,.60,.30),new THREE.Vector3(.87,.55,.30),new THREE.Vector3(.93,.57,.30),new THREE.Vector3(.95,.63,.30),new THREE.Vector3(.93,.78,.30),new THREE.Vector3(.90,.88,.30),new THREE.Vector3(.88,.88,.30)];tube(ringPoints,.008,metal,80);
 tube([new THREE.Vector3(.91,.85,.30),new THREE.Vector3(.945,.65,.30)],.007,metal,12);tube([new THREE.Vector3(.925,.77,.30),new THREE.Vector3(.938,.70,.30)],.011,metal,12);
 return {skirt,surface,edgeMat:stitching,design:{height}};
}
