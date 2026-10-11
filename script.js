const object = document.getElementById('object');
const heroVideo = document.getElementById('hero-video');
const motionButton = document.querySelector('[data-view=motion]');
function syncMotion() { const playing = !heroVideo.paused; motionButton.setAttribute('aria-pressed', String(playing)); document.getElementById('motion-label').textContent = playing ? 'ON' : 'OFF'; }
heroVideo.addEventListener('play', syncMotion);
heroVideo.addEventListener('pause', syncMotion);
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { heroVideo.autoplay = false; heroVideo.pause(); }
syncMotion();
const toggle = document.getElementById('view-toggle');
const menu = document.getElementById('view-menu');
toggle.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; toggle.setAttribute('aria-pressed', String(open)); });
document.addEventListener('click', e => { if (!menu.contains(e.target) && !toggle.contains(e.target)) { menu.hidden = true; toggle.setAttribute('aria-pressed', 'false'); } });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
 const view = button.dataset.view;
 if (view === 'motion') { if (heroVideo.paused) heroVideo.play().catch(syncMotion); else heroVideo.pause(); }
 else object.classList.toggle('detail', view === 'detail');
}));
const details = {
 silhouette: ['01 / SILHOUETTE', 'Volume, unbound.', 'An elongated A-line form. A familiar denim waist opens into generous volume and an uneven raw hem. Designed as a study of movement without categories.'],
 construction: ['02 / CONSTRUCTION', 'Structure beneath.', 'Vertical panel seams, a jean-style waistband and exposed sectional layers reveal the architecture of the garment. An exploded visual study, rather than a finished production specification.'],
 texture: ['03 / RAW EDGE', 'Leave it unfinished.', 'Cobalt denim, visible stitching and a frayed edge. The contrast between precise structure and an open, irregular finish.']
};
const dialog = document.getElementById('detail-dialog');
document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => { const [number,title,description] = details[button.dataset.detail]; document.getElementById('detail-number').textContent=number; document.getElementById('detail-title').textContent=title; document.getElementById('detail-description').textContent=description; dialog.showModal(); }));
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.getElementById('year').textContent=new Date().getFullYear();
document.getElementById('copy-link').addEventListener('click',async()=>{const status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(location.href);status.textContent='LINK COPIED.';}catch{status.textContent='BOOKMARK THIS PAGE TO KEEP IT CLOSE.';}});
