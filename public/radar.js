(() => {
  "use strict";
  const icon = window.ebaIcon;
  const seed = window.EBA_SEED;
  const root = document.querySelector("#app");
  const data = { records: [], tests: [], insights: [], settings: [] };
  const revisions = new Map();
  const sections = {
    overview: ["Visão geral", "grid"], radar: ["Radar de novidades", "radar"], weekly: ["Visão semanal", "calendar"],
    compare: ["Comparativo", "chart"], tests: ["Laboratório de testes", "flask"], insights: ["Banco de insights", "layers"], history: ["Histórico", "history"]
  };
  const stages = ["Posicionar", "Impulsionar", "Converter", "Otimizar"];
  const niches = ["Clínicas e saúde", "Advocacia", "Revendas de veículos"];
  const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const localDate = s => new Date(s.slice(0,10) + "T12:00:00Z");
  const iso = d => d.toISOString().slice(0,10);
  function addDays(s,n){const d=localDate(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
  function monday(s){return addDays(s,-((localDate(s).getUTCDay()+6)%7));}
  function fmt(s,opts={day:"2-digit",month:"short"}) { return s ? new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC",...opts}).format(localDate(s)).replaceAll(".","") : "—"; }
  const pad = n => String(n).padStart(2,"0");
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fold = s => String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const pending = r => ["A avaliar","Em avaliação"].includes(r.status);
  const finished = r => ["Analisado","Arquivado"].includes(r.status);
  const stamp = r => String(r.reviewedAt||r.updatedAt||r.date||"").slice(0,10);
  const between = (s,a,b) => !!s && s.slice(0,10)>=a && s.slice(0,10)<=b;
  const byDate = (a,b) => (b.date||"").localeCompare(a.date||"") || (b.sourceDate||"").localeCompare(a.sourceDate||"") || a.title.localeCompare(b.title,"pt");
  const byQueue = (a,b) => (["Alta","Média","Baixa"].indexOf(a.priority)-["Alta","Média","Baixa"].indexOf(b.priority)) || byDate(a,b);
  const thisWeek = () => monday(today());
  const currentSection = () => Object.hasOwn(sections,location.hash.slice(1)) ? location.hash.slice(1) : "overview";
  const emptyFilters = () => ({theme:"",source:"",stage:"",impact:"",niche:"",period:"",from:"",to:""});
  let section = currentSection(), filters=emptyFilters(), filterOpen=false, filterDraft=null, week=thisWeek(), weekOffset=0;
  let query="",tabState="",connected=false, sidebar=false, feedMode=false, feedState="idle",feedResponse=null,feedId=0;
  let compA=addDays(thisWeek(),-7),compB=thisWeek(),leftRecord="",rightRecord="";
  function hydrate(entries){
    for(const key of Object.keys(data)) data[key] = (seed[key]||[]).map(r=>({...r}));
    revisions.clear();
    for (const row of entries) {
      if(!Object.hasOwn(data,row.collection)) continue;
      const obj={...row.data,id:row.id};
      const list=data[row.collection], at=list.findIndex(x=>x.id===row.id);
      if(at<0) list.push(obj); else list[at]=obj;
      revisions.set(row.collection+"/"+row.id,row.revision);
    }
  }
  async function loadStore() {
    const res=await fetch("/api/store",{cache:"no-store"});
    if(!res.ok) throw Error("Os dados salvos não puderam ser carregados.");
    const body=await res.json();hydrate(body.entries);connected=true;
  }
  async function save(collection,object) {
    if(!connected) throw Error("O banco está indisponível. Recarregue o painel antes de salvar.");
    const key=collection+"/"+object.id, old=data[collection].find(x=>x.id===object.id), now=new Date().toISOString();
    let next={...object};
    if(collection==="records"){
      next.updatedAt=now;
      if(next.status==="Analisado" && old?.status!=="Analisado") next.reviewedAt=today();
      if(old && finished(old) && finished(next)) next.reviewedAt=old.reviewedAt||stamp(old);
      const log=old?.history||[];
      const changed=["title","changed","why","opportunity","risks","priority","decision","status","owner","next","stage","impact","theme","niches","url","source","date","sourceDate","summary"].filter(k=>JSON.stringify(old?.[k]??"")!==JSON.stringify(next[k]??""));
      next.history=changed.length?[...log,{at:now,status:next.status,decision:next.decision||"",owner:next.owner||"",fields:changed}].slice(-50):log;
    }
    const res=await fetch("/api/store",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({collection,id:object.id,data:next,revision:revisions.get(key)||0})});
    const result=await res.json();
    if(!res.ok){
      if(res.status===409){try{await loadStore();render();}catch{connected=false;}}
      throw Error(result.error||"Não foi possível salvar. Tente novamente.");
    }
    revisions.set(key,result.revision);
    const list=data[collection],index=list.findIndex(x=>x.id===next.id);
    if(index<0)list.push(next);else list[index]=next;
    render();
  }
  function toast(msg){const el=document.getElementById("feedback");if(!el)return;el.textContent=msg;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),4000);}
  window.Radar={data,save,icon,toast};
  const linkBtn=(label,view,ic="arrow")=>'<button class="text-link" data-nav="'+view+'">'+esc(label)+icon(ic,15)+'</button>';
  const sel=(v,x)=>v===x?' selected':'';
  const opts=(arr,current,all)=> (all===undefined?"":'<option value="">'+esc(all)+'</option>')+arr.map(x=>'<option value="'+esc(x)+'"'+sel(current,x)+'>'+esc(x)+'</option>').join("");
  const badge=(text,cl)=>'<span class="tag '+cl+'">'+esc(text)+'</span>';
  function mark(source){
    const s=fold(source);
    if(s==="meta"||s.includes("facebook"))return '<span class="source-mark meta" aria-hidden="true"><svg width="29" height="23" viewBox="0 0 36 25" fill="none" stroke="currentColor" stroke-width="3.6"><path d="M18 13c-4-7-6-10-9-10C4 3 1 13 2 18c.5 3 3 5 5 4 5-1 8-14 13-18 7-6 14 6 14 12 1 6-3 8-6 6-3-2-6-9-10-14"/></svg></span>';
    if(s.includes("google ads"))return '<span class="source-mark google" aria-hidden="true"><svg width="28" height="26" viewBox="0 0 32 29"><path d="m13 5 8 1-10 20a6 6 0 0 1-10-6z" fill="#fbbc04"/><path d="m12 9 10 17a5.6 5.6 0 0 0 9-6L21 3a5.3 5.3 0 0 0-9 6z" fill="#4285f4"/><circle cx="6" cy="23" r="5.5" fill="#34a853"/></svg></span>';
    if(s.includes("analytics"))return '<span class="source-mark analytics" aria-hidden="true"><svg width="24" height="25" viewBox="0 0 24 25"><rect x="16" y="1" width="6" height="23" rx="3" fill="#f9ab00"/><rect x="8" y="9" width="6" height="15" rx="3" fill="#e37400"/><circle cx="3" cy="21" r="3" fill="#e37400"/></svg></span>';
    if(s.includes("microsoft"))return '<span class="source-mark ms" aria-hidden="true"><svg width="21" height="21" viewBox="0 0 21 21"><path fill="#f25022" d="M0 0h10v10H0z"/><path fill="#7fba00" d="M11 0h10v10H11z"/><path fill="#00a4ef" d="M0 11h10v10H0z"/><path fill="#ffb900" d="M11 11h10v10H11z"/></svg></span>';
    if(s.includes("tiktok"))return '<span class="source-mark tiktok" aria-hidden="true">♪</span>';
    return '<span class="source-mark other">'+esc((source||"?")[0])+'</span>';
  }
  function logo(){return '<div class="brand"><span class="brand-eba">eba<span>.</span></span><i></i><span class="brand-growth">GROWTH</span></div>';}
  function navGroup(title,ids){return '<div class="navgroup"><h2>'+title+'</h2>'+ids.map(id=>'<a href="#'+id+'" class="nav-item '+(section===id?'active':'')+'"'+(section===id?' aria-current="page"':'')+'>'+icon(sections[id][1],18)+'<span>'+sections[id][0]+'</span>'+(id==="weekly"?'<small>'+data.records.filter(pending).length+'</small>':'')+'</a>').join("")+'</div>';}
  function shell(){
    root.innerHTML='<a class="skip" href="#conteudo">Ir ao conteúdo</a><div class="frame"><button class="scrim" data-action="menu" aria-label="Fechar menu"></button><aside class="side" id="sidenav"><a class="brand-link" href="#overview" aria-label="EBA Growth, visão geral">'+logo()+'</a><nav aria-label="Menu principal">'+navGroup("Workspace",["overview","radar","weekly"])+'<div class="navgroup"><h2>Comercial</h2><a href="/crm" class="nav-item">'+icon("user",18)+'<span>CRM comercial</span></a><a href="/carteira" class="nav-item">'+icon("layers",18)+'<span>Carteira e Método PICO</span></a><a href="/conteudo" class="nav-item">'+icon("book",18)+'<span>Hub de Conteúdo</span></a><a href="/integracoes" class="nav-item">'+icon("link",18)+'<span>Integrações</span></a></div>'+navGroup("Inteligência",["compare","tests","insights","history"])+'</nav><div class="workspace"><span class="work-icon">'+icon("layers",19)+'</span><div><b>EBA Aceleradora</b><small>Workspace privado</small></div>'+icon("lock",13)+'</div></aside><div class="canvas"><header class="topbar"><div class="crumb"><button class="menu-btn icon-btn" data-action="menu" aria-label="Abrir menu" aria-controls="sidenav">'+icon("menu")+'</button><span class="desktop-crumb">'+icon("panel",16)+'</span><span class="crumb-parent">Workspace</span><span class="slash">/</span><b>'+sections[section][0]+'</b></div><div class="top-actions"><span class="today">'+icon("calendar",15)+fmt(today(),{day:"numeric",month:"long",year:"numeric"})+'</span><button class="add-btn" data-action="newRecord">'+icon("plus",15)+'Nova análise</button></div></header><main id="conteudo" class="content" tabindex="-1"></main><footer class="foot"><span>EBA Growth</span><span>Observatório de performance</span></footer></div></div><div id="feedback" class="toast" role="status" aria-live="polite"></div>';
  }
  function periodLabel(start){const end=addDays(start,6); return start.slice(0,7)===end.slice(0,7)?start.slice(-2)+" — "+fmt(end):fmt(start)+" — "+fmt(end);}
  function weekBar(){return '<div class="week-switch"><span class="wk-select">'+icon("calendar",14)+'<select aria-label="Semana de referência" data-control="week">'+[[0,"Esta semana"],[-1,"Semana passada"],[-2,"Há 2 semanas"],[-3,"Há 3 semanas"]].map(([i,s])=>'<option value="'+i+'"'+sel(i,weekOffset)+'>'+s+'</option>').join("")+'</select>'+icon("down",12)+'</span></div>';}
  function signalSpark(list,key,base){
    const values=Array.from({length:7},(_,i)=>list.filter(r=>r[key]&&r[key].slice(0,10)===addDays(base,i)).length);
    const max=Math.max(1,...values);
    return '<span class="microbars" aria-hidden="true">'+values.map(n=>'<i style="height:'+Math.max(3,Math.round(18*n/max))+'px;opacity:'+(n?0.9:.24)+'"></i>').join("")+'</span>';
  }
  function pulse(){
    const end=addDays(week,6), items=data.records.filter(r=>between(r.date,week,end));
    const active=data.tests.filter(r=>r.startDate&&r.startDate<=end&&(!r.endDate||r.endDate>=week)&&r.status!=="Planejado"&&(r.status!=="Concluído"||r.endDate> end));
    const done=data.records.filter(r=>finished(r)&&between(stamp(r),week,end)),goal=data.settings.find(x=>x.id==="weekly-goal")?.value||8;
    const percent=Math.min(100,Math.round(100*done.length/goal));
    const high=items.filter(r=>r.impact==='Alto').length;
    const metric=(ic,label,value,extra,cl="")=>'<div class="metric '+cl+'"><span class="metric-label">'+icon(ic,15)+label+'</span><div class="metric-value">'+pad(value)+extra+'</div></div>';
    return '<section class="pulse-section"><div class="section-head compact"><div class="heading-sub"><h2>Pulso da semana</h2><span class="period">'+periodLabel(week)+'</span></div>'+weekBar()+'</div><div class="metric-grid">'+
      metric("radar","Sinais captados",items.length,signalSpark(items,"date",week),"lead")+
      metric("bolt","Alto impacto",high,'<span class="metric-note">'+(items.length?Math.round(100*high/items.length):0)+'% dos sinais</span>')+
      metric("flask","Testes em curso",active.length,'')+
      '<button class="metric goal" data-action="goal" title="Editar meta de análises"><span class="metric-label">'+icon("target",15)+'Meta de análises'+icon("edit",12)+'</span><div class="goal-data"><span>'+pad(done.length)+'<em> / '+pad(goal)+'</em></span><span class="goal-percent">'+percent+'%</span></div><span class="progress"><i style="width:'+percent+'%"></i></span></button></div></section>';
  }
  function hero(){return '<section class="hero"><div class="hero-art"></div><div class="hero-copy"><div class="hero-kicker"><span class="signal-dot"></span>Observatório EBA Growth</div><h1>Radar de<br>performance<span>.</span></h1><p>As mudanças em mídia e conversão que merecem sua próxima decisão.</p><button class="hero-action" data-nav="radar">Explorar radar '+icon("arrow",16)+'</button></div></section>';}
  function signalRow(r){
    return '<button class="signal-row" data-record="'+esc(r.id)+'">'+mark(r.source)+'<span class="signal-copy"><span class="source-line"><b>'+esc(r.source)+'</b><i></i><time>'+esc(fmt(r.sourceDate))+'</time></span><strong>'+esc(r.title)+'</strong><span class="signal-tags">'+badge(r.stage,"stage")+'<span class="impact '+(r.impact==="Alto"?"high":"")+'"><i></i>Impacto '+esc(fold(r.impact)==="medio"?"médio":r.impact.toLowerCase())+'</span></span></span><span class="row-arrow">'+icon("upRight",16)+'</span></button>';
  }
  function queueCard(){
    const items=data.records.filter(pending).sort(byQueue);
    return '<section class="queue"><div class="panel-label">'+icon("inbox",15)+'Revisão semanal</div><div class="queue-head"><h2>Fila de avaliação</h2><span class="count-chip">'+pad(items.length)+'</span></div><div class="queue-list">'+items.slice(0,3).map((r,i)=>'<button class="queue-row" data-record="'+esc(r.id)+'"><span class="queue-num">'+pad(i+1)+'</span><span><small class="priority '+(r.priority==="Alta"?"high":"")+'"><i></i>Prioridade '+r.priority.toLowerCase()+'</small><b>'+esc(r.title)+'</b></span>'+icon("right",14)+'</button>').join("")+(!items.length?'<p class="quiet">Fila em dia.</p>':'')+'</div>'+linkBtn("Abrir visão semanal","weekly")+'</section>';
  }
  function home(){
    return hero()+pulse()+'<div class="editorial-grid"><section class="signals"><div class="section-head"><div class="title-with-icon"><span class="icon-glow">'+icon("radar",19)+'</span><h2>Últimos sinais</h2></div>'+linkBtn("Ver radar","radar")+'</div><div>'+data.records.slice().sort((a,b)=>(b.sourceDate||'').localeCompare(a.sourceDate||'')||byDate(a,b)).slice(0,5).map(signalRow).join("")+'</div></section><div class="right-rail">'+queueCard()+'<section class="pico-section"><div class="section-head"><h2>Método PICO</h2>'+icon("compass",18)+'</div>'+stages.map((s,i)=>'<button class="stage-link" data-stage="'+s+'"><span class="stage-letter">'+s[0]+'</span>'+s+'<span class="stage-number">'+pad(data.records.filter(r=>r.stage===s).length)+'</span></button>').join("")+'</section></div></div>';
  }
  function pageHead(title,description,action=""){return '<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></div>'+action+'</div>';}
  function empty(message){return '<div class="empty">'+icon("search",24)+'<p>'+esc(message)+'</p></div>';}
  function searchBar(placeholder){
    const count=Object.values(filters).filter(Boolean).length;
    return '<div class="toolbar"><label class="search">'+icon("search",16)+'<input id="query" aria-label="'+esc(placeholder)+'" value="'+esc(query)+'" placeholder="'+esc(placeholder)+'" type="search"></label><button class="outline-btn" data-action="filters" aria-expanded="'+filterOpen+'">'+icon("filter",15)+'Filtros'+(count?' <b>'+count+'</b>':'')+'</button></div>';
  }
  function filterPanel(){
    if(!filterOpen)return "";
    const f=filterDraft;
    const field=(key,label,options)=>'<label>'+label+'<select data-filter="'+key+'">'+opts(options,f[key],"Todos")+'</select></label>';
    const unique=key=>[...new Set(data.records.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt"));
    return '<form class="filterbox" id="filter-form"><div class="filter-grid">'+field("theme","Tema",unique("theme"))+field("source","Fonte",unique("source"))+field("stage","Etapa PICO",stages)+field("impact","Impacto",["Alto","Médio","Baixo"])+field("niche","Nicho",niches)+'<label>Data de publicação<select data-filter="period">'+opts(["Últimos 7 dias","Últimos 30 dias","Intervalo"],f.period,"Todo o período")+'</select></label>'+(f.period==="Intervalo"?'<label>De<input type="date" data-filter="from" value="'+esc(f.from)+'" required></label><label>Até<input type="date" data-filter="to" value="'+esc(f.to)+'" min="'+esc(f.from)+'" required></label>':'')+'</div><div class="filter-actions"><button type="button" class="text-link" data-action="clearFilters">Limpar filtros</button><button class="primary-btn" type="submit">Aplicar filtros</button></div></form>';
  }
  function match(r) {
    const f=filters;
    if(["theme","source","stage","impact"].some(k=>f[k]&&f[k]!==r[k])|| (f.niche&&!r.niches?.includes(f.niche)))return false;
    const d=r.sourceDate;
    if(f.period==="Intervalo" && !between(d,f.from,f.to))return false;
    if(f.period==="Últimos 7 dias" && !between(d,addDays(today(),-6),today()))return false;
    if(f.period==="Últimos 30 dias" && !between(d,addDays(today(),-29),today()))return false;
    return fold([r.title,r.summary,r.why,r.changed,r.opportunity,r.source,r.theme,r.stage,r.owner,r.niches?.join(" "),r.decision,r.next,r.risks,r.status].join(" ")).includes(fold(query));
  }
  function tabs(labels,active){return '<div class="tabs" role="group" aria-label="Filtrar visualização">'+labels.map(x=>'<button aria-pressed="'+(x===active)+'" class="'+(x===active?"chosen":"")+'" data-tab="'+esc(x)+'">'+esc(x)+'</button>').join("")+'</div>';}
  function activeFilterChips(){return Object.values(filters).some(Boolean)?'<div class="chips">'+Object.entries(filters).filter(([k,v])=>v&&!["from","to"].includes(k)).map(([k,v])=>'<button data-drop="'+k+'" aria-label="Remover filtro '+esc(v)+'">'+esc(k==="period"&&v==="Intervalo"?fmt(filters.from)+" — "+fmt(filters.to):v)+icon("x",12)+'</button>').join("")+'</div>':'';}
  function listResult(){
    let rows=data.records.filter(match);
    if(section==="history")rows=rows.filter(finished).sort((a,b)=>stamp(b).localeCompare(stamp(a)));
    else if(section==="weekly")rows=rows.filter(r=>pending(r)&&r.date<=addDays(week,6)).sort(byQueue);
    else rows.sort(byDate);
    if(tabState&&tabState!=="Todos")rows=rows.filter(r=>r.status===tabState);
    return '<div class="list-meta">'+pad(rows.length)+' '+(rows.length===1?'registro':'registros')+'</div>'+ (rows.length?rows.map(r=>'<div class="full-row">'+signalRow(r)+'<div class="row-side"><span class="small-status">'+esc(r.status)+'</span><span>'+esc(section==="weekly"?"Prioridade "+r.priority.toLowerCase():section==="history"?fmt(stamp(r)):r.theme)+'</span></div></div>').join(""):empty("Nenhuma análise corresponde a esta seleção."));
  }
  function radarPage(){
    const isHistory=section==="history",isWeekly=section==="weekly";
    const title=sections[section][0],desc=isHistory?"Pesquise decisões, responsáveis e aprendizados das análises concluídas.":isWeekly?"Pendências da semana e de períodos anteriores, em ordem de prioridade.":"Acompanhe as mudanças nas plataformas e avalie o impacto em cada etapa do PICO.";
    return pageHead(title,desc,isWeekly?weekBar():isHistory?"":'<button class="outline-btn" data-action="sources">'+icon("rss",16)+'Consultar fontes</button>')+(isWeekly?pulseWeekly():'')+searchBar("Buscar por assunto, fonte ou decisão…")+filterPanel()+activeFilterChips()+tabs(isHistory?["Todos","Analisado","Arquivado"]:isWeekly?["Todos","A avaliar","Em avaliação"]:["Todos","A avaliar","Em avaliação","Analisado","Arquivado"],tabState||"Todos")+'<section id="results" aria-label="Análises">'+listResult()+'</section>';
  }
  function pulseWeekly(){const until=addDays(week,6);return '<div class="week-intro"><span>'+icon("calendar",19)+periodLabel(week)+'</span><b>'+pad(data.records.filter(r=>pending(r)&&r.date<=until).length)+'</b><span>pendências até o fim da semana</span></div>';}
  function collectionPage(){
    const isTest=section==="tests";
    return pageHead(sections[section][0],isTest?"Vincule hipóteses às novidades e acompanhe a métrica e o resultado de cada teste.":"Recupere aprendizados para propostas, diagnósticos, páginas e comunicação.",'<button class="primary-btn" data-action="'+(isTest?"newTest":"newInsight")+'">'+icon("plus",16)+(isTest?"Novo teste":"Novo insight")+'</button>')+
      '<div class="toolbar"><label class="search">'+icon("search",16)+'<input type="search" id="query" aria-label="Pesquisar por título, nicho ou conteúdo" placeholder="Pesquisar por título, nicho ou conteúdo…" value="'+esc(query)+'"></label></div>'+
      tabs(isTest?["Todos","Planejado","Em andamento","Concluído"]:["Todos","Proposta","Diagnóstico","Página","Comunicação"],tabState||"Todos")+
      '<div id="results">'+collectionResult()+'</div>';
  }
  function collectionResult(){
    const isTest=section==="tests",group=isTest?"tests":"insights";
    const entries=data[group].map(t=>({t,r:data.records.find(r=>r.id===t.recordId)}))
      .filter(({t,r})=>(!tabState||tabState==="Todos"||tabState===(isTest?t.status:t.destination))&&fold([t.title,t.result,t.text,t.metric,t.hypothesis,r?.title,r?.niches?.join(" ")].join(" ")).includes(fold(query)))
      .sort((a,b)=>(b.t.startDate||b.t.date||"").localeCompare(a.t.startDate||a.t.date||""));
    return entries.length?'<div class="work-list">'+entries.map(({t,r})=>'<button class="work-card" data-object="'+(isTest?"test":"insight")+'" data-id="'+esc(t.id)+'"><span class="work-card-icon">'+icon(isTest?"flask":"bookmark",21)+'</span><span class="work-card-main"><span class="card-meta">'+esc(isTest?t.status:t.destination)+'<i></i>'+fmt(t.startDate||t.date)+'</span><strong>'+esc(t.title)+'</strong><span class="card-body">'+esc(isTest?(t.result||t.hypothesis):t.text)+'</span><span class="card-source">'+icon("link",13)+esc(r?.title||"Sem análise vinculada")+'</span></span>'+icon("upRight",18)+'</button>').join("")+'</div>':empty("Nenhum item corresponde à sua busca.");
  }
  function comparison(){
    const records=data.records.slice().sort(byDate);
    if(!records.some(x=>x.id===leftRecord))leftRecord=records[1]?.id||records[0]?.id||"";
    if(!records.some(x=>x.id===rightRecord))rightRecord=records.find(x=>x.id!==leftRecord)?.id||"";
    const forWeek=s=>data.records.filter(r=>between(r.date,s,addDays(s,6)));
    const first=forWeek(compA),last=forWeek(compB);
    function weeklyRow(title,a,b){const d=b-a;return '<tr><th scope="row">'+esc(title)+'</th><td>'+pad(a)+'</td><td>'+pad(b)+'</td><td class="delta">'+(d>0?"+":"")+d+'</td></tr>';}
    const datePick=(id,s)=>'<label>'+id+'<input type="date" aria-label="'+id+'" data-compare="'+(id==="Semana A"?"a":"b")+'" value="'+s+'" required></label>';
    const recordSide=(id,rid)=>{
      const item=data.records.find(x=>x.id===rid);
      const options=records.map(r=>'<option value="'+esc(r.id)+'"'+sel(r.id,rid)+'>'+esc(r.title)+'</option>').join("");
      return '<article class="compare-item"><label>Análise '+id+'<select aria-label="Análise '+id+'" data-compare="record'+id+'">'+options+'</select></label>'+(item?'<div class="compare-brand">'+mark(item.source)+'<span>'+esc(item.source)+' · '+fmt(item.sourceDate)+'</span></div><h3>'+esc(item.title)+'</h3>'+badge(item.stage,"stage")+'<dl>'+[["Impacto","impact"],["O que mudou","changed"],["Aplicação","opportunity"],["Decisão","decision"]].map(([l,k])=>'<dt>'+l+'</dt><dd>'+esc(item[k]||"Em aberto")+'</dd>').join("")+'</dl><button class="text-link" data-record="'+esc(item.id)+'">Abrir análise '+icon("arrow",15)+'</button>':'')+'</article>';
    };
    return pageHead("Comparativo","Compare o volume de novidades por semana e examine duas mudanças lado a lado.")+
      '<section class="compare-box"><div class="section-head"><h2>Evolução por período</h2></div><div class="date-picks">'+datePick("Semana A",compA)+datePick("Semana B",compB)+'</div><div class="table-wrap"><table><thead><tr><th>Indicador</th><th>'+periodLabel(compA)+'</th><th>'+periodLabel(compB)+'</th><th>Variação</th></tr></thead><tbody>'+weeklyRow("Sinais captados",first.length,last.length)+weeklyRow("Alto impacto",first.filter(x=>x.impact==="Alto").length,last.filter(x=>x.impact==="Alto").length)+stages.map(s=>weeklyRow(s,first.filter(r=>r.stage===s).length,last.filter(r=>r.stage===s).length)).join("")+'</tbody></table></div></section><section class="compare-section"><div class="section-head"><h2>Análises lado a lado</h2></div><div class="compare-cols">'+recordSide("A",leftRecord)+recordSide("B",rightRecord)+'</div></section>';
  }
  function sourceView(){
    const back='<button class="text-link back" data-action="closeSources">'+icon("arrow",15)+'Voltar ao radar</button>';
    const head=pageHead("Consultar fontes","Publicações recentes dos feeds oficiais, no idioma da fonte. Abra uma para preparar sua análise.",'<button class="outline-btn" data-action="loadSources" '+(feedState==="loading"?"disabled":"")+'>'+icon("rss",15)+'Consultar agora</button>');
    if(feedState==="loading")return back+head+'<p class="empty" role="status">Consultando as fontes…</p>';
    if(feedState==="error")return back+head+empty("Não foi possível carregar as fontes. Tente consultar novamente.");
    const items=feedResponse?.items||[],sources=feedResponse?.sources||[];
    return back+head+'<div class="source-status">'+sources.map(s=>'<span class="'+(s.ok?"available":"")+'"><i></i>'+esc(s.name)+' · '+(s.ok?"disponível":"indisponível")+'</span>').join("")+'</div>'+
      (items.length?items.map((item,i)=>{const existing=data.records.find(r=>r.url===item.url);return '<div class="feed-item">'+mark(item.source)+'<div><div class="source-line"><b>'+esc(item.source)+'</b><i></i>'+fmt(item.sourceDate)+'</div><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary)+'</p><a class="text-link" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Ler publicação '+icon("external",13)+'</a></div><button class="outline-btn" '+(existing?'data-record="'+esc(existing.id)+'"':'data-import="'+i+'"')+'>'+icon(existing?"check":"plus",14)+(existing?"Ver análise":"Avaliar")+'</button></div>';}).join(""):empty("Nenhuma publicação recente foi retornada pelas fontes disponíveis."));
  }
  async function loadSources(){
    feedMode=true;feedState="loading";const id=++feedId;render();
    try{const res=await fetch("/api/sources");if(!res.ok)throw Error();const body=await res.json();if(id!==feedId)return;feedResponse=body;feedState="done";}
    catch{if(id!==feedId)return;feedState="error";}
    if(feedMode)render();
  }
  function render(){
    shell();document.body.classList.toggle("menu-open",sidebar);
    const panel=document.getElementById("conteudo");
    panel.innerHTML=(!connected?'<div class="notice" role="status">Exibindo a curadoria inicial. <button data-action="reconnect">Carregar dados salvos</button></div>':'')+
      (section==="overview"?home():section==="compare"?comparison():["tests","insights"].includes(section)?collectionPage():section==="radar"&&feedMode?sourceView():radarPage());
    document.title=sections[section][0]+" · Radar EBA Growth";
  }
  function resetView(){query="";tabState="";filters=emptyFilters();filterOpen=false;filterDraft=null;sidebar=false;feedMode=false;}
  let nextFilters=null;
  function switchTo(k){
    if(k===section){resetView();if(nextFilters)Object.assign(filters,nextFilters);nextFilters=null;render();window.scrollTo(0,0);}
    else location.hash=k;
  }
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#conteudo"){document.getElementById("conteudo")?.focus();return;}
    section=currentSection();resetView();if(nextFilters)Object.assign(filters,nextFilters);nextFilters=null;render();window.scrollTo(0,0);
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&sidebar){sidebar=false;document.body.classList.remove("menu-open");document.querySelector(".menu-btn")?.focus();}});
  root.addEventListener("click",async e=>{
    const b=e.target.closest("button,a");if(!b)return;
    const ds=b.dataset;
    if(b.classList.contains("nav-item")&&b.getAttribute("href")==="#"+section){e.preventDefault();switchTo(section);return;}
    if(ds.nav){switchTo(ds.nav);return;}
    if(ds.record){const item=data.records.find(r=>r.id===ds.record);if(item)window.RadDialog.open("record",item);return;}
    if(ds.object){const item=data[ds.object==="test"?"tests":"insights"].find(r=>r.id===ds.id);if(item)window.RadDialog.open(ds.object,item);return;}
    if(ds.stage){nextFilters={stage:ds.stage};switchTo("radar");return;}
    if(ds.tab){tabState=ds.tab;render();return;}
    if(ds.drop){filters[ds.drop]="";if(ds.drop==="period"){filters.from="";filters.to="";}filterDraft={...filters};render();return;}
    if(ds.import!==undefined){const item=feedResponse?.items[Number(ds.import)];if(item)window.RadDialog.open("record-edit",{...item,date:today(),changed:item.summary});return;}
    switch(ds.action){
      case "menu":sidebar=!sidebar;document.body.classList.toggle("menu-open",sidebar);document.querySelector(".menu-btn")?.setAttribute("aria-expanded",sidebar);if(sidebar)document.querySelector(".nav-item.active")?.focus();break;
      case "newRecord":window.RadDialog.open("record-edit",{});break;
      case "newTest":window.RadDialog.open("test",{});break;
      case "newInsight":window.RadDialog.open("insight",{});break;
      case "goal":window.RadDialog.open("goal",{});break;
      case "filters":filterOpen=!filterOpen;filterDraft={...filters};render();if(filterOpen)document.querySelector("[data-filter]")?.focus();break;
      case "clearFilters":filters=emptyFilters();filterDraft={...filters};filterOpen=false;render();break;
      case "sources":case "loadSources":loadSources();break;
      case "closeSources":feedMode=false;render();break;
      case "reconnect":try{await loadStore();render();toast("Dados carregados.");}catch{toast("Banco indisponível. Tente novamente em instantes.");}break;
    }
  });
  root.addEventListener("input",e=>{
    if(e.target.id==="query"){
      query=e.target.value;const results=document.getElementById("results");
      if(results)results.innerHTML=["tests","insights"].includes(section)?collectionResult():listResult();
    }
  });
  root.addEventListener("change",e=>{
    const el=e.target;
    if(el.dataset.control==="week"){weekOffset=Number(el.value);week=addDays(thisWeek(),weekOffset*7);render();return;}
    if(el.dataset.filter){filterDraft[el.dataset.filter]=el.value;if(el.dataset.filter==="period"){if(el.value!=="Intervalo"){filterDraft.from="";filterDraft.to="";}render();}if(el.dataset.filter==="from"){const end=root.querySelector('[data-filter="to"]');if(end)end.min=el.value;}return;}
    if(el.dataset.compare){if(!el.value)return;switch(el.dataset.compare){case "a":compA=monday(el.value);break;case "b":compB=monday(el.value);break;case "recordA":leftRecord=el.value;break;case "recordB":rightRecord=el.value;break;}render();}
  });
  root.addEventListener("submit",e=>{if(e.target.id==="filter-form"){e.preventDefault();filters={...filterDraft};filterOpen=false;render();}});
  async function start(){hydrate([]);try{await loadStore();}catch{connected=false;}render();const analysis=new URLSearchParams(location.search).get("analise");const item=data.records.find(r=>r.id===analysis);if(item)window.RadDialog.open("record",item);const insight=data.insights.find(i=>i.id===new URLSearchParams(location.search).get("insight"));if(insight)window.RadDialog.open("insight",insight);}
  start();
})();
