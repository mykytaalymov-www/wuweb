import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { JSDOM, VirtualConsole } from 'jsdom';
import { quote } from '../catalog.mjs';

const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../../script.js',import.meta.url),'utf8').split("const video=document.getElementById")[0];
const config=readFileSync(new URL('../../product-config.js',import.meta.url),'utf8');
function page(t,{url='https://wuisthequestion.com/',api=true,hosted=false,stored=[],attempt=null,status='pending'}={}){
 const console=new VirtualConsole(),dom=new JSDOM(html,{url,runScripts:'outside-only',virtualConsole:console});
 const w=dom.window;t.after(()=>w.close());const calls=[];
 w.matchMedia=()=>({matches:true});w.AbortSignal=AbortSignal;
 Object.defineProperty(w,'crypto',{value:webcrypto});
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.localStorage.setItem('rrose-cart-v1',JSON.stringify(stored));
 if(attempt)w.sessionStorage.setItem('wu-checkout-attempt',JSON.stringify(attempt));
 w.fetch=async(path,options={})=>{
  calls.push({path,options});
  if(path.endsWith('/quote')){try{return {ok:true,json:async()=>quote(JSON.parse(options.body),{PACKAGE_MAX_ITEMS:'4'})};}catch(e){return {ok:false,json:async()=>({error:e.message})};}}
  if(path.endsWith('/checkout'))return {ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/test',quote:quote(JSON.parse(options.body),{PACKAGE_MAX_ITEMS:'4'})})};
  return {ok:true,json:async()=>({id:attempt?.id,status})};
 };
 w.eval(config);w.RROSE_CONFIG.checkoutMode=hosted?'hosted':'dynamic';if(api&&!hosted)w.RROSE_CONFIG.checkoutApi='https://api.example.test';w.eval(script);
 const get=id=>w.document.getElementById(id);
 const tick=()=>new Promise(r=>setImmediate(r));
 return {w,get,calls,tick};
}
test('existing bag supports two sizes and quantity; PL quote includes shipping once',async t=>{
 const f=page(t);f.get('size').value='S-M';f.get('buy').click();f.get('size').value='M-L';f.get('buy').click();
 assert.equal(f.get('cart-count').textContent,'2');assert.equal(f.get('cart-items').children.length,2);
 f.get('add-delivery').click();await f.tick();assert.match(f.get('cart-grand-total').textContent,/1[\s,.]?427/);
 f.get('checkout').click();await f.tick();
 const call=f.calls.find(x=>x.path.endsWith('/checkout'));const input=JSON.parse(call.options.body);
 assert.deepEqual(input,{country:'PL',items:[{size:'S-M',quantity:1},{size:'M-L',quantity:1}]});
 assert.ok(call.options.headers.Authorization.startsWith('Bearer '));assert.ok(call.options.headers['Idempotency-Key']);
});
test('country change invalidates quote; DE uses EUR; unapproved country never reaches payment',async t=>{
 const f=page(t);f.get('buy').click();f.get('add-delivery').click();await f.tick();
 f.get('shipping-country').value='DE';f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
 assert.equal(f.get('cart-grand-total').textContent,'calculate delivery');f.get('add-delivery').click();await f.tick();
 assert.match(f.get('cart-grand-total').textContent,/179/);assert.equal(f.get('currency').value,'EUR');
 f.get('shipping-country').value='FR';f.get('shipping-country').dispatchEvent(new f.w.Event('change'));f.get('add-delivery').click();await f.tick();
 assert.match(f.get('delivery-status').textContent,/not available/);assert.equal(f.calls.filter(c=>c.path.endsWith('/checkout')).length,0);
});
test('missing backend disables checkout and keeps cart',t=>{
 const f=page(t,{api:false});f.get('buy').click();assert.equal(f.get('checkout').disabled,true);assert.equal(f.get('cart-count').textContent,'1');assert.equal(f.calls.length,0);
});
test('forged paid query never clears cart or displays payment confirmation',t=>{
 const f=page(t,{url:'https://wuisthequestion.com/?paid=true',stored:[{size:'S-M',quantity:1}]});
 assert.equal(f.get('cart-count').textContent,'1');assert.equal(f.get('order-thanks').open,false);assert.equal(f.calls.length,0);
});
test('cancelled checkout preserves cart and does not claim payment',t=>{
 const f=page(t,{url:'https://wuisthequestion.com/?checkout=cancelled',stored:[{size:'M-L',quantity:2}]});
 assert.equal(f.get('cart-count').textContent,'2');assert.match(f.get('checkout-note').textContent,/cancelled/);
});
test('success return without token never claims paid; pending keeps cart',async t=>{
 const f=page(t,{url:'https://wuisthequestion.com/?checkout=returned',stored:[{size:'S-M',quantity:1}]});
 await f.tick();assert.match(f.get('order-confirmation-status').textContent,/cannot be verified/);assert.equal(f.get('cart-count').textContent,'1');
});
test('verified status is required before clearing the matching cart',async t=>{
 const stored=[{size:'S-M',quantity:1}],attempt={id:'test-order',token:'private-token',snapshot:JSON.stringify({country:'PL',items:stored})};
 for(const status of ['pending','paid']){
  const f=page(t,{url:'https://wuisthequestion.com/?checkout=returned',stored,attempt,status});await f.tick();
  assert.equal(f.get('cart-count').textContent,status==='paid'?'0':'1');assert.ok(f.calls[0].options.headers.Authorization.includes('private-token'));
 }
});

test('hosted storefront uses the verified PL Live link with one delivery and no backend',async t=>{
 const f=page(t,{hosted:true,api:false});f.get('size').value='S-M';f.get('buy').click();
 assert.equal(f.get('buy').disabled,false);assert.equal(f.get('cart-items').querySelector('.plus').disabled,false);
 f.get('add-delivery').click();await f.tick();assert.match(f.get('cart-grand-total').textContent,/728/);
 const url=new URL(f.w.hostedCheckoutUrl());assert.equal(url.origin+url.pathname,'https://buy.stripe.com/dRm6oHfN5bXi1pXeJp67S00');
 assert.equal(url.searchParams.get('client_reference_id'),'rrose_sm_pl');assert.equal(url.searchParams.has('amount'),false);assert.equal(f.calls.length,0);
});
test('hosted storefront switches to verified DE link and refuses unapproved countries',async t=>{
 const f=page(t,{hosted:true,api:false});f.get('buy').click();
 f.get('shipping-country').value='DE';f.get('shipping-country').dispatchEvent(new f.w.Event('change'));f.get('add-delivery').click();await f.tick();
 assert.match(f.get('cart-grand-total').textContent,/179/);assert.equal(new URL(f.w.hostedCheckoutUrl()).pathname,'/6oU4gz6cvf9u8Sp9p567S01');
 f.get('shipping-country').value='UA';f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
 assert.equal(f.get('checkout').disabled,true);assert.equal(f.get('add-delivery').disabled,true);assert.equal(f.w.hostedCheckoutUrl(),null);
});
test('hosted checkout blocks saved bags over two items without discarding contents',t=>{
 const f=page(t,{hosted:true,api:false,stored:[{size:'S-M',quantity:3}]});
 assert.equal(f.get('cart-count').textContent,'3');assert.equal(f.get('checkout').disabled,true);assert.match(f.get('checkout-note').textContent,/reduce/);
 f.get('cart-items').querySelector('.minus').click();assert.equal(f.get('cart-count').textContent,'2');assert.equal(f.get('checkout').disabled,false);
});

// Each country is checked against the same zone used by the existing Stripe links.
test('hosted regions preserve exact totals, country lists and import disclosure',async t=>{
 const f=page(t,{hosted:true,api:false});f.get('buy').click();
 const zones=[
  ['AT BE BG HR CY CZ DK EE FI FR GR HU IE IT LV LT LU MT NL PT RO SK SI ES SE',209,'/7sY28rfN5d1m9WtfNt67S02',false],
  ['GB NO CH',259,'/aFa7sL7gzd1m3y51WD67S03',true],
  ['AL AD BA GI GG GL IM IS JE LI MC MD ME MK RS SM TR VA XK',529,'/dRmbJ1eJ12mI7OlgRx67S04',true]
 ];
 for(const [countries,total,path,importFees] of zones)for(const country of countries.split(' ')){
  f.get('shipping-country').value=country;f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
  assert.equal(f.w.hostedCheckoutUrl(),null);assert.equal(f.get('add-delivery').disabled,false,country);
  f.get('add-delivery').click();await f.tick();
  assert.equal(f.get('cart-grand-total').textContent,new Intl.NumberFormat(f.w.navigator.language,{style:'currency',currency:'eur'}).format(total),country);
  assert.equal(new URL(f.w.hostedCheckoutUrl()).pathname,path,country);
  assert.equal(f.get('shipping-route').textContent.includes('import duties'),importFees,country);
  assert.equal(f.get('currency').value,'EUR');
 }
 assert.equal(f.calls.length,0);
});
test('hosted unavailable routes cannot acquire a quote or payment link',t=>{
 const f=page(t,{hosted:true,api:false});f.get('buy').click();
 for(const country of ['UA']){
  f.get('shipping-country').value=country;f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
  f.get('add-delivery').click();assert.equal(f.get('checkout').disabled,true,country);
  assert.equal(f.w.hostedCheckoutUrl(),null);assert.equal(f.get('cart-grand-total').textContent,'calculate delivery');
 }
});

test('two-skirt checkout carries each exact size combination and charges delivery once in all zones',async t=>{
 const recorded=JSON.parse(readFileSync(new URL('../hosted-links.json',import.meta.url),'utf8')).links;
 for(const sizes of [['S-M','S-M'],['S-M','M-L'],['M-L','M-L']]){
  const f=page(t,{hosted:true,api:false});
  for(const size of sizes){f.get('size').value=size;f.get('buy').click();}
  assert.equal(f.get('cart-count').textContent,'2');assert.equal(f.get('buy').disabled,true);
  for(const button of f.get('cart-items').querySelectorAll('.plus'))assert.equal(button.disabled,true);
  f.get('buy').click();assert.equal(f.get('cart-count').textContent,'2');
  for(const [country,zone,total] of [['PL','PL',1427],['DE','DE',339],['FR','EU',369],['GB','NEAR',419],['AL','EUROPE_EXT',689],['US','WORLD',380]]){
   f.get('shipping-country').value=country;f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
   f.get('add-delivery').click();await f.tick();
   const sm=sizes.filter(s=>s==='S-M').length,ml=2-sm;
   const live=recorded.find(l=>l.zone===zone&&l.quantity===2&&l.sizes.sm===sm&&l.sizes.ml===ml);
   assert.ok(live);assert.equal(live.total,total*100);
   const url=new URL(f.w.hostedCheckoutUrl());assert.equal(url.origin+url.pathname,live.url);
   assert.equal(url.searchParams.get('client_reference_id'),'rrose_sm'+sm+'ml'+ml+'_'+country.toLowerCase());
   assert.equal(url.searchParams.has('amount'),false);assert.equal(url.searchParams.has('quantity'),false);
   const cur=country==='PL'?'PLN':'EUR';
   assert.equal(f.get('cart-grand-total').textContent,new Intl.NumberFormat(f.w.navigator.language,{style:'currency',currency:cur}).format(total));
   assert.equal(live.items[0].quantity,2);assert.equal(live.items[1].quantity,1);
   assert.equal(live.custom_fields[0].dropdown.options.length,1);
   assert.equal(live.custom_fields[0].dropdown.options[0].value,'sm'+sm+'ml'+ml);
  }
  assert.equal(f.calls.length,0);
 }
});
test('all enabled Worldwide countries use the approved 60 EUR order rate and exact Stripe allowlist',async t=>{
 const f=page(t,{hosted:true,api:false});f.get('buy').click();
 const world=f.w.RROSE_CONFIG.shipping.zones.WORLD;
 const recorded=JSON.parse(readFileSync(new URL('../hosted-links.json',import.meta.url),'utf8')).links;
 for(const l of recorded.filter(l=>l.zone==='WORLD'))assert.deepEqual([...world].sort(),l.countries.toSorted());
 for(const country of world){
  f.get('shipping-country').value=country;f.get('shipping-country').dispatchEvent(new f.w.Event('change'));
  f.get('add-delivery').click();await f.tick();
  assert.equal(new URL(f.w.hostedCheckoutUrl()).origin+new URL(f.w.hostedCheckoutUrl()).pathname,f.w.RROSE_CONFIG.checkoutLinks.WORLD,country);
  assert.equal(f.get('cart-grand-total').textContent,new Intl.NumberFormat(f.w.navigator.language,{style:'currency',currency:'EUR'}).format(220),country);
 }
});
test('restricted destinations and fabricated zone names stay blocked even when injected into selector',t=>{
 const f=page(t,{hosted:true,api:false});f.get('buy').click();
 for(const country of ['CU','IR','KP','SY','RU','BY','UA','SO','AQ','ZZ','WORLD','EU']){
  f.get('shipping-country').add(new f.w.Option(country,country));f.get('shipping-country').value=country;
  f.get('shipping-country').dispatchEvent(new f.w.Event('change'));f.get('add-delivery').click();
  assert.equal(f.get('checkout').disabled,true,country);assert.equal(f.w.hostedCheckoutUrl(),null,country);
 }
});
