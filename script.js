const config=window.RROSE_CONFIG,intro=document.getElementById('intro');let timer;
function enter(){intro.classList.add('done');intro.setAttribute('aria-hidden','true');intro.inert=true;clearTimeout(timer);}
timer=setTimeout(enter,matchMedia('(prefers-reduced-motion: reduce)').matches?150:1800);
document.getElementById('skip-intro').onclick=enter;
const sizeSelect=document.getElementById('size');
sizeSelect.replaceChildren(...config.sizes.map(s=>new Option(s,s)));sizeSelect.disabled=false;
const currency=document.getElementById('currency');currency.disabled=true;
const cartDialog=document.getElementById('cart-dialog'),deliveryPage=document.getElementById('delivery-page');
const shippingCountryInput=document.getElementById('shipping-country');
const countries='PL DE AT BE BG HR CY CZ DK EE FI FR GR HU IE IT LV LT LU MT NL PT RO SK SI ES SE GB NO CH US CA AU NZ JP KR SG AE AL AD BA IS LI MD ME MK RS TR UA BR MX IN ZA'.split(' ');
const names=new Intl.DisplayNames([navigator.language||'en'],{type:'region'});
shippingCountryInput.replaceChildren(...countries.map(c=>new Option(names.of(c)+(c==='PL'||c==='DE'?'':' — rate confirmation required'),c)));
let cart=[],delivery=null,serverQuote=null,revision=0,busy=false,attempt=null;
try{
 const saved=JSON.parse(localStorage.getItem('rrose-cart-v1')||'[]');
 if(Array.isArray(saved)) for(const i of saved){if(i&&config.sizes.includes(i.size)&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=20){const item=cart.find(x=>x.size===i.size);if(item)item.quantity=Math.min(20,item.quantity+i.quantity);else cart.push({size:i.size,quantity:i.quantity});}}
 const c=localStorage.getItem('rrose-country');if(countries.includes(c))shippingCountryInput.value=c;
 attempt=JSON.parse(sessionStorage.getItem('wu-checkout-attempt')||'null');
}catch{}
function money(n,cur=currency.value){return new Intl.NumberFormat(navigator.language||'en',{style:'currency',currency:cur}).format(n);}
function payload(){return {country:shippingCountryInput.value,items:cart.map(i=>({...i}))};}
function save(){try{localStorage.setItem('rrose-cart-v1',JSON.stringify(cart));localStorage.setItem('rrose-country',shippingCountryInput.value);}catch{}}
function count(){return cart.reduce((n,i)=>n+i.quantity,0);}
function message(code){return ({shipping_unavailable:'Delivery to this country is not available for payment yet.',packing_confirmation_required:'This quantity needs confirmed packing and delivery. Contact united.creative.buro@gmail.com.',checkout_unavailable:'Checkout is temporarily unavailable. Please try again later.',catalog_mismatch:'Checkout is temporarily unavailable.',request_key_reused:'Your bag changed. Please calculate delivery again.',checkout_expired:'Checkout expired. Check payment status before starting again.',order_already_processed:'This order was already processed. Check payment status before starting again.'})[code]||'Unable to reach secure checkout. Your bag has been saved. Please try again.';}
async function api(path,options={}){
 if(!config.checkoutApi)throw new Error('checkout_unavailable');
 const response=await fetch(config.checkoutApi+path,{...options,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...options.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'service_unavailable');return data;
}
function renderShipping(){
 const c=shippingCountryInput.value,rate=config.shipping.rates[c];currency.value=c==='PL'?'PLN':'EUR';
 document.getElementById('shipping-route').textContent=rate?rate.route:'not available until rate confirmed';
 document.getElementById('shipping-volume-weight').textContent='2.1 kg*';
 document.getElementById('shipping-cost').textContent=rate?money(rate[currency.value]):'unavailable';
 document.getElementById('add-delivery').disabled=busy||!cart.length||!config.checkoutApi;
 const q=serverQuote;
 document.getElementById('cart-shipping-label').textContent=q?'delivery to '+names.of(q.country):'delivery';
 document.getElementById('cart-shipping').textContent=q?money(q.shipping/100,q.currency):'not confirmed';
 document.getElementById('cart-delivery-link').textContent=q?'change':'calculate';
 document.getElementById('cart-grand-total').textContent=q?money(q.total/100,q.currency):'calculate delivery';
}
function renderCart(){
 shippingCountryInput.disabled=busy;document.getElementById('buy').disabled=busy||count()>=20;
 currency.value=shippingCountryInput.value==='PL'?'PLN':'EUR';
 document.getElementById('cart-count').textContent=String(count());
 const root=document.getElementById('cart-items');root.replaceChildren();
 if(!cart.length){const empty=document.createElement('p');empty.className='empty-cart';empty.textContent='your bag is empty.';root.append(empty);}
 for(const item of cart){
  const row=document.createElement('article');row.className='cart-item';
  row.innerHTML='<img src="assets/rrose/rrose-full.jpg" alt="rrose skirt"><div><h3>rrose</h3><p class="cart-size"></p><div class="quantity"><button class="minus" aria-label="Decrease quantity">−</button><span class="quantity-value"></span><button class="plus" aria-label="Increase quantity">+</button><button class="remove">remove</button></div></div><strong class="item-price"></strong>';
  row.querySelector('.cart-size').textContent=item.size;
  row.querySelector('.quantity-value').textContent=item.quantity;
  row.querySelector('.item-price').textContent=money(config.prices.long[currency.value]*item.quantity);
  row.querySelector('.minus').disabled=busy;row.querySelector('.remove').disabled=busy;
  row.querySelector('.minus').onclick=()=>{if(item.quantity>1)item.quantity--;else cart=cart.filter(i=>i!==item);changed();};
  row.querySelector('.plus').disabled=count()>=20||busy;
  row.querySelector('.plus').onclick=()=>{if(count()<20)item.quantity++;changed();};
  row.querySelector('.remove').onclick=()=>{cart=cart.filter(i=>i!==item);changed();};
  root.append(row);
 }
 document.getElementById('cart-total').textContent=money(count()*config.prices.long[currency.value]);renderShipping();
 const checkout=document.getElementById('checkout');checkout.disabled=!cart.length||busy||!config.checkoutApi;
 checkout.textContent=busy?'PLEASE WAIT…':'SECURE CHECKOUT';
 document.getElementById('checkout-note').textContent=!config.checkoutApi?'Checkout is temporarily unavailable. Your bag is saved.':serverQuote?'VAT included. Delivery charged once. Your selected sizes go with your order.':'Calculate delivery to confirm the full payable total. VAT included.';
 checkout.onclick=startCheckout;
}
function changed(){revision++;delivery=null;serverQuote=null;attempt=null;try{sessionStorage.removeItem('wu-checkout-attempt');}catch{}save();renderCart();document.getElementById('cart-status').textContent='Shopping bag updated.';}
function openDeliveryPage(){document.getElementById('delivery-status').textContent='';renderShipping();deliveryPage.showModal();}
document.querySelectorAll('[data-open-delivery]').forEach(b=>b.addEventListener('click',openDeliveryPage));
document.getElementById('close-delivery').onclick=()=>deliveryPage.close();
shippingCountryInput.onchange=changed;
document.getElementById('add-delivery').onclick=async()=>{
 const current=revision;busy=true;renderCart();document.getElementById('delivery-status').textContent='Confirming delivery…';
 try{
  const q=await api('/quote',{method:'POST',body:JSON.stringify(payload())});
  if(current!==revision)return;serverQuote=q;delivery=q.country;
  document.getElementById('delivery-status').textContent='Delivery confirmed. Total: '+money(q.total/100,q.currency)+'. VAT included.';
  deliveryPage.close();if(!cartDialog.open)cartDialog.showModal();
 }catch(e){document.getElementById('delivery-status').textContent=message(e.message);}
 finally{busy=false;renderCart();}
};
async function startCheckout(){
 if(busy||!cart.length)return;if(!serverQuote||!delivery){openDeliveryPage();return;}
 const input=payload(),snapshot=JSON.stringify(input),current=revision;
 busy=true;renderCart();
 try{
  const fresh=await api('/quote',{method:'POST',body:snapshot});
  if(current!==revision)return;
  if(fresh.total!==serverQuote.total||fresh.currency!==serverQuote.currency){serverQuote=fresh;document.getElementById('cart-status').textContent='Total updated. Please review and continue.';return;}
  if(!attempt||attempt.snapshot!==snapshot){
   const bytes=crypto.getRandomValues(new Uint8Array(32));
   attempt={id:crypto.randomUUID(),token:btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''),snapshot};
  }
  // Save before creating the session: a timeout can be retried with the same Stripe idempotency key.
  sessionStorage.setItem('wu-checkout-attempt',JSON.stringify(attempt));
  const result=await api('/checkout',{method:'POST',body:snapshot,headers:{Authorization:'Bearer '+attempt.token,'Idempotency-Key':attempt.id}});
  if(current!==revision)return;
  if(result.quote.total!==fresh.total||result.quote.currency!==fresh.currency)throw new Error('total_changed');
  if(new URL(result.url).origin!=='https://checkout.stripe.com')throw new Error('invalid_checkout_url');
  window.location.assign(result.url);
 }catch(e){document.getElementById('cart-status').textContent=message(e.message);document.getElementById('checkout-note').textContent=message(e.message);}
 finally{busy=false;const note=document.getElementById('checkout-note').textContent;renderCart();document.getElementById('checkout-note').textContent=note;}
}
document.getElementById('buy').disabled=false;
document.getElementById('buy').onclick=()=>{if(busy||count()>=20)return;const size=sizeSelect.value,item=cart.find(i=>i.size===size);if(item)item.quantity++;else cart.push({size,quantity:1});changed();cartDialog.showModal();};
document.getElementById('open-cart').onclick=()=>cartDialog.showModal();document.getElementById('close-cart').onclick=()=>cartDialog.close();
currency.onchange=()=>{};renderCart();
cartDialog.addEventListener('click',e=>{if(e.target===cartDialog){const r=cartDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)cartDialog.close();}});
document.getElementById('year').textContent=new Date().getFullYear();
async function checkOrder(){
 const thanks=document.getElementById('order-thanks'),text=document.getElementById('order-confirmation-status');
 if(!thanks.open)thanks.showModal();
 if(!attempt){text.textContent='Payment cannot be verified in this browser. Contact support with your Stripe receipt. Your bag is saved.';return;}
 text.textContent='Checking payment confirmation…';
 try{
  const result=await api('/orders/'+attempt.id,{headers:{Authorization:'Bearer '+attempt.token}});
  if(result.status==='failed'||result.status==='expired'){attempt=null;try{sessionStorage.removeItem('wu-checkout-attempt');}catch{}}
  if(result.status==='paid'){
   text.textContent='Payment confirmed. Order '+result.id+'. Dispatch information will follow by email.';
   if(attempt.snapshot===JSON.stringify(payload())){cart=[];serverQuote=null;delivery=null;save();renderCart();}
  }else text.textContent=({pending:'Payment confirmation is pending. Check again shortly; do not place another order.',failed:'Payment failed. Your bag is saved. Contact support or try checkout again.',expired:'Checkout expired. Your bag is saved. Calculate delivery to try again.'})[result.status]||'Payment not confirmed.';
 }catch{text.textContent='Payment confirmation is unavailable. Your bag is saved. Check again shortly or contact support.';}
}
document.getElementById('check-order-status').onclick=checkOrder;
const checkoutReturn=new URLSearchParams(location.search).get('checkout');
if(checkoutReturn==='returned')checkOrder();
if(checkoutReturn==='cancelled'){cartDialog.showModal();document.getElementById('checkout-note').textContent='Checkout was cancelled. Your bag is saved. No payment is assumed.';}
if(checkoutReturn)history.replaceState(null,'',location.pathname+location.hash);
const video=document.getElementById('product-video'),film=document.getElementById('product-film'),filmContext=film.getContext('2d',{willReadFrequently:true}),videoButton=document.getElementById('product-film'),videoStatus=document.getElementById('video-status'),view=document.querySelector('.viewfinder'),photoView=document.getElementById('camera-photo-view'),zoomRange=document.getElementById('zoom-range');let lens=1;
film.width=540;film.height=960;let framePending=false;
const zoomLoupe=document.getElementById('zoom-loupe'),zoomLoupeCanvas=document.getElementById('zoom-loupe-canvas'),zoomLoupeContext=zoomLoupeCanvas.getContext('2d');let loupePoint=null;
// The loupe magnifies exactly the spot under the pointer: undo the lens scale, then the contain-fit of the film.
const loupePower=2.6;
function renderZoomLoupe(){if(!loupePoint||!film.classList.contains('ready')||photoView&&!photoView.hidden)return;const rect=view.getBoundingClientRect(),fit=Math.min(rect.width/film.width,rect.height/film.height),x=(loupePoint.x-rect.left-rect.width/2)/lens+rect.width/2,y=(loupePoint.y-rect.top-rect.height/2)/lens+rect.height/2,fx=(x-(rect.width-film.width*fit)/2)/fit,fy=(y-(rect.height-film.height*fit)/2)/fit,size=zoomLoupe.offsetWidth/(fit*lens*loupePower);zoomLoupeContext.fillStyle='#f7f6f2';zoomLoupeContext.fillRect(0,0,zoomLoupeCanvas.width,zoomLoupeCanvas.height);zoomLoupeContext.drawImage(film,fx-size/2,fy-size/2,size,size,0,0,zoomLoupeCanvas.width,zoomLoupeCanvas.height);}
function renderFilm(){if(video.readyState<2||!filmContext)return;filmContext.drawImage(video,0,0,film.width,film.height);const frame=filmContext.getImageData(0,0,film.width,film.height),pixels=frame.data;for(let i=0;i<pixels.length;i+=4){const low=Math.min(pixels[i],pixels[i+1],pixels[i+2]);if(low>180){const blend=Math.min(1,(low-180)/15);pixels[i+3]=Math.round(255*(1-blend));}}filmContext.putImageData(frame,0,0);film.classList.add('ready');if(loupePoint)renderZoomLoupe();}
function scheduleFrame(){if(framePending||video.paused)return;framePending=true;const callback=()=>{framePending=false;renderFilm();scheduleFrame();};if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(callback);else setTimeout(callback,42);}
function syncVideo(){const playing=!video.paused;document.getElementById('play-indicator').classList.toggle('visible',!playing);videoButton.setAttribute('aria-label',playing?'Pause skirt video':'Play skirt video');videoButton.setAttribute('aria-pressed',String(playing));}
video.addEventListener('loadeddata',()=>{renderFilm();syncVideo();});video.addEventListener('play',()=>{videoStatus.textContent='';syncVideo();scheduleFrame();});video.addEventListener('pause',()=>{syncVideo();renderFilm();});video.addEventListener('seeked',renderFilm);video.addEventListener('error',()=>{videoStatus.textContent='Video could not load. Please refresh.';});
async function togglePlayback(){if(!video.paused)video.pause();else{try{await video.play();}catch{videoStatus.textContent='Playback could not start. Try again.';}syncVideo();}}

