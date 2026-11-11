import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { randomBytes, randomUUID } from 'node:crypto';
import { Store } from '../store.mjs';
import { createEdgeHandler } from '../supabase/handler.mjs';
import { SupabaseStore } from '../supabase/store.mjs';

function fixture(t) {
 const store=new Store(':memory:');t.after(()=>store.close());
 store.health=async()=>true;store.rateLimit=async()=>true;
 store.mailPending=async id=>!!store.db.prepare('SELECT id FROM outbox WHERE order_id=? AND sent IS NULL').get(id);
 const env={STRIPE_MODE:'live',STRIPE_SECRET_KEY:'rk_test_fixture',STRIPE_WEBHOOK_SECRET:'whsec_fixture',
  STRIPE_TEST_PRODUCT:'prod_test',STRIPE_TEST_PRICE_PLN:'price_test',STRIPE_TEST_PRICE_EUR:'price_eur_test',
  SMTP_HOST:'smtp.example',SMTP_PASSWORD:'test',SMTP_USER:'test',MAIL_FROM:'shop@example.test',MERCHANT_EMAIL:'merchant@example.test',
  CHECKOUT_ENABLED:'true',POLICY_TEXT:'Test terms'};
 const sdk=new Stripe('rk_test_fixture'),id=randomUUID(),token=randomBytes(32).toString('base64url');let session;
 const stripe={prices:{retrieve:async()=>({active:true,livemode:false,currency:'pln',unit_amount:69900,tax_behavior:'inclusive',type:'one_time',product:{id:'prod_test',active:true}})},
  checkout:{sessions:{create:async p=>(session={id:'cs_test',url:'https://checkout.stripe.com/c/pay/test',livemode:false,metadata:p.metadata,client_reference_id:p.client_reference_id,
   currency:'pln',amount_subtotal:69900,amount_total:72800,total_details:{amount_shipping:2900,amount_discount:0,amount_tax:0},status:'open',payment_status:'unpaid'}),retrieve:async()=>session}},webhooks:sdk.webhooks};
 let sendFailure=false,sends=0;
 const handler=createEdgeHandler({env,stripe,store,transport:{sendMail:async()=>{sends++;if(sendFailure)throw Error('offline');}}});
 const call=(path,method='GET',data,headers={})=>handler(new Request('https://project.supabase.co'+path,{method,headers:{Origin:'https://wuisthequestion.com','Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)}));
 const order={country:'PL',items:[{size:'S-M',quantity:1}]};
 async function create(){return call('/wu-checkout-staging/checkout','POST',order,{Authorization:'Bearer '+token,'Idempotency-Key':id});}
 async function paid(){
  Object.assign(session,{status:'complete',payment_status:'paid',customer_details:{email:'buyer@example.test',phone:'+48123456789'},collected_information:{shipping_details:{address:{country:'PL'}}}});
  const payload=JSON.stringify({id:'evt_repeat',type:'checkout.session.completed',livemode:false,data:{object:session}});
  return handler(new Request('https://project.supabase.co/wu-checkout-staging/webhook',{method:'POST',headers:{'stripe-signature':sdk.webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET})},body:payload}));
 }
 return {store,env,handler,call,create,paid,id,token,setFailure:v=>sendFailure=v,sends:()=>sends};
}
test('Supabase full and gateway-stripped paths route correctly',async t=>{
 const f=fixture(t);
 for(const prefix of ['/functions/v1/wu-checkout-staging','/wu-checkout-staging']){
  const health=await f.call(prefix+'/health');assert.equal(health.status,200);assert.equal((await health.json()).mode,'test');
  const q=await f.call(prefix+'/quote','POST',{country:'DE',items:[{size:'M-L',quantity:1}]});assert.equal((await q.json()).total,17900);
 }
});
test('edge denies unsupported countries, oversized requests, forged signatures and wrong origins',async t=>{
 const f=fixture(t),prefix='/wu-checkout-staging';
 assert.equal((await f.call(prefix+'/quote','POST',{country:'US',items:[{size:'S-M',quantity:1}]})).status,422);
 assert.equal((await f.call(prefix+'/quote','POST',{amount:1,country:'PL',items:[{size:'S-M',quantity:1}]})).status,400);
 assert.equal((await f.call(prefix+'/quote','POST',{pad:'x'.repeat(5000)})).status,413);
 assert.equal((await f.call(prefix+'/webhook','POST',{})).status,400);
 assert.equal((await f.call(prefix+'/quote','POST',{}, {Origin:'https://evil.example'})).status,403);
});
test('edge always forces test mode and missing credentials keep checkout disabled',async t=>{
 const f=fixture(t);f.env.STRIPE_SECRET_KEY='rk_live_fixture';const response=await f.create();assert.equal(response.status,503);assert.equal((await response.json()).error,'checkout_unavailable');
});
test('email retry returns 503 to Stripe after persisting paid order, then acknowledges once',async t=>{
 const f=fixture(t);assert.equal((await f.create()).status,200);f.setFailure(true);
 assert.equal((await f.paid()).status,503);assert.equal(f.store.get(f.id).status,'paid');assert.equal(f.sends(),1);
 assert.equal((await f.paid()).status,503);assert.equal(f.sends(),1);
 f.store.db.prepare('UPDATE outbox SET next_attempt=0').run();f.setFailure(false);
 assert.equal((await f.paid()).status,200);assert.equal(f.sends(),2);
 assert.equal((await f.paid()).status,200);assert.equal(f.sends(),2);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM outbox').get().n,1);
});
test('Postgres adapter keeps service key server-side and normalizes stored JSON',async()=>{
 const calls=[],key='server-fixture';
 const store=new SupabaseStore({url:'https://project.supabase.co',key,fetcher:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({id:'id',quote:{total:72800},customer:{email:'test@example.test'}})};}});
 const order=await store.get('id');assert.equal(JSON.parse(order.quote).total,72800);assert.equal(calls[0].init.headers.Authorization,'Bearer '+key);
 assert.ok(!calls[0].url.includes(key));assert.equal(await store.get(undefined),null);
});
