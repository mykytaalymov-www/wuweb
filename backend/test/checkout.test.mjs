import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Stripe from 'stripe';
import { quote, shippingZones, PRICES } from '../catalog.mjs';
import { Store } from '../store.mjs';
import { Checkout, readiness } from '../checkout.mjs';
import { makeServer } from '../server.mjs';
import { drainMail } from '../mail.mjs';

const input=(country='PL',quantity=1)=>({country,items:[{size:'S-M',quantity}]});
function setup(t, overrides={}) {
 const store=new Store(':memory:');t.after(()=>store.close());
 const env={STRIPE_MODE:'test',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',
  STRIPE_TEST_PRODUCT:'prod_test',STRIPE_TEST_PRICE_PLN:'price_pl_test',STRIPE_TEST_PRICE_EUR:'price_eur_test',
  CHECKOUT_ENABLED:'true',SMTP_HOST:'localhost',SMTP_USER:'test',SMTP_PASSWORD:'test',MAIL_FROM:'shop@example.test',
  MERCHANT_EMAIL:'merchant@example.test',STOREFRONT_ORIGIN:'https://wuisthequestion.com',PACKAGE_MAX_ITEMS:'4',POLICY_TEXT:'Test terms',...overrides};
 const sdk=new Stripe('rk_test_fixture'); const calls=[];const sessions=new Map();
 const stripe={prices:{retrieve:async id=>({id,active:true,livemode:false,currency:id===env.STRIPE_TEST_PRICE_PLN?'pln':'eur',
  unit_amount:id===env.STRIPE_TEST_PRICE_PLN?69900:16000,tax_behavior:'inclusive',type:'one_time',product:{id:'prod_test',active:true}})},
  checkout:{sessions:{create:async(params,options)=>{
   calls.push({params,options}); const s={id:'cs_test_'+calls.length,url:'https://checkout.stripe.com/c/pay/cs_test_'+calls.length,
    livemode:false,metadata:params.metadata,client_reference_id:params.client_reference_id,currency:params.shipping_options[0].shipping_rate_data.fixed_amount.currency,
    status:'open',payment_status:'unpaid'};
   const q=quote(JSON.parse(store.get(params.client_reference_id).quote) && {country:params.metadata.country,items:JSON.parse(params.metadata.items)},env);
   Object.assign(s,{amount_total:q.total,amount_subtotal:q.subtotal,total_details:{amount_shipping:q.shipping,amount_discount:0,amount_tax:0}});
   sessions.set(s.id,s);return s;
  },retrieve:async id=>sessions.get(id)}},webhooks:sdk.webhooks};
 const checkout=new Checkout({stripe,store,env});
 const id=randomUUID(),token=randomBytes(32).toString('base64url');
 async function event(type='checkout.session.completed',fields={},eid='evt_'+randomUUID(),signatureOverride){
  const session=sessions.values().next().value;
  Object.assign(session,fields);
  const payload=JSON.stringify({id:eid,type,livemode:false,data:{object:session}});
  const signature=signatureOverride||sdk.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
  return checkout.event(Buffer.from(payload),signature);
 }
 function paid(){return {payment_status:'paid',status:'complete',customer_details:{email:'buyer@example.test',phone:'+48123456789'},
  collected_information:{shipping_details:{name:'Test Buyer',address:{country:'PL'}}}};}
 return {store,env,sdk,stripe,checkout,id,token,calls,sessions,event,paid};
}