if(matchMedia('(prefers-reduced-motion: reduce)').matches){video.autoplay=false;video.pause();}else video.play().catch(()=>syncVideo());syncVideo();

const sizeWindow=document.getElementById('size-window'),closeSizeWindowButton=document.getElementById('close-size-window');
let sizeFocusOrigin=null,bodyOverflowBeforeSize='';
function openSizeGuide(){if(!sizeWindow.hidden)return;sizeFocusOrigin=document.activeElement;bodyOverflowBeforeSize=document.body.style.overflow;document.body.style.overflow='hidden';document.querySelectorAll('header,.camera-app,footer').forEach(el=>el.inert=true);sizeWindow.hidden=false;closeSizeWindowButton.focus();}
function closeSizeGuide(){if(sizeWindow.hidden)return;sizeWindow.hidden=true;document.querySelectorAll('header,.camera-app,footer').forEach(el=>el.inert=false);document.body.style.overflow=bodyOverflowBeforeSize;const target=sizeFocusOrigin&&sizeFocusOrigin.isConnected?sizeFocusOrigin:document.getElementById('tab-size');sizeFocusOrigin=null;target.focus();}
closeSizeWindowButton.onclick=closeSizeGuide;
sizeWindow.addEventListener('click',e=>{if(e.target===sizeWindow)closeSizeGuide();});
sizeWindow.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeSizeGuide();}if(e.key==='Tab'){e.preventDefault();closeSizeWindowButton.focus();}});
const modeNames=['rrose','size','delivery'];let activeMode=0;
function selectMode(index,focus=false){activeMode=(index+modeNames.length)%modeNames.length;const name=modeNames[activeMode];document.querySelectorAll('[data-info]').forEach((panel,i)=>{panel.hidden=false;const count=modeNames.length,slot=i===activeMode?'left':i===(activeMode+1)%count?'right':i===(activeMode+count-1)%count?'exit-left':'exit-right';panel.dataset.slot=slot;panel.setAttribute('aria-hidden',String(slot.startsWith('exit')));panel.inert=slot.startsWith('exit');});document.querySelectorAll('[data-mode]').forEach(t=>{const on=t.dataset.mode===name;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;if(on&&focus)t.focus();});document.getElementById('info-panel').setAttribute('aria-labelledby','tab-'+name);if(name==='size')openSizeGuide();}
document.querySelectorAll('[data-mode]').forEach(tab=>{tab.onclick=()=>selectMode(modeNames.indexOf(tab.dataset.mode));tab.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectMode(activeMode+(e.key==='ArrowRight'?1:-1),true);}if(e.key==='Home'){e.preventDefault();selectMode(0,true);}if(e.key==='End'){e.preventDefault();selectMode(modeNames.length-1,true);}};});document.getElementById('next-mode').onclick=()=>selectMode(activeMode+1);document.getElementById('previous-mode').onclick=()=>selectMode(activeMode-1);
let swipeStart=null;const info=document.querySelector('.camera-information');info.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))swipeStart=e.clientX;});info.addEventListener('pointerup',e=>{if(swipeStart!==null&&Math.abs(e.clientX-swipeStart)>45)selectMode(activeMode+(e.clientX<swipeStart?1:-1));swipeStart=null;});info.addEventListener('pointercancel',()=>swipeStart=null);
let zoomIdle;function setLens(value,reveal=true){lens=Math.max(.75,Math.min(2.5,value));zoomRange.value=lens;view.style.setProperty('--lens',lens);document.getElementById('zoom-value').textContent=(Math.abs(lens-.75)<.005?'0.75':lens.toFixed(1))+'×';view.classList.toggle('zoomed',Math.abs(lens-1)>.01);const dialNeedle=document.querySelector('.dial-needle');if(dialNeedle){const dialX=58+(lens-.75)/1.75*204,dialY=112-85*Math.sqrt(Math.max(0,1-((dialX-160)/130)**2)),dialAngle=Math.atan2(dialY-110,dialX-160)*180/Math.PI+90;dialNeedle.setAttribute('transform',`translate(${dialX} ${dialY}) rotate(${dialAngle}) translate(-160 -5)`);}if(reveal){view.classList.add('zooming');clearTimeout(zoomIdle);zoomIdle=setTimeout(()=>view.classList.remove('zooming'),1300);}if(loupePoint)renderZoomLoupe();const tick=Math.round((lens-.75)/1.75*60);document.querySelectorAll('[data-tick]').forEach(el=>el.classList.toggle('lit',Number(el.dataset.tick)<=tick));document.querySelectorAll('#zoom-ticks text').forEach(el=>el.classList.toggle('lit',lens>=parseFloat(el.textContent)-.001));document.querySelectorAll('[data-zoom]').forEach(b=>{const on=Math.abs(Number(b.dataset.zoom)-lens)<.02;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});}
zoomRange.oninput=()=>setLens(Number(zoomRange.value));document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>setLens(Number(b.dataset.zoom)));document.getElementById('reset-zoom').onclick=()=>setLens(1);const zoomDial=document.querySelector('.zoom-dial');let zoomDialPointer=null;function setDialLens(e){const rect=zoomDial.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*320,value=.75+Math.max(0,Math.min(1,(x-58)/204))*1.75;setLens(value);}zoomDial.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();zoomDialPointer=e.pointerId;zoomDial.setPointerCapture(e.pointerId);setDialLens(e);});zoomDial.addEventListener('pointermove',e=>{if(zoomDialPointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();setDialLens(e);});for(const eventName of ['pointerup','pointercancel'])zoomDial.addEventListener(eventName,e=>{if(zoomDialPointer===e.pointerId){e.stopPropagation();zoomDialPointer=null;}});zoomDial.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();setLens(lens+.05);}if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();setLens(lens-.05);}if(e.key==='Home'){e.preventDefault();setLens(.75);}if(e.key==='End'){e.preventDefault();setLens(2.5);}});view.addEventListener('wheel',e=>{if(e.target.closest('.camera-photo-view'))return;e.preventDefault();setLens(lens*Math.exp(-e.deltaY*.001));},{passive:false});
const touches=new Map();let pinchDistance=0;view.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,.camera-photo-view'))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});e.target.setPointerCapture(e.pointerId);if(touches.size===2){const[a,b]=[...touches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);}});view.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const[a,b]=[...touches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(pinchDistance)setLens(lens*distance/pinchDistance);pinchDistance=distance;}});for(const ev of ['pointerup','pointercancel'])view.addEventListener(ev,e=>{touches.delete(e.pointerId);pinchDistance=0;});

