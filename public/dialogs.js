(() => {
  'use strict';

  const STAGES = ['Posicionar', 'Impulsionar', 'Converter', 'Otimizar'];
  const IMPACTS = ['Alto', 'Médio', 'Baixo'];
  const PRIORITIES = ['Alta', 'Média', 'Baixa'];
  const RECORD_STATUS = ['A avaliar', 'Em avaliação', 'Analisado', 'Arquivado'];
  const NICHES = ['Clínicas e saúde', 'Advocacia', 'Revendas de veículos'];
  const TEST_STATUS = ['Planejado', 'Em andamento', 'Concluído'];
  const DESTINATIONS = ['Proposta', 'Diagnóstico', 'Página', 'Comunicação'];
  const icons = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M4.5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M14 4h6v6m-9 3 9-9M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1 11-11a2 2 0 0 0-5-5L5 15z"/>',
    test: '<path d="M9 3h6m-5 0v7L4.5 19a1.3 1.3 0 0 0 1.1 2h12.8a1.3 1.3 0 0 0 1.1-2L14 10V3M7.5 15h9"/>',
    library: '<path d="m4 5 4-1v15l-4 1zm7-1h3v15h-3zm5 1 3-1 3 14-3 1z"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/>',
    back: '<path d="m10 6-6 6 6 6M4 12h16"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  let modal;
  let current;
  let opener;
  let stack = [];
  let busy = false;

  const svg = name => '<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const attr = (name, value) => value == null ? '' : ' ' + name + '="' + esc(value) + '"';
  const rows = collection => window.Radar?.data?.[collection] || [];
  const dateNow = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dateLabel = value => {
    if (!value) return '';
    const d = new Date(String(value).slice(0, 10) + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ');
  };
  const externalUrl = value => {
    if (!value) return '';
    try {
      const parsed = new URL(value);
      return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
    } catch { return ''; }
  };

  function ensureModal() {
    if (modal?.isConnected) return;
    modal = document.createElement('dialog');
    modal.className = 'rd-modal';
    modal.setAttribute('aria-labelledby', 'rd-title');
    document.body.append(modal);
    modal.addEventListener('cancel', e => {
      if (busy) { e.preventDefault(); return; }
      if (stack.length) { e.preventDefault(); goBack(); }
    });
    modal.addEventListener('close', () => {
      if (modal.open) return;
      document.body.classList.remove('rd-lock');
      stack = [];
      current = null;
      const preferred = opener?.isConnected ? opener : document.querySelector('[data-view][aria-current="page"], main button, button');
      if (preferred instanceof HTMLElement) preferred.focus({ preventScroll: true });
      opener = null;
    });
    modal.addEventListener('click', onClick);
    modal.addEventListener('submit', onSubmit);
    modal.addEventListener('input', event => {
      if (event.target.setCustomValidity) event.target.setCustomValidity('');
    });
  }

  function open(type, item = {}) {
    if (!['record', 'record-edit', 'test', 'insight', 'goal'].includes(type)) return;
    ensureModal();
    const showing = modal.open;
    if (showing && busy) return;
    if (!showing) {
      stack = [];
      opener = document.activeElement;
    }
    render(type, item || {});
    if (!showing) {
      modal.showModal();
      document.body.classList.add('rd-lock');
    }
    modal.querySelector('#rd-title')?.focus({ preventScroll: true });
  }

  function render(type, item) {
    current = { type, item, draftId: item.id || null };
    const templates = { record: recordDetail, 'record-edit': recordForm, test: testForm, insight: insightForm, goal: goalForm };
    modal.dataset.mode = type;
    modal.innerHTML = templates[type](item);
  }

  function navigate(type, item) {
    stack.push(current);
    open(type, item);
  }

  function goBack() {
    if (!stack.length) { modal.close(); return; }
    const previous = stack.pop();
    const { type, item } = previous;
    const refreshed = type === 'record' ? rows('records').find(row => row.id === item.id) || item : item;
    open(type, refreshed);
  }

  const action = (label, cmd, icon, secondary = true) => '<button type="button" data-rd-action="' + cmd + '" class="rd-btn ' + (secondary ? 'rd-secondary' : 'rd-primary') + '">' + (icon ? svg(icon) : '') + esc(label) + '</button>';
  function header(kicker, title) {
    return '<header class="rd-header"><div class="rd-header-text"><div class="rd-overline"><span></span>' + esc(kicker) + '</div><h2 id="rd-title" tabindex="-1">' + esc(title) + '</h2></div><button type="button" class="rd-close" data-rd-action="close" aria-label="Fechar janela">' + svg('close') + '</button></header>';
  }

  function group(title, fields) {
    return '<fieldset class="rd-group"><legend>' + esc(title) + '</legend><div class="rd-grid">' + fields + '</div></fieldset>';
  }

  function field(name, label, value, opts = {}) {
    const { type = 'text', options, required = false, full = false, placeholder, suggestions, min, max, maxlength = type === 'area' ? 12000 : 500 } = opts;
    const id = 'rd-f-' + name;
    const common = ' id="' + id + '" name="' + name + '"' + (required ? ' required' : '');
    let control;
    if (options) {
      const entries = options.map(entry => typeof entry === 'string' ? [entry, entry] : entry);
      if (value && !entries.some(entry => entry[0] === value)) entries.push([value, value]);
      control = '<select' + common + '>' + entries.map(([key, text]) => '<option' + attr('value', key) + (key === value ? ' selected' : '') + '>' + esc(text) + '</option>').join('') + '</select>';
    } else if (type === 'area') {
      control = '<textarea' + common + attr('maxlength', maxlength) + attr('placeholder', placeholder) + ' rows="3">' + esc(value) + '</textarea>';
    } else {
      control = '<input' + common + attr('type', type) + attr('value', value) + attr('placeholder', placeholder) + attr('min', min) + attr('max', max) + attr('maxlength', maxlength) + (suggestions ? attr('list', id + '-list') : '') + '>';
      if (suggestions) control += '<datalist id="' + id + '-list">' + [...new Set(suggestions.filter(Boolean))].map(v => '<option' + attr('value', v) + '></option>').join('') + '</datalist>';
    }
    return '<div class="rd-field' + (full ? ' rd-full' : '') + '"><label for="' + id + '">' + esc(label) + (required ? '<span aria-hidden="true"> *</span>' : '') + '</label>' + control + '</div>';
  }

  function relatedRecord(selected) {
    const options = [['', 'Sem vínculo'], ...rows('records').map(r => [r.id, r.title])];
    return field('recordId', 'Novidade relacionada', selected ?? '', { options, full: true });
  }

  function formShell(kicker, title, groups, submitLabel, extra = '') {
    return header(kicker, title) + '<div class="rd-body"><form id="rd-form">' + groups + '</form></div><footer class="rd-footer"><div class="rd-feedback" role="alert"></div><div class="rd-actions">' + action(stack.length ? 'Voltar' : 'Cancelar', 'back', stack.length ? 'back' : null) + extra + '<button class="rd-btn rd-primary" form="rd-form" type="submit">' + svg('check') + esc(submitLabel) + '</button></div></footer>';
  }

  function recordForm(r) {
    const recordList = rows('records');
    const fromOptions = ['Google Ads', 'Meta', 'Google Analytics', ...recordList.map(row => row.source)];
    const themes = ['Mídia paga', 'Mensuração', 'Otimização de conversão', 'Criativos', 'Automação', ...recordList.map(row => row.theme)];
    const selected = Array.isArray(r.niches) ? r.niches : [];
    const nicheList = [...new Set([...NICHES, ...selected])];
    const n = '<fieldset class="rd-niches rd-full"><legend>Nichos de aplicação</legend><div>' + nicheList.map(v => '<label><input type="checkbox" name="niches" value="' + esc(v) + '"' + (selected.includes(v) ? ' checked' : '') + '><span>' + esc(v) + '</span></label>').join('') + '</div></fieldset>';
    const a = (name, label, placeholder) => field(name, label, r[name], { type: 'area', full: true, placeholder });
    const parts = group('Publicação', 
      field('title', 'Título da novidade', r.title, { required: true, full: true, placeholder: 'Qual é a principal mudança?', maxlength: 240 }) +
      field('source', 'Fonte', r.source, { suggestions: fromOptions, placeholder: 'Ex. Google Ads' }) +
      field('sourceDate', 'Data da publicação', r.sourceDate, { type: 'date' }) +
      field('url', 'Link da fonte', r.url, { type: 'url', placeholder: 'https://', full: true, maxlength: 4000 }) +
      field('date', 'Data de registro', r.date || dateNow(), { type: 'date', required: true }) +
      field('theme', 'Tema', r.theme, { suggestions: themes, placeholder: 'Ex. Mídia paga' }) +
      a('summary', 'Resumo', 'Uma frase para identificar a novidade no radar.')) +
      group('Análise de impacto',
        field('stage', 'Etapa do Método PICO', r.stage || STAGES[0], { options: STAGES }) +
        field('impact', 'Impacto', r.impact || 'Médio', { options: IMPACTS }) + n +
        a('changed', 'O que mudou') + a('why', 'Por que importa para a EBA') +
        a('opportunity', 'Oportunidade de aplicação') + a('risks', 'Riscos e limites')) +
      group('Decisão e acompanhamento',
        field('priority', 'Prioridade', r.priority || 'Média', { options: PRIORITIES }) +
        field('status', 'Status da avaliação', r.status || RECORD_STATUS[0], { options: RECORD_STATUS }) +
        field('owner', 'Responsável pela avaliação', r.owner, { full: true, placeholder: 'Nome da pessoa responsável' }) +
        a('decision', 'Decisão tomada') + a('next', 'Próximos passos'));
    return formShell('Radar de novidades', r.id ? 'Editar avaliação' : 'Registrar novidade', parts, r.id ? 'Salvar avaliação' : 'Registrar novidade');
  }

  function detailBlock(title, value) {
    return '<div class="rd-detail-block"><h4>' + esc(title) + '</h4><p' + (value ? '' : ' class="rd-muted"') + '>' + esc(value || 'A preencher') + '</p></div>';
  }

  function revisionHistory(history) {
    if (!Array.isArray(history) || !history.length) return '';
    const names = {title:'Título',changed:'Mudança',why:'Relevância',opportunity:'Aplicação',risks:'Riscos',priority:'Prioridade',decision:'Decisão',status:'Status',owner:'Responsável',next:'Próximos passos',stage:'Etapa PICO',impact:'Impacto',theme:'Tema',niches:'Nichos',url:'Link',source:'Fonte',date:'Registro',sourceDate:'Publicação',summary:'Resumo'};
    const stamp = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
    return '<details class="rd-revisions"><summary>Histórico de alterações (' + history.length + ')</summary>' + history.slice().reverse().map(h =>
      '<article><b>' + esc(stamp.format(new Date(h.at))) + ' · '+ esc(h.status) + '</b><p>' + esc((h.fields||[]).map(k=>names[k]||k).join(', ')) + '</p>' + (h.decision?'<p>'+esc(h.decision)+'</p>':'')+'</article>'
    ).join('')+'</details>';
  }

  function recordDetail(r) {
    const href = externalUrl(r.url);
    const facts = [
      ['Etapa PICO', r.stage], ['Impacto', r.impact], ['Prioridade', r.priority], ['Responsável', r.owner || 'A definir'],
    ];
    const details = [
      ['O que mudou', r.changed || r.summary], ['Por que importa', r.why],
      ['Aplicação prática', r.opportunity], ['Riscos e limites', r.risks],
      ['Decisão tomada', r.decision], ['Próximos passos', r.next],
    ];
    const tests = rows('tests').filter(t => t.recordId === r.id);
    const insights = rows('insights').filter(i => i.recordId === r.id);
    const related = (list, cmd, icon) => list.map(row => '<button class="rd-linked" data-rd-action="' + cmd + '" data-rd-id="' + esc(row.id) + '" type="button">' + svg(icon) + '<span>' + esc(row.title) + '</span>' + svg('arrow') + '</button>').join('');
    const niches = Array.isArray(r.niches) ? r.niches : [];
    return header(r.theme || 'Radar de novidades', r.title || 'Ficha de análise') +
      '<div class="rd-body"><div class="rd-status-line">' + (r.status ? '<span class="rd-chip">' + esc(r.status) + '</span>' : '') +
      (r.date ? '<span>Registrado em ' + esc(dateLabel(r.date)) + '</span>' : '') + '</div>' +
      (r.summary ? '<p class="rd-summary">' + esc(r.summary) + '</p>' : '') +
      '<div class="rd-source">' + (href ? '<a target="_blank" rel="noopener noreferrer" href="' + esc(href) + '">' + esc(r.source || 'Publicação original') + svg('external') + '</a>' : '<strong>' + esc(r.source || 'Fonte a registrar') + '</strong>') +
      (r.sourceDate ? '<span>Publicado em ' + esc(dateLabel(r.sourceDate)) + '</span>' : '') + '</div>' +
      '<dl class="rd-facts">' + facts.map(([label, v]) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(v || 'A definir') + '</dd></div>').join('') + '</dl>' +
      (niches.length ? '<div class="rd-niche-row"><span>Nichos</span>' + niches.map(n => '<span class="rd-niche">' + esc(n) + '</span>').join('') + '</div>' : '') +
      '<section class="rd-reading"><h3>Análise editorial</h3>' + details.slice(0, 4).map(([k, v]) => detailBlock(k, v)).join('') + '</section>' +
      '<section class="rd-reading"><h3>Decisão e acompanhamento</h3>' + details.slice(4).map(([k, v]) => detailBlock(k, v)).join('') + '</section>' +
      (tests.length || insights.length ? '<section class="rd-reading"><h3>Desdobramentos</h3>' + related(tests, 'linked-test', 'test') + related(insights, 'linked-insight', 'library') + '</section>' : '') +
      revisionHistory(r.history) + '</div><footer class="rd-footer"><div class="rd-actions">' + action('Criar teste', 'new-test', 'test') + action('Reutilizar insight', 'new-insight', 'library') + action('Editar avaliação', 'edit', 'edit', false) + '</div></footer>';
  }

  function testForm(t) {
    const parts = group('Experimento',
      field('title', 'Título do teste', t.title, { required: true, full: true, maxlength: 240, placeholder: 'Ex. Comparar duas versões do formulário' }) +
      relatedRecord(t.recordId) +
      field('hypothesis', 'Hipótese', t.hypothesis, { full: true, type: 'area', placeholder: 'O que você espera observar e por quê?' }) +
      field('metric', 'Métrica de sucesso', t.metric, { placeholder: 'Ex. Taxa de leads qualificados' }) +
      field('status', 'Status do teste', t.status || TEST_STATUS[0], { options: TEST_STATUS })) +
      group('Período e resultado',
        field('startDate', 'Início', t.startDate || dateNow(), { type: 'date' }) +
        field('endDate', 'Encerramento', t.endDate, { type: 'date' }) +
        field('result', 'Resultados e aprendizados', t.result, { full: true, type: 'area', placeholder: 'Registre os valores observados e a conclusão.' }));
    return formShell('Laboratório de testes', t.id ? 'Acompanhar teste' : 'Criar teste', parts, 'Salvar teste');
  }

  function insightForm(i) {
    const parts = group('Aplicação na EBA Growth',
      field('title', 'Título do insight', i.title, { required: true, full: true, maxlength: 240 }) +
      relatedRecord(i.recordId) +
      field('destination', 'Destino do aprendizado', i.destination || DESTINATIONS[0], { options: DESTINATIONS }) +
      field('date', 'Data', i.date || dateNow(), { type: 'date', required: true }) +
      field('text', 'Texto para reutilizar', i.text, { required: true, full: true, type: 'area', placeholder: 'Adapte o aprendizado para o material escolhido.' }));
    return formShell('Biblioteca de insights', i.id ? 'Reutilizar insight' : 'Registrar insight', parts, 'Salvar insight', action('Copiar texto', 'copy', 'copy'));
  }

  function goalForm(p) {
    const settings = window.Radar?.data?.settings;
    const saved = Array.isArray(settings) ? settings.find(s => s.id === 'weekly-goal') : settings?.['weekly-goal'];
    const value = p.value ?? saved?.value ?? 8;
    return formShell('Visão semanal', 'Meta de análises', group('Ritmo de avaliação', field('value', 'Análises por semana', value, { type: 'number', min: 1, max: 999, required: true, full: true })), 'Salvar meta');
  }

  function message(text) {
    const node = modal.querySelector('.rd-feedback');
    if (node) node.textContent = text;
  }

  async function onClick(event) {
    const trigger = event.target.closest('[data-rd-action]');
    if (!trigger || busy) return;
    const cmd = trigger.dataset.rdAction;
    const item = current.item;
    if (cmd === 'close') { modal.close(); return; }
    if (cmd === 'back') { goBack(); return; }
    if (cmd === 'edit') { navigate('record-edit', item); return; }
    if (cmd === 'new-test') { navigate('test', { recordId: item.id, hypothesis: item.opportunity || '' }); return; }
    if (cmd === 'new-insight') { navigate('insight', { recordId: item.id, title: item.title, text: item.opportunity || item.why || '' }); return; }
    if (cmd === 'linked-test' || cmd === 'linked-insight') {
      const isTest = cmd === 'linked-test';
      const row = rows(isTest ? 'tests' : 'insights').find(row => row.id === trigger.dataset.rdId);
      if (row) navigate(isTest ? 'test' : 'insight', row);
      return;
    }
    if (cmd === 'copy') {
      const field = modal.querySelector('[name="text"]');
      if (!field?.value.trim()) { field?.focus(); message('Preencha o texto que deseja copiar.'); return; }
      try {
        await navigator.clipboard.writeText(field.value);
        message('Texto copiado.');
      } catch {
        field.focus(); field.select();
        message('Texto selecionado. Use o comando de copiar do seu dispositivo.');
      }
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.target;
    const { type, item } = current;
    const data = new FormData(form);
    const cleaned = Object.fromEntries(Array.from(data, ([key, value]) => [key, String(value).trim()]));
    for (const input of form.querySelectorAll('[required]')) {
      if (!input.value.trim()) {
        input.setCustomValidity('Preencha este campo.');
        input.reportValidity();
        return;
      }
    }
    if (cleaned.url && !externalUrl(cleaned.url)) {
      form.elements.url.setCustomValidity('Informe um link iniciado por https:// ou http://.');
      form.elements.url.reportValidity();
      return;
    }
    if (cleaned.startDate && cleaned.endDate && cleaned.endDate < cleaned.startDate) {
      form.elements.endDate.setCustomValidity('O encerramento deve ser igual ou posterior ao início.');
      form.elements.endDate.reportValidity();
      form.elements.endDate.setCustomValidity('');
      return;
    }
    if (type === 'record-edit') {
      cleaned.niches = data.getAll('niches').map(String);
      cleaned.updatedAt = new Date().toISOString();
    }
    if (type === 'goal') cleaned.value = Number(cleaned.value);
    const collection = { 'record-edit': 'records', test: 'tests', insight: 'insights', goal: 'settings' }[type];
    if (!collection) return;
    const id = type === 'goal' ? 'weekly-goal' : current.draftId || crypto.randomUUID();
    current.draftId = id;
    const object = { ...item, ...cleaned, id };
    busy = true;
    modal.querySelectorAll('button').forEach(b => { b.disabled = true; });
    const submit = modal.querySelector('[type="submit"]');
    const label = submit.innerHTML;
    submit.textContent = 'Salvando…';
    message('');
    try {
      await window.Radar.save(collection, object);
      busy = false;
      window.Radar.toast?.(({ 'record-edit': 'Novidade salva.', test: 'Teste salvo.', insight: 'Insight salvo.', goal: 'Meta semanal salva.' })[type]);
      if (stack.length) goBack();
      else modal.close();
    } catch (error) {
      const raw = String(error?.message || '');
      const conflict = error?.status === 409 || /conflit|conflict|409|outra (aba|sessão)|alterad[oa] em/i.test(raw);
      message(conflict ? 'Este registro foi atualizado em outra sessão. Copie suas alterações e reabra a ficha para revisar a versão atual.' : (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].{3,240}[.!?]$/u.test(raw) && /salvar|conexão|rede|sessão|limite|tentar|armazen/i.test(raw) ? raw : 'Não foi possível salvar. Revise sua conexão e tente novamente.'));
      submit.innerHTML = label;
      modal.querySelectorAll('button').forEach(b => { b.disabled = false; });
    } finally {
      busy = false;
    }
  }

  window.RadDialog = { open };
})();