test('PL and DE final prices include one shipping charge; mixed sizes',()=>{
 assert.equal(quote(input()).total,72800);assert.equal(quote(input('DE')).total,17900);
 const q=quote({country:'DE',items:[{size:'M-L',quantity:2},{size:'S-M',quantity:1}]},{PACKAGE_MAX_ITEMS:'3'});
 assert.equal(q.total,49900);assert.equal(q.shipping,1900);assert.equal(q.quantity,3);assert.equal(q.parcel.estimatedChargeableWeightKg,3);
});
test('unsupported countries and unconfirmed packing fail closed',()=>{
 for(const c of ['FR','GB','US','ZZ'])assert.throws(()=>quote(input(c)),/shipping_unavailable/);
 assert.throws(()=>quote(input('PL',2)),/packing_confirmation_required/);
});
test('amount/currency/price injection and invalid sizes/quantities rejected',()=>{
 for(const patch of [{amount:1},{currency:'usd'},{shipping:0},{price:'price_bad'},{success_url:'https://evil.test'}])assert.throws(()=>quote({...input(),...patch}),/invalid_order/);
 for(const quantity of [0,-1,1.1,'1',21,NaN])assert.throws(()=>quote(input('PL',quantity)),/invalid_items/);
 assert.throws(()=>quote({country:'PL',items:[{size:'XS',quantity:1}]}),/invalid_items/);
 assert.throws(()=>quote({country:'PL',items:[{size:'S-M',quantity:1,price:1}]}),/invalid_items/);
 assert.throws(()=>quote(input('pl')),/invalid_country/);
});
test('shipping zones require evidence, expiry, country uniqueness and customs approval',()=>{
 const z={id:'FR',countries:['FR'],currency:'eur',amount:2500,source:'official quote #test',approvedAt:'2026-11-11',validUntil:'2099-01-01',customsReviewed:true,maxItems:2};
 const env={SHIPPING_ZONES_JSON:JSON.stringify([z])};assert.equal(quote(input('FR'),env).shipping,2500);
 for(const patch of [{source:''},{validUntil:'2000-01-01'},{customsReviewed:false},{countries:['PL']},{amount:1.5}])assert.throws(()=>shippingZones({SHIPPING_ZONES_JSON:JSON.stringify([{...z,...patch}])}));
});
test('Checkout uses server price, mixed-size metadata, one shipping option and no extra VAT',async t=>{
 const f=setup(t);await f.checkout.create({country:'PL',items:[{size:'S-M',quantity:1},{size:'M-L',quantity:2}]},f.id,f.token);
 const {params}=f.calls[0];assert.deepEqual(params.line_items,[{price:'price_pl_test',quantity:3}]);
 assert.equal(params.shipping_options.length,1);assert.equal(params.shipping_options[0].shipping_rate_data.fixed_amount.amount,2900);
 assert.equal(params.automatic_tax.enabled,false);assert.equal(params.adaptive_pricing.enabled,false);
 assert.deepEqual(params.shipping_address_collection.allowed_countries,['PL']);assert.equal(params.phone_number_collection.enabled,true);
 assert.match(params.custom_text.submit.message,/M-L × 2/);assert.equal(params.payment_method_types,undefined);
 assert.ok(!params.success_url.includes(f.token));assert.equal(f.checkout.status(f.id,f.token).status,'pending');
});
test('Checkout retries reuse session, token auth and request fingerprint are enforced',async t=>{
 const f=setup(t);const first=await f.checkout.create(input(),f.id,f.token);assert.deepEqual(await f.checkout.create(input(),f.id,f.token),first);assert.equal(f.calls.length,1);
 await assert.rejects(()=>f.checkout.create(input('DE'),f.id,f.token),/request_key_reused/);
 await assert.rejects(()=>f.checkout.create(input(),f.id,'X'.repeat(43)),/order_not_found/);
 assert.throws(()=>f.checkout.status(f.id,'bad'),/order_not_found/);
 f.store.db.prepare('UPDATE orders SET created=? WHERE id=?').run(Date.now()-24*3600000,f.id);
 await assert.rejects(()=>f.checkout.create(input(),f.id,f.token),/checkout_expired/);
});
test('catalog mismatch and wrong environment never create payable sessions',async t=>{
 const f=setup(t);f.stripe.prices.retrieve=async()=>({active:true,livemode:true,currency:'pln',unit_amount:1});
 await assert.rejects(()=>f.checkout.create(input(),f.id,f.token),/catalog_mismatch/);assert.equal(f.calls.length,0);
 assert.equal(readiness({...f.env,STRIPE_SECRET_KEY:'rk_live_fixture'}),false);
 assert.equal(readiness({...f.env,STRIPE_MODE:'live',STRIPE_SECRET_KEY:'rk_live_fixture'}),false);
 assert.equal(readiness({...f.env,SMTP_PASSWORD:''}),false);
});
test('real Stripe signature verification rejects forged, tampered and stale webhooks',async t=>{
 const f=setup(t);await f.checkout.create(input(),f.id,f.token);
 await assert.rejects(()=>f.event('checkout.session.completed',{},undefined,'t=1,v1=bad'),/invalid_signature/);
 const payload=JSON.stringify({type:'checkout.session.completed'});
 const sig=f.sdk.webhooks.generateTestHeaderString({payload,secret:f.env.STRIPE_WEBHOOK_SECRET});
 await assert.rejects(()=>f.checkout.event(Buffer.from(payload+' '),sig),/invalid_signature/);
 const stale=f.sdk.webhooks.generateTestHeaderString({payload,secret:f.env.STRIPE_WEBHOOK_SECRET,timestamp:1});
 await assert.rejects(()=>f.checkout.event(Buffer.from(payload),stale),/invalid_signature/);
 assert.equal(f.store.get(f.id).status,'pending');
});
test('signed paid webhook persists exactly one transition/outbox; late expiry cannot undo paid',async t=>{
 const f=setup(t);await f.checkout.create(input(),f.id,f.token);
 await f.event('checkout.session.completed',f.paid(),'evt_same');await f.event('checkout.session.completed',f.paid(),'evt_same');
 await f.event('checkout.session.async_payment_succeeded',f.paid());
 await f.event('checkout.session.expired',{payment_status:'unpaid',status:'expired'});
 assert.equal(f.store.get(f.id).status,'paid');assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,1);
 await assert.rejects(()=>f.checkout.create(input(),f.id,f.token),/order_already_processed/);
});
test('delayed payment remains pending, failure and later success handled',async t=>{
 const f=setup(t);await f.checkout.create(input(),f.id,f.token);
 await f.event();assert.equal(f.store.get(f.id).status,'pending');
 assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM outbox').get().n,0);
 await f.event('checkout.session.async_payment_failed');assert.equal(f.store.get(f.id).status,'failed');
 await f.event('checkout.session.async_payment_succeeded',f.paid());assert.equal(f.store.get(f.id).status,'paid');
});
test('signed amount, country, currency, shipping and session substitutions do not mark paid',async t=>{
 for(const fields of [{amount_total:1},{currency:'eur'},{total_details:{amount_shipping:0}},
  {collected_information:{shipping_details:{address:{country:'DE'}}}},{client_reference_id:'other'}]){
  const f=setup(t);await f.checkout.create(input(),f.id,f.token);
  await assert.rejects(()=>f.event('checkout.session.completed',{...f.paid(),...fields}),/mismatch/);
  assert.equal(f.store.get(f.id).status,'pending');
 }
});
test('email sends after paid, retries failures, does not duplicate on webhook retry',async t=>{
 const f=setup(t);await f.checkout.create(input(),f.id,f.token);await f.event('checkout.session.completed',f.paid());
 let sends=0;const transport={sendMail:async mail=>{sends++;assert.match(mail.text,/728.00 PLN/);assert.equal(mail.attachments.length,1);if(sends===1)throw new Error('smtp down');}};
 await drainMail(f.store,transport,f.env);assert.equal(f.store.get(f.id).status,'paid');assert.equal(f.store.db.prepare('SELECT attempts FROM outbox').get().attempts,1);
 f.store.db.prepare('UPDATE outbox SET next_attempt=0').run();await drainMail(f.store,transport,f.env);await drainMail(f.store,transport,f.env);assert.equal(sends,2);
});
test('orders survive database reopening',t=>{
 const dir=mkdtempSync(join(tmpdir(),'wu-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'orders.sqlite');
 let s=new Store(file);s.create({id:'order',tokenHash:'hash',fingerprint:'fp',quote:{total:72800},created:1});s.close();s=new Store(file);
 assert.equal(JSON.parse(s.get('order').quote).total,72800);s.close();
});
test('HTTP origin, JSON limits, totals and order auth',async t=>{
 const f=setup(t),server=makeServer({env:f.env,checkout:f.checkout});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port,headers={Origin:f.env.STOREFRONT_ORIGIN,'Content-Type':'application/json'};
 assert.equal((await fetch(base+'/health')).status,403);
 assert.equal((await fetch(base+'/quote',{method:'POST',headers,body:JSON.stringify(input())})).status,200);
 assert.equal((await fetch(base+'/quote',{method:'POST',headers,body:'{'})).status,400);
 assert.equal((await fetch(base+'/quote',{method:'POST',headers,body:' '.repeat(5000)})).status,413);
 assert.equal((await fetch(base+'/checkout',{method:'POST',headers,body:JSON.stringify(input())})).status,400);
 const result=await fetch(base+'/checkout',{method:'POST',headers:{...headers,Authorization:'Bearer '+f.token,'Idempotency-Key':f.id},body:JSON.stringify(input())});assert.equal(result.status,200);
 const response=await fetch(base+'/orders/'+f.id,{headers:{...headers,Authorization:'Bearer '+f.token}});const data=await response.json();assert.equal(data.status,'pending');assert.equal(data.customer,undefined);
 assert.equal((await fetch(base+'/orders/'+f.id,{headers})).status,404);
 assert.equal((await fetch(base+'/webhook',{method:'POST',body:'{}'})).status,400);
});