selectMode(0);setLens(1,false);

const notification=document.getElementById('instagram-notification'),instagramButton=document.getElementById('instagram'),instagramCard=document.getElementById('instagram-card');let closeNoticeTimer;
function showProfile(open){clearTimeout(closeNoticeTimer);if(innerWidth<=650){const rect=notification.getBoundingClientRect();instagramCard.style.left=(16-rect.left)+'px';instagramCard.style.right='auto';}else{instagramCard.style.removeProperty('left');instagramCard.style.removeProperty('right');}instagramCard.hidden=!open;instagramButton.setAttribute('aria-expanded',String(open));}
notification.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')showProfile(true);});notification.addEventListener('pointerleave',()=>{closeNoticeTimer=setTimeout(()=>{if(!notification.contains(document.activeElement))showProfile(false);},180);});notification.addEventListener('focusin',e=>{if(e.target.matches(':focus-visible'))showProfile(true);});notification.addEventListener('focusout',()=>setTimeout(()=>{if(!notification.contains(document.activeElement))showProfile(false);},0));instagramButton.addEventListener('click',()=>showProfile(true));document.addEventListener('click',e=>{if(!notification.contains(e.target))showProfile(false);});notification.addEventListener('keydown',e=>{if(e.key==='Escape'){showProfile(false);instagramButton.focus();}});
function revealNotice(){notification.classList.add('notice-ready');}if(intro.classList.contains('done'))revealNotice();else{const introObserver=new MutationObserver(()=>{if(intro.classList.contains('done')){revealNotice();introObserver.disconnect();}});introObserver.observe(intro,{attributes:true,attributeFilter:['class']});}

