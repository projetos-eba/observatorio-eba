import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {readdirSync,readFileSync} from "node:fs";
import {realpathSync} from "node:fs";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {Miniflare} from "miniflare";

export async function checkIntegrations(inspect=async()=>{}){
 const day=new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const ig="17841400004250000",ad="900045",waba="800456",number="700444",token="Token_Fixture_12345",secret=randomBytes(32).toString("hex");
 let mode="healthy",held,release;
 let mediaCalls=0;
 const mf=new Miniflare({
  host:"127.0.0.1",port:0,modulesRoot:realpathSync("dist/server"),
  modules:["index.js",...readdirSync("dist/server",{recursive:true}).filter(f=>f.endsWith(".js")&&f!=="index.js")].map(file=>({type:"ESModule",path:join(realpathSync("dist/server"),file)})),
  compatibilityDate:"2026-01-01",compatibilityFlags:["nodejs_compat"],
  bindings:{EBA_INTEGRATION_KEY:randomBytes(32).toString("hex"),EBA_INTEGRATION_SCHEDULER:secret},
  d1Databases:{DB:"integration-test"},r2Buckets:{BUCKET:"integration-test"},
  assets:{directory:realpathSync("dist/client"),binding:"ASSETS",routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
  outboundService:async req=>{
   assert.equal(req.method,"GET");assert.equal(req.headers.get("Authorization"),"Bearer "+token);
   const url=new URL(req.url),path=url.pathname.replace(/^\/v27\.0\//,""),after=url.searchParams.get("after");
   assert(["graph.instagram.com","graph.facebook.com"].includes(url.hostname));
   const media=[{id:"180045001",timestamp:day+"T15:00:00Z",caption:"Conteúdo de teste",media_type:"IMAGE",permalink:"https://www.instagram.com/p/teste/",like_count:12,comments_count:3},{id:"180045002",timestamp:day+"T16:00:00Z",caption:"Segunda publicação",media_type:"VIDEO"}];
   const adMeta={id:"act_"+ad,name:"Conta de demonstração",currency:"BRL",timezone_name:"America/Sao_Paulo"};
   if(path==="me")return Response.json(mode==="expired"?{error:{code:190,message:"token "+token}}:{user_id:ig,username:"eba_piloto"});
   if(path===ig+"/media"){
    if(url.searchParams.get("fields")==="id")return Response.json({data:[]});
    mediaCalls++;
    if(mode==="hold"&&!after){held?.();await new Promise(r=>{release=r})}
    if(mode==="limit")return Response.json({error:{code:4}},{status:429,headers:{"Retry-After":"1200"}});
    if(after&&mode==="partial")return Response.json({error:{is_transient:true,message:token}},{status:502});
    return Response.json(after?{data:[media[1]]}:{data:[media[0]],paging:{next:"https://graph.instagram.com/unused?access_token="+token,cursors:{after:"page2"}}});
   }
   if(path==="me/adaccounts")return Response.json({data:[adMeta]});
   if(path==="act_"+ad)return Response.json(adMeta);
   if(path==="act_"+ad+"/insights"){
    if(!url.searchParams.has("time_range"))return Response.json({data:[]});
    const {until}=JSON.parse(url.searchParams.get("time_range"));
    return Response.json({data:[{campaign_id:"701",campaign_name:"Campanha QA",date_start:until,spend:"18.90",impressions:"79",clicks:"5"}]});
   }
   if(path===waba+"/phone_numbers")return Response.json({data:[{id:number,display_phone_number:"+55 11 99999-9999",verified_name:"EBA QA"}]});
   return Response.json({error:{code:100}},{status:400});
  },
 });
 const actor={"oai-authenticated-user-id":"integracao-piloto","oai-authenticated-user-email":"integracao@example.test"};
 const origin="http://127.0.0.1";
 const root="/api/integracoes";
 const get=(query="")=>mf.dispatchFetch(origin+root+query,{headers:actor});
 const post=(data,path=root)=>mf.dispatchFetch(origin+path,{method:"POST",headers:{...actor,Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(data)});
 async function verify(response,status=200){
  assert.equal(response.status,status,await response.clone().text());
  const body=await response.json();assert(!JSON.stringify(body).includes(token));return body;
 }
 const state=async(query="")=>verify(await get(query));
 const scheduled=()=>mf.dispatchFetch(origin+root+"/sync",{method:"POST",headers:{Authorization:"Bearer "+secret}});
 try{
  const db=await mf.getD1Database("DB");
  for(const name of readdirSync("drizzle").filter(n=>n.endsWith(".sql")).sort())
   for(const sql of readFileSync("drizzle/"+name,"utf8").split("--> statement-breakpoint"))
    if(sql.trim())await db.prepare(sql.trim()).run();
  assert.equal((await mf.dispatchFetch(origin+root)).status,401);
  assert.equal((await mf.dispatchFetch(origin+root+"/sync",{method:"POST"})).status,403);
  for(const [provider,parent,id] of [["instagram","",ig],["meta_ads","",ad],["whatsapp",waba,number]]){
   const common={provider,parent,token,secret:""};
   assert.equal((await verify(await post({action:"test",...common}))).items[0].id,id);
   await verify(await post({action:"connect",...common,id}));
  }
  const row=await db.prepare("SELECT credential FROM integration_connections WHERE provider='instagram'").first();
  assert(!row.credential.includes(token));
  await verify(await scheduled());
  assert.equal((await state()).posts.length,2);
  assert.equal((await state("?app=meta_ads")).campaigns[0].spend,18.9);
  assert.equal((await state("?app=whatsapp")).selected.phone,"5511999999999");
  const calls=mediaCalls;
  await verify(await scheduled());assert.equal(mediaCalls,calls);
  mode="partial";await verify(await post({action:"sync",provider:"instagram"}));assert.equal((await state()).posts.length,2);
  mode="healthy";await db.prepare("UPDATE integration_connections SET successDay='',retryAt='' WHERE provider='instagram'").run();await verify(await scheduled());
  assert.equal((await state()).posts.length,2);
  mode="limit";assert.equal((await verify(await post({action:"sync",provider:"instagram"}))).status,"limited");
  assert.equal((await verify(await post({action:"sync",provider:"instagram"}))).status,"limited");
  await db.prepare("UPDATE integration_connections SET retryAt='',successDay='' WHERE provider='instagram'").run();
  mode="hold";
  const waiting=new Promise(resolve=>{held=resolve});
  const first=post({action:"sync",provider:"instagram"});
  await waiting;await verify(await scheduled());assert((await state()).connected.find(c=>c.provider==="instagram").busy);
  assert.equal((await verify(await post({action:"sync",provider:"instagram"}))).status,"busy");
  release();await verify(await first);mode="healthy";
  assert.equal((await state()).posts.length,2);
  mode="expired";const expired=await verify(await post({action:"verify",provider:"instagram"}));assert.equal(expired.status,"attention");
  assert.match(expired.message,/expirada/);assert.equal((await state()).posts.length,2);
  mode="healthy";await verify(await post({action:"verify",provider:"instagram"}));
  const hub=async change=>{
   const raw=await mf.dispatchFetch(origin+"/api/conteudo",{headers:actor});
   const {version}=await raw.json(),id=crypto.randomUUID();
   await verify(await post({brand:"eba",id,version,change},"/api/conteudo"));return id;
  };
  const piece=await hub({kind:"edition",edition:{id:"",title:"Peça de teste",brief:"Convidar a agendar.",channel:"Instagram",format:"Post",goal:"Agendamento",stage:"Converter",owner:actor["oai-authenticated-user-id"],due:day,decision:"",radar:"",assets:[],reuse:"",plan:"Acompanhar pelo código de referência."}});
  for(const action of ["Produzir","Enviar para revisão","Aprovar"])await hub({kind:"workflow",piece,action,proof:"Aprovação interna",note:""});
  const publication=await hub({kind:"prepare",piece,destination:"WhatsApp",target:"5511999999999",message:"Olá"});
  await hub({kind:"publish",publication,date:day,reference:"https://www.instagram.com/p/teste/"});
  await verify(await post({action:"link",resource:ig,media:"180045001",publication}));
  assert.equal((await state("?publicacao="+publication)).entry.post.likes,12);
  const pub=(await state("?app=whatsapp")).publications[0];
  assert(new URL(pub.link).searchParams.get("text").includes(pub.code));
  await hub({kind:"results",correct:"",rows:[{goal:"Agendamento",externalId:"evento-qa",date:day,source:"Agenda EBA",code:pub.code,value:null}]});
  await verify(await post({action:"disconnect",provider:"meta_ads"}));
  assert.equal((await db.prepare("SELECT credential FROM integration_connections WHERE provider='meta_ads'").first()).credential,null);
  assert.equal((await state("?app=meta_ads")).campaigns.length,1);
  await inspect((await mf.ready).origin,actor,publication);
  console.log("Integrações validadas: descoberta, atualização, paginação, erro parcial, retomada, credenciais, vínculo com o Hub e desconexão.");
 }finally{release?.();await mf.dispose()}
}
if(import.meta.url===pathToFileURL(process.argv[1]||"").href)await checkIntegrations();
