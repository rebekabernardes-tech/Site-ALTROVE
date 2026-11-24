/* ==========================================================================
   ALTROVE · app.js · Interface e fluxo de compra
   Sumário: 1 Utilitários · 2 Estado · 3 Rotas · 4 Catálogo · 5 Carrinho
            6 Checkout · 7 Confirmação e acompanhamento · 8 Animações · 9 Início
   REGRA: este arquivo NÃO acessa banco nem servidor. Tudo passa por AltroveAPI (api.js),
   que é a área reservada para a integração com C# + MySQL.
   ========================================================================== */
(() => {
  'use strict';
  const API = window.AltroveAPI;

  /* ---------- 1. UTILITÁRIOS ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const BRL = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage indisponível */ } };
  const ler = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2800); }

  /* ---------- 2. ESTADO ---------- */
  const SEASON_NOW = 'Primavera';                 // estação em destaque (definir regra real com a Altrove)
  const STATUS = [['recebido', 'Recebido', 'A loja registrou o pedido.'], ['em_preparo', 'Em preparo', 'O pedido está sendo preparado.'], ['a_caminho', 'A caminho', 'O pedido saiu para entrega.'], ['entregue', 'Entregue', 'A entrega foi concluída.']];
  const state = { produtos: [], cart: ler('alt-cart', {}), filtro: 'todos', entrega: null, ultimo: null, busy: false, first: true };
  const porId = (id) => state.produtos.find((p) => p.id === Number(id));
  const linhas = () => Object.entries(state.cart).map(([id, q]) => ({ p: porId(id), q })).filter((l) => l.p);
  const subtotal = () => linhas().reduce((s, l) => s + l.p.preco_fatia * l.q, 0);
  const salvarCarrinho = () => {
    guardar('alt-cart', state.cart);
    const n = linhas().reduce((s, l) => s + l.q, 0), b = $('#cart-badge');
    b.textContent = n; b.setAttribute('aria-label', n + (n === 1 ? ' item' : ' itens'));
  };

  /* ---------- 3. ROTAS (hash: #inicio, #cardapio, #produto-ID, #carrinho, #checkout, #confirmacao, #acompanhar) ---------- */
  const RENDER = { inicio: renderInicio, cardapio: renderCardapio, produto: renderProduto, carrinho: renderCarrinho, checkout: renderCheckout, confirmacao: renderConfirmacao, acompanhar: renderAcompanhar };
  function rota() {
    const h = (location.hash || '#inicio').slice(1), i = h.indexOf('-');
    const nome = i < 0 ? h : h.slice(0, i), arg = i < 0 ? '' : h.slice(i + 1);
    const view = RENDER[nome] ? nome : 'inicio';
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
    $$('[data-nav]').forEach((a) => (a.dataset.nav === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    RENDER[view](arg);
    const sec = $(`.view[data-view="${view}"]`);
    sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');      // animação de entrada
    const h1 = $('h1', sec);
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'Altrove';
    if (!state.first) { window.scrollTo(0, 0); if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); } }   // acessibilidade
    state.first = false;
    observar();
  }

  /* ---------- 4. CATÁLOGO ---------- */
  const cartao = (p) => `
    <article class="card${p.disponivel ? '' : ' card--off'}">
      <a class="card__img" href="#produto-${p.id}" aria-label="Ver detalhes: ${esc(p.nome)}"><img src="${p.imagem_url}" alt="" loading="lazy"></a>
      <div class="card__body">
        <span class="tag ${p.disponivel ? 'tag--verde' : ''}">${p.disponivel ? 'Disponível' : 'Indisponível no momento'}</span>
        <h3><a href="#produto-${p.id}">${esc(p.nome)}</a></h3>
        <p class="mut">${esc(p.descricao)}</p>
        <div><span class="price">${BRL(p.preco_fatia)}</span> <span class="mut">por fatia</span></div>
        ${p.disponivel ? `<button class="btn" data-add="${p.id}">Adicionar ao carrinho</button>` : '<button class="btn btn--ghost" disabled>Indisponível</button>'}
      </div>
    </article>`;
  function renderInicio() { $('#home-grid').innerHTML = state.produtos.filter((p) => p.estacao === SEASON_NOW && p.disponivel).map(cartao).join(''); }
  function renderCardapio() {
    const F = [['todos', 'Todos'], ['bolo', 'Bolos'], ['torta', 'Tortas'], ['estacao', 'Sabores da estação']];
    $('#filters').innerHTML = F.map(([k, t]) => `<button class="btn" data-filtro="${k}" aria-pressed="${state.filtro === k}">${t}</button>`).join('');
    const l = state.produtos.filter((p) => state.filtro === 'todos' || (state.filtro === 'estacao' ? p.estacao === SEASON_NOW : p.tipo === state.filtro));
    $('#menu-grid').innerHTML = l.map(cartao).join('');
  }
  function renderProduto(id) {
    const p = porId(id), box = $('#pdp');
    if (!p) { box.innerHTML = '<h1>Produto não encontrado</h1><a class="btn" href="#cardapio">Voltar ao cardápio</a>'; return; }
    box.innerHTML = `
      <p><a href="#cardapio">Voltar ao cardápio</a></p>
      <div class="pdp">
        <div class="pdp__img"><span class="blob blob--1"></span><span class="blob blob--2"></span><img src="${p.imagem_url}" alt="${esc(p.nome)} (foto provisória)"></div>
        <div>
          <p><span class="tag tag--lilas">${p.tipo === 'bolo' ? 'Bolo' : 'Torta'}</span> <span class="tag">${p.estacao}</span> ${p.tipo_a_confirmar ? '<span class="tag">Tipo a confirmar</span>' : ''}</p>
          <h1 style="font-size:clamp(2.2rem,5vw,3.2rem)">${esc(p.nome)}</h1>
          <p>${esc(p.descricao)}</p>
          <p><span class="price">${BRL(p.preco_fatia)}</span> <span class="mut">por fatia</span></p>
          <p class="mut">Ingredientes e alergênicos: informados após confirmação pela Altrove.</p>
          ${p.disponivel ? `<div class="acts" style="align-items:flex-end"><div><label for="qt">Quantidade</label><input id="qt" type="number" min="1" max="20" value="1"></div><button class="btn" data-addq="${p.id}">Adicionar ao carrinho</button></div>`
                         : '<p class="msg msg--err">✕ Indisponível no momento. Veja outras fatias no cardápio.</p>'}
          <img class="draw-cake" src="assets/svg/bolo-desenho.svg" alt="" aria-hidden="true">
        </div>
      </div>`;
  }

  /* ---------- 5. CARRINHO ---------- */
  function adicionar(id, q = 1) { state.cart[id] = Math.min((state.cart[id] || 0) + q, 20); salvarCarrinho(); toast('Adicionado: ' + porId(id).nome); }
  function mudar(id, d) { const q = (state.cart[id] || 0) + d; if (q <= 0) delete state.cart[id]; else state.cart[id] = Math.min(q, 20); salvarCarrinho(); rota(); }
  function renderCarrinho() {
    const L = linhas(), box = $('#cart-body');
    if (!L.length) { box.innerHTML = '<p>Ainda não há fatias por aqui. Que tal conhecer o cardápio?</p><a class="btn" href="#cardapio">Conhecer o cardápio</a>'; return; }
    const off = L.some((l) => !l.p.disponivel);
    box.innerHTML = `<div class="two"><div class="panel">${L.map(({ p, q }) => `
      <div class="line"><img src="${p.imagem_url}" alt="">
        <div><strong>${esc(p.nome)}</strong><br><span class="mut">${BRL(p.preco_fatia)} por fatia${p.disponivel ? '' : ' · indisponível, remova para continuar'}</span></div>
        <strong>${BRL(p.preco_fatia * q)}</strong>
        <span></span><div class="qty"><button class="btn btn--ghost btn--icon" data-dec="${p.id}" aria-label="Diminuir quantidade de ${esc(p.nome)}">−</button><span>${q}</span><button class="btn btn--ghost btn--icon" data-inc="${p.id}" aria-label="Aumentar quantidade de ${esc(p.nome)}">+</button></div>
        <button class="btn btn--ghost" data-rm="${p.id}" aria-label="Remover ${esc(p.nome)}">Remover</button></div>`).join('')}</div>
      <aside class="panel sum"><h2 style="font-size:1.7rem">Resumo</h2>
        <div><span>Subtotal</span><span>${BRL(subtotal())}</span></div>
        <div><span>Taxa de entrega</span><span class="mut">calculada no checkout</span></div>
        <div class="total"><span>Total</span><span class="mut">definido no checkout</span></div>
        ${off ? '<p class="msg msg--err">✕ Remova os itens indisponíveis para continuar.</p>' : '<a class="btn" href="#checkout" style="width:100%">Ir para o checkout</a>'}
      </aside></div>`;
  }

  /* ---------- 6. CHECKOUT ---------- */
  function renderCheckout() {
    const L = linhas();
    if (!L.length) { location.hash = '#carrinho'; return; }
    $('#co-items').innerHTML = L.map(({ p, q }) => `<div><span>${q}× ${esc(p.nome)}</span><span>${BRL(p.preco_fatia * q)}</span></div>`).join('');
    $('#co-sub').textContent = BRL(subtotal()); atualizarTotal();
  }
  function atualizarTotal() {
    const t = state.entrega && state.entrega.atendido ? state.entrega.taxa : null;
    $('#co-tx').textContent = t == null ? 'informe o CEP' : BRL(t); $('#co-tx').className = t == null ? 'mut' : '';
    $('#co-total').textContent = BRL(subtotal() + (t || 0));
  }
  async function aoDigitarCep(e) {
    const d = digitos(e.target.value), msg = $('#cep-msg');
    e.target.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5, 8) : d;
    if (d.length < 8) { state.entrega = null; msg.textContent = ''; atualizarTotal(); return; }
    const r = await API.consultarEntrega(d);                        // <<< chamada reservada (C#)
    state.entrega = r; msg.textContent = (r.atendido ? '✓ ' : '✕ ') + r.mensagem; msg.style.color = r.atendido ? 'var(--ok)' : 'var(--err)'; atualizarTotal();
  }
  async function enviarPedido(e) {
    e.preventDefault(); if (state.busy) return;
    const v = (id) => $('#' + id).value.trim(), er = {};
    if (v('nome').length < 3) er.nome = 'Informe seu nome completo.';
    if (digitos(v('tel')).length < 10) er.tel = 'Informe o telefone com DDD.';
    if (digitos(v('cep')).length !== 8) er.cep = 'Informe um CEP com 8 números.'; else if (!state.entrega || !state.entrega.atendido) er.cep = 'Este CEP está fora da área de entrega de demonstração.';
    if (!v('end')) er.end = 'Informe a rua e o bairro.'; if (!v('num')) er.num = 'Informe o número.';
    ['nome', 'tel', 'cep', 'end', 'num'].forEach((k) => { $('#' + k).removeAttribute('aria-invalid'); $('#' + k + '-e').textContent = ''; });
    const ks = Object.keys(er);
    if (ks.length) { ks.forEach((k) => { $('#' + k).setAttribute('aria-invalid', 'true'); $('#' + k + '-e').textContent = '✕ ' + er[k]; }); $('#errs').innerHTML = `<p class="msg msg--err">Corrija ${ks.length === 1 ? '1 campo' : ks.length + ' campos'} para continuar.</p>`; $('#' + ks[0]).focus(); return; }
    $('#errs').innerHTML = ''; state.busy = true; $('#co-submit').disabled = true;       // evita pedido duplicado
    try {
      const pedido = await API.criarPedido({                         // <<< chamada reservada (C#)
        nome: v('nome'), telefone: v('tel'), cep: digitos(v('cep')), endereco: v('end'), numero: v('num'), complemento: v('comp'), observacoes: v('obs'),
        forma_pagamento: $('input[name=pay]:checked').value, itens: linhas().map((l) => ({ produto_id: l.p.id, quantidade: l.q })) });
      state.ultimo = pedido; state.cart = {}; salvarCarrinho(); location.hash = '#confirmacao';
    } catch (err) { $('#errs').innerHTML = '<p class="msg msg--err">✕ Não foi possível registrar o pedido. Tente de novo.</p>'; }
    state.busy = false; $('#co-submit').disabled = false;
  }

  /* ---------- 7. CONFIRMAÇÃO E ACOMPANHAMENTO ---------- */
  const PAGTO = { pendente: 'Pendente (simulação, sem cobrança)', na_entrega: 'Na entrega (simulação)', aprovado: 'Aprovado' };
  function renderConfirmacao() {
    const o = state.ultimo, box = $('#conf-body');
    if (!o) { box.innerHTML = '<h1>Confirmação</h1><p>Não há pedido recente para mostrar.</p><a class="btn" href="#cardapio">Conhecer o cardápio</a>'; return; }
    box.innerHTML = `<h1>Recebemos seu pedido. Agora, cuidamos dos detalhes.</h1>
      <p class="msg msg--ok" role="status">✓ Pedido de demonstração registrado só neste navegador. Não foi enviado à Altrove e nenhuma cobrança foi feita.</p>
      <div class="panel sum" style="max-width:640px">
        <div><span>Número</span><strong>${esc(o.numero)}</strong></div><div><span>Situação</span><span>Pedido recebido (simulação)</span></div>
        <div><span>Pagamento</span><span>${PAGTO[o.status_pagamento] || o.status_pagamento}</span></div><div><span>Entrega em</span><span>${esc(o.endereco_entrega)}</span></div>
        ${o.itens.map((i) => `<div><span>${i.quantidade}× ${esc(i.nome)}</span><span>${BRL(i.quantidade * i.preco_unitario)}</span></div>`).join('')}
        <div><span>Taxa de entrega (teste)</span><span>${BRL(o.taxa_entrega)}</span></div><div class="total"><span>Total</span><span>${BRL(o.total)}</span></div></div>
      <div class="acts" style="margin-top:20px"><a class="btn" href="#acompanhar">Acompanhar este pedido</a><a class="btn btn--ghost" href="#cardapio">Voltar ao cardápio</a></div>`;
  }
  function renderAcompanhar() { const o = state.ultimo; $('#t-num').value = o ? o.numero : $('#t-num').value; $('#t-tel').value = o ? o.telefone : $('#t-tel').value; $('#track-result').innerHTML = ''; }
  function mostrarPedido(o) {
    const box = $('#track-result');
    if (!o) { box.innerHTML = '<p class="msg msg--err">✕ Não encontramos um pedido com esse número e telefone. Confira os dados e tente de novo.</p>'; return; }
    const idx = STATUS.findIndex((s) => s[0] === o.status), cancel = o.status === 'cancelado';
    box.innerHTML = `<div class="panel"><h2 style="font-size:1.7rem">Pedido ${esc(o.numero)}</h2>
      <p class="mut">Simulação: neste protótipo as etapas são avançadas manualmente.</p>
      ${cancel ? '<p class="msg msg--err">✕ Pedido cancelado.</p>' : `<ol class="timeline">${STATUS.map(([, t, d], i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${i < idx ? '✓ ' : i === idx ? '● ' : '○ '}${t}${i === idx ? ' (etapa atual)' : ''}<br><span class="mut" style="font-weight:400">${d}</span></li>`).join('')}</ol>`}
      <p>Pagamento: ${PAGTO[o.status_pagamento] || o.status_pagamento}</p>
      ${cancel || idx >= 3 ? '' : `<div class="acts"><button class="btn" data-demo="avancar" data-num="${esc(o.numero)}">Avançar etapa (demo)</button><button class="btn btn--ghost" data-demo="cancelar" data-num="${esc(o.numero)}">Cancelar pedido (demo)</button></div>`}</div>`;
  }
  async function buscar(e) { e.preventDefault(); mostrarPedido(await API.buscarPedido($('#t-num').value, $('#t-tel').value)); }   // <<< reservada (C#)

  /* ---------- 8. ANIMAÇÕES ---------- */
  let io;
  function observar() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach((el) => el.classList.add('in')); return; }
    io = io || new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.15 });
    $$('.reveal:not(.in)').forEach((el) => io.observe(el));
  }

  /* ---------- 9. INÍCIO (eventos e carga inicial) ---------- */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return; const D = b.dataset;
    if (D.add) adicionar(D.add);
    else if (D.addq) adicionar(D.addq, Math.max(1, Math.min(20, parseInt($('#qt').value, 10) || 1)));
    else if (D.inc) mudar(D.inc, 1); else if (D.dec) mudar(D.dec, -1);
    else if (D.rm) { delete state.cart[D.rm]; salvarCarrinho(); rota(); }
    else if (D.filtro) { state.filtro = D.filtro; renderCardapio(); }
    else if (D.demo) mostrarPedido(await API.demoMudarStatus(D.num, D.demo));          // SÓ NO PROTÓTIPO
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'cep') aoDigitarCep(e); });
  $('#co-form').addEventListener('submit', enviarPedido);
  $('#track-form').addEventListener('submit', buscar);
  window.addEventListener('hashchange', rota);
  window.addEventListener('scroll', () => $('#site-header').classList.toggle('scrolled', window.scrollY > 8), { passive: true });

  (async () => {
    try { state.produtos = await API.listarProdutos(); }                              // <<< chamada reservada (C#)
    catch (err) { $('#conteudo').insertAdjacentHTML('afterbegin', '<p class="msg msg--err">✕ Não foi possível carregar o cardápio.</p>'); }
    salvarCarrinho(); rota();
  })();
})();