film.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const rect=view.getBoundingClientRect();zoomLoupe.style.left=e.clientX-rect.left+'px';zoomLoupe.style.top=e.clientY-rect.top+'px';loupePoint={x:e.clientX,y:e.clientY};renderZoomLoupe();zoomLoupe.classList.add('visible');});film.addEventListener('pointerleave',()=>{zoomLoupe.classList.remove('visible');loupePoint=null;});
film.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();togglePlayback();}});
// One finger on touch screens: drag sideways to move the skirt through its motion, tap to pause or play,
// double tap to zoom, press and hold for the detail loupe. Vertical drags still scroll the page.
let fingerDrag=null,fingerTap=null,fingerDragEnded=0,seekTarget=null,lastPointerType='mouse';const scrubSeconds=5;
function placeLoupe(x,y,lift){const rect=view.getBoundingClientRect();zoomLoupe.style.left=x-rect.left+'px';zoomLoupe.style.top=y-rect.top-lift+'px';loupePoint={x,y};renderZoomLoupe();zoomLoupe.classList.add('visible');}
function hideLoupe(){zoomLoupe.classList.remove('visible');loupePoint=null;}
function applySeek(){if(seekTarget===null||video.seeking)return;const d=Number.isFinite(video.duration)&&video.duration>0?video.duration:16;video.currentTime=((seekTarget%d)+d)%d;seekTarget=null;}
video.addEventListener('seeked',applySeek);
film.addEventListener('pointerdown',e=>{lastPointerType=e.pointerType;if(e.pointerType==='mouse'||!e.isPrimary)return;fingerDrag={id:e.pointerId,x:e.clientX,y:e.clientY,start:video.currentTime,playing:!video.paused,moved:false,loupe:false,timer:setTimeout(()=>{if(fingerDrag&&!fingerDrag.moved&&touches.size<2){fingerDrag.loupe=true;placeLoupe(fingerDrag.x,fingerDrag.y,96);}},380)};});
film.addEventListener('pointermove',e=>{if(!fingerDrag||e.pointerId!==fingerDrag.id)return;if(touches.size>1){clearTimeout(fingerDrag.timer);hideLoupe();fingerDrag.moved=true;return;}const dx=e.clientX-fingerDrag.x,dy=e.clientY-fingerDrag.y;if(fingerDrag.loupe){placeLoupe(e.clientX,e.clientY,96);return;}if(!fingerDrag.moved&&Math.hypot(dx,dy)>8){clearTimeout(fingerDrag.timer);fingerDrag.moved=true;fingerDrag.scrub=Math.abs(dx)>Math.abs(dy);if(fingerDrag.scrub)video.pause();}if(fingerDrag.scrub){seekTarget=fingerDrag.start-dx/view.clientWidth*scrubSeconds;applySeek();}});
function endFinger(e){if(!fingerDrag||e.pointerId!==fingerDrag.id)return;const drag=fingerDrag;fingerDrag=null;clearTimeout(drag.timer);if(drag.loupe)hideLoupe();if(drag.moved||drag.loupe){fingerDragEnded=performance.now();if(drag.scrub&&drag.playing)video.play().catch(syncVideo);}}
film.addEventListener('touchmove',e=>{if(fingerDrag&&(fingerDrag.loupe||fingerDrag.scrub))e.preventDefault();},{passive:false});film.addEventListener('pointerup',endFinger);film.addEventListener('pointercancel',endFinger);
film.addEventListener('click',()=>{if(lastPointerType==='mouse'){togglePlayback();return;}if(performance.now()-fingerDragEnded<400)return;if(fingerTap){clearTimeout(fingerTap);fingerTap=null;setLens(lens>1.2?1:2);return;}fingerTap=setTimeout(()=>{fingerTap=null;togglePlayback();},260);});
const cameraPhoto=document.getElementById('camera-photo'),photoViewer=document.getElementById('photo-viewer'),photosGrid=document.getElementById('photos-grid'),photosScroll=document.querySelector('.photos-scroll'),finderContent=document.querySelector('.finder-content'),viewerStrip=document.getElementById('viewer-strip'),cameraApp=document.querySelector('.camera-app');
const galleryPhotos=[['rrose-full.jpg','Full-length rrose wrap skirt'],['look-lounge.jpg','rrose worn reclining on stone benches'],['rrose-detail.jpg','rrose twill, cord and fastening detail'],['look-stairs.jpg','rrose worn on granite steps'],['waist.jpg','rrose waistband and silver cord'],['look-studio.jpg','rrose with raw hem in the studio'],['short.jpg','Short length rrose wrap skirt']];let photoIndex=0,wasPlaying=false,photoScale=1,photoTranslateX=0,photoTranslateY=0,photoSwipe=null,photoDrag=null;
// Library grid and viewer strip, laid out like iCloud Photos on desktop and the Photos app on iPhone.
function photoTile(index,className){const b=document.createElement('button');b.type='button';b.className=className;b.setAttribute('aria-label','Open photo '+(index+1)+': '+galleryPhotos[index][1]);const img=document.createElement('img');img.src='assets/thumbs/'+galleryPhotos[index][0];img.alt='';img.loading='lazy';img.decoding='async';b.append(img);if(className==='photo-tile'){const label=document.createElement('span');label.textContent=galleryPhotos[index][0];b.append(label);}return b;}
galleryPhotos.forEach((photo,index)=>{const tile=photoTile(index,'photo-tile');tile.onclick=()=>openViewer(index);photosGrid.append(tile);const thumb=photoTile(index,'strip-thumb');thumb.onclick=()=>galleryPhoto(index);viewerStrip.append(thumb);});
function applyPhotoZoom(){cameraPhoto.style.transform=`translate(${photoTranslateX}px,${photoTranslateY}px) scale(${photoScale})`;cameraPhoto.style.cursor=photoScale>1?'grab':'zoom-in';photoView.classList.toggle('photo-zoomed',photoScale>1);}
function resetPhotoZoom(){photoScale=1;photoTranslateX=photoTranslateY=0;cameraPhoto.style.transformOrigin='50% 50%';applyPhotoZoom();}
function galleryPhoto(index){photoIndex=(index+galleryPhotos.length)%galleryPhotos.length;cameraPhoto.src='assets/rrose/'+galleryPhotos[photoIndex][0];cameraPhoto.alt=galleryPhotos[photoIndex][1];document.getElementById('photo-count').textContent=String(photoIndex+1).padStart(2,'0')+' / '+String(galleryPhotos.length).padStart(2,'0');document.getElementById('photo-name').textContent=galleryPhotos[photoIndex][0];viewerStrip.querySelectorAll('.strip-thumb').forEach((t,i)=>{t.classList.toggle('active',i===photoIndex);t.setAttribute('aria-current',String(i===photoIndex));});viewerStrip.children[photoIndex].scrollIntoView({block:'nearest',inline:'center'});resetPhotoZoom();}
function openViewer(index){galleryPhoto(index);finderContent.inert=true;photoViewer.hidden=false;document.getElementById('photo-close').focus();}
function closeViewer(){photoViewer.hidden=true;finderContent.inert=false;photosGrid.children[photoIndex].focus();}
const galleryButton=document.getElementById('open-gallery'),thumbVideo=galleryButton.querySelector('.thumb-video');
function openGallery(){galleryButton.setAttribute('aria-label','Back to animation');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)thumbVideo.play().catch(()=>{});wasPlaying=!video.paused;video.pause();photoViewer.hidden=true;document.body.appendChild(photoView);photoView.hidden=false;finderContent.inert=false;photosScroll.scrollTop=0;view.classList.add('gallery-open');cameraApp.classList.add('gallery-mode');film.inert=true;document.querySelectorAll('header,.camera-app,footer').forEach(el=>el.inert=true);document.getElementById('back-to-video').focus();}
async function backToVideo(){galleryButton.setAttribute('aria-label','Open skirt photos');thumbVideo.pause();photoView.hidden=true;photoViewer.hidden=true;finderContent.inert=false;view.classList.remove('gallery-open');cameraApp.classList.remove('gallery-mode');film.inert=false;document.querySelectorAll('header,.camera-app,footer').forEach(el=>el.inert=false);if(wasPlaying){try{await video.play();}catch{syncVideo();}}document.getElementById('open-gallery').focus();}
galleryButton.onclick=()=>photoView.hidden?openGallery():backToVideo();document.getElementById('back-to-video').onclick=backToVideo;document.getElementById('photo-close').onclick=closeViewer;document.getElementById('previous-photo').onclick=()=>galleryPhoto(photoIndex-1);document.getElementById('next-photo').onclick=()=>galleryPhoto(photoIndex+1);photoView.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(!photoViewer.hidden)closeViewer();else backToVideo();}if(e.key==='Tab'){const controls=photoViewer.hidden?[document.getElementById('back-to-video'),...photosGrid.querySelectorAll('button')]:[document.getElementById('photo-close'),document.getElementById('previous-photo'),document.getElementById('next-photo'),...viewerStrip.querySelectorAll('button')];const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if(photoViewer.hidden)return;if(e.key==='ArrowRight'){e.preventDefault();galleryPhoto(photoIndex+1);}if(e.key==='ArrowLeft'){e.preventDefault();galleryPhoto(photoIndex-1);}});
cameraPhoto.addEventListener('wheel',e=>{e.preventDefault();photoScale=Math.max(1,Math.min(3,photoScale*Math.exp(-e.deltaY*.001)));const r=cameraPhoto.getBoundingClientRect();cameraPhoto.style.transformOrigin=`${(e.clientX-r.left)/r.width*100}% ${(e.clientY-r.top)/r.height*100}%`;applyPhotoZoom();},{passive:false});cameraPhoto.addEventListener('dblclick',e=>{photoScale=photoScale===1?2.2:1;photoTranslateX=photoTranslateY=0;const r=cameraPhoto.getBoundingClientRect();cameraPhoto.style.transformOrigin=`${(e.clientX-r.left)/r.width*100}% ${(e.clientY-r.top)/r.height*100}%`;applyPhotoZoom();});
let photoPinchStart=0,photoPinchScale=1;const photoPointers=new Map();cameraPhoto.addEventListener('pointerdown',e=>{photoPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});cameraPhoto.setPointerCapture(e.pointerId);if(photoPointers.size===2){const[a,b]=[...photoPointers.values()];photoPinchStart=Math.hypot(a.x-b.x,a.y-b.y);photoPinchScale=photoScale;photoSwipe=null;photoDrag=null;return;}if(photoScale>1){photoDrag={x:e.clientX,y:e.clientY,startX:photoTranslateX,startY:photoTranslateY};cameraPhoto.style.cursor='grabbing';}else photoSwipe=e.clientX;});cameraPhoto.addEventListener('pointermove',e=>{if(photoPointers.has(e.pointerId))photoPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(photoPointers.size===2&&photoPinchStart){const[a,b]=[...photoPointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);photoScale=Math.max(1,Math.min(3,photoPinchScale*distance/photoPinchStart));applyPhotoZoom();return;}if(!photoDrag)return;photoTranslateX=photoDrag.startX+e.clientX-photoDrag.x;photoTranslateY=photoDrag.startY+e.clientY-photoDrag.y;applyPhotoZoom();});cameraPhoto.addEventListener('pointerup',e=>{const pinching=photoPinchStart>0;photoPointers.delete(e.pointerId);if(photoDrag){photoDrag=null;applyPhotoZoom();return;}if(pinching){if(photoPointers.size<2){photoPinchStart=0;photoSwipe=null;}applyPhotoZoom();return;}if(photoSwipe!==null&&Math.abs(e.clientX-photoSwipe)>40)galleryPhoto(photoIndex+(e.clientX<photoSwipe?1:-1));photoSwipe=null;});cameraPhoto.addEventListener('pointercancel',e=>{photoPointers.delete(e.pointerId);photoPinchStart=0;photoSwipe=null;photoDrag=null;});

// Keep the small controls distributed along one shared lower edge.
const lowerControls=document.querySelector('.camera-actions');lowerControls.prepend(document.getElementById('previous-mode'));lowerControls.append(document.getElementById('next-mode'));
// Size guide easter egg: the note turns into a marker scrawl on hover, or on tap.
const sizeEgg=document.getElementById('size-egg'),sizeSection=document.querySelector('[data-info="size"]');
function scrawl(on){sizeSection.classList.toggle('scrawl',on);}
sizeEgg.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')scrawl(true);});sizeSection.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')scrawl(false);});sizeEgg.addEventListener('click',openSizeGuide);
const productSection=document.getElementById('rrose-details');let productTouchScrawl;
function productScrawl(on){productSection.classList.toggle('scrawl',on);}
productSection.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')productScrawl(true);});
productSection.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')productScrawl(false);});
productSection.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&e.target.closest('.product-title,dt,dd')){productScrawl(true);clearTimeout(productTouchScrawl);productTouchScrawl=setTimeout(()=>productScrawl(false),1800);}});
// First visit on a touch screen: a brief hint for the one-finger controls.
if(matchMedia('(hover: none)').matches){let seen=false;try{seen=!!sessionStorage.getItem('rrose-touch-hint');sessionStorage.setItem('rrose-touch-hint','1');}catch{}if(!seen){const hint=document.getElementById('touch-hint');setTimeout(()=>{hint.classList.add('visible');setTimeout(()=>hint.classList.remove('visible'),3200);},2600);film.addEventListener('pointerdown',()=>hint.classList.remove('visible'),{once:true});}}
