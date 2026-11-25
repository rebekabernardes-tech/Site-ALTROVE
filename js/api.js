/* ==========================================================================
   ALTROVE · api.js · CAMADA DE DADOS  >>> ÁREA RESERVADA PARA C# + MySQL <<<
   --------------------------------------------------------------------------
   Todo acesso a dados do site passa por window.AltroveAPI. O app.js NUNCA
   fala com banco, localStorage de pedidos ou servidor por conta própria.

   COMO CONECTAR (quando for a hora):
     1. Suba a API em C# (ex.: ASP.NET Core) com os endpoints listados abaixo.
     2. Mude USE_MOCK para false e ajuste API_BASE.
     3. Em cada função, apague o bloco "MOCK" e use o bloco "RESERVADO".
   Os nomes dos campos seguem o bancoaltrove.sql (produtos, pedidos, itens_pedido).

   LACUNAS DO BANCO (decidir antes de integrar; ver Manual de Marca, seção 10):
     - clientes exige e-mail e senha, mas o checkout pede só nome e telefone.
     - pedidos não tem estado de pagamento (recebido x pago x pendente).
     - endereco_entrega é um campo único (sem CEP separado).
     - sem chave anti-duplicidade de pedido, sem campos de estação/destaque.
   Campos marcados "NÃO EXISTE NO SQL" abaixo são extras do protótipo.
   ========================================================================== */
window.AltroveAPI = (() => {
  'use strict';

  const USE_MOCK = true;          // <<< RESERVADO: false quando a API C# existir
  const API_BASE = '/api';        // <<< RESERVADO: URL base da API C#

  /* ---------- MOCK (DADOS FICTÍCIOS: preços, taxa e disponibilidade) ---------- */
  const IMG = {
    a: 'img/hero-torta-caramelizada.jpg',
    b: 'img/bolo-framboesa-hortela.jpg',
    c: 'img/bolo-chocolate-cereja.jpg',
    d: 'img/bolo-chocolate-framboesa.jpg',
    e: 'img/torta-frutas-vermelhas.jpg',
  };
  const DEMO = 'Textura e aroma serão descritos com a receita real. (texto de demonstração)';
  // [id, nome, tipo, estacao, preco_fatia, disponivel, imagem, descricao, tipo_a_confirmar]
  const LINHAS = [
    [1, 'Banoffe', 'torta', 'Outono', 16, 0, IMG.a, DEMO, 1],
    [2, 'Bolo Romeu e Julieta', 'bolo', 'Outono', 15, 0, IMG.b, 'Recheio de cream cheese com geleia de goiaba.'],
    [3, 'Torta bombom de uva', 'torta', 'Outono', 17, 0, IMG.c, 'Brigadeiro branco com uva e chocolate amargo.'],
    [4, 'Torta de morango', 'torta', 'Inverno', 16, 0, IMG.e, DEMO],
    [5, 'Bolo de morango e ninho', 'bolo', 'Inverno', 15, 0, IMG.d, DEMO],
    [6, 'Torta de maçã', 'torta', 'Inverno', 15, 0, IMG.a, DEMO],
    [7, 'Torta de limão', 'torta', 'Inverno', 15, 0, IMG.e, DEMO],
    [8, 'Bolo de laranja com chocolate meio amargo', 'bolo', 'Inverno', 15, 0, IMG.c, DEMO],
    [9, 'Torta de abacaxi com coco', 'torta', 'Primavera', 16, 1, IMG.a, DEMO],
    [10, 'Mousse de maracujá com chocolate', 'torta', 'Primavera', 17, 1, IMG.c, DEMO, 1],
    [11, 'Bolo de amora com cream cheese', 'bolo', 'Primavera', 16, 1, IMG.b, DEMO],
    [12, 'Torta de chocolate branco com geleia de jabuticaba', 'torta', 'Primavera', 18, 1, IMG.d, DEMO],
    [13, 'Bolo gelado de coco', 'bolo', 'Verão', 14, 1, IMG.b, DEMO],
    [14, 'Bolo de lichia com chantilly', 'bolo', 'Verão', 16, 0, IMG.d, DEMO],
    [15, 'Torta de ameixa e amêndoas', 'torta', 'Verão', 17, 0, IMG.e, DEMO],
  ];
  const MOCK_PRODUTOS = LINHAS.map(([id, nome, tipo, estacao, p, disp, img, desc, q]) => ({
    id, nome, tipo,                     // SQL: produtos.nome, produtos.tipo ('bolo' | 'torta')
    descricao: desc,                    // SQL: produtos.descricao
    imagem_url: img,                    // SQL: produtos.imagem_url
    preco_fatia: p,                     // SQL: produtos.preco_fatia
    disponivel: !!disp,                 // SQL: produtos.disponivel
    estacao,                            // NÃO EXISTE NO SQL (proposta)
    tipo_a_confirmar: !!q,              // NÃO EXISTE NO SQL (Banoffe e mousse de maracujá)
  }));

  // Regra fictícia de entrega: CEPs iniciados em 30 ou 31, taxa fixa. Substituir pela regra real.
  const MOCK_TAXA = 8;
  const mockCarregar = () => { try { return JSON.parse(localStorage.getItem('alt-orders')) || []; } catch (e) { return []; } };
  const mockSalvar = (l) => { try { localStorage.setItem('alt-orders', JSON.stringify(l)); } catch (e) { /* sem storage */ } };
  const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));   // simula latência de rede
  const digitos = (s) => String(s || '').replace(/\D/g, '');

  /* ---------- FUNÇÕES PÚBLICAS ---------- */

  /** GET /api/produtos  ->  [{ id, nome, tipo, descricao, imagem_url, preco_fatia, disponivel, ... }] */
  async function listarProdutos() {
    if (USE_MOCK) { await espera(); return MOCK_PRODUTOS.map((p) => ({ ...p })); }
    // RESERVADO (C#): return (await fetch(`${API_BASE}/produtos`)).json();
    throw new Error('Integração C# ainda não implementada: listarProdutos');
  }

  /** GET /api/produtos/{id}  ->  um produto (mesmo formato acima) ou null */
  async function obterProduto(id) {
    if (USE_MOCK) { await espera(80); return MOCK_PRODUTOS.find((p) => p.id === Number(id)) || null; }
    // RESERVADO (C#): return (await fetch(`${API_BASE}/produtos/${id}`)).json();
    throw new Error('Integração C# ainda não implementada: obterProduto');
  }

  /** GET /api/entrega?cep=XXXXXXXX  ->  { atendido: bool, taxa: number|null, mensagem: string }
   *  A regra real (área atendida e valor da taxa) é decisão da Altrove e deve viver no servidor. */
  async function consultarEntrega(cep) {
    if (USE_MOCK) {
      await espera(200);
      const ok = /^3[01]/.test(digitos(cep));
      return ok ? { atendido: true, taxa: MOCK_TAXA, mensagem: 'Entregamos neste CEP (regra de demonstração).' }
                : { atendido: false, taxa: null, mensagem: 'Fora da área de entrega de demonstração.' };
    }
    // RESERVADO (C#): return (await fetch(`${API_BASE}/entrega?cep=${digitos(cep)}`)).json();
    throw new Error('Integração C# ainda não implementada: consultarEntrega');
  }

  /** POST /api/pedidos
   *  Corpo: { nome, telefone, cep, endereco, numero, complemento, observacoes,
   *           forma_pagamento: 'pix'|'cartao'|'dinheiro',
   *           itens: [{ produto_id, quantidade }] }
   *  Resposta: { numero, status, status_pagamento, taxa_entrega, total, itens:[{nome,quantidade,preco_unitario}], endereco_entrega }
   *  O servidor DEVE recalcular preços, taxa e total (nunca confiar no navegador) e
   *  NUNCA receber dados de cartão (pagamento fica com o provedor escolhido). */
  async function criarPedido(dados) {
    if (USE_MOCK) {
      await espera(500);
      const taxa = MOCK_TAXA;
      const itens = dados.itens.map((i) => { const p = MOCK_PRODUTOS.find((x) => x.id === i.produto_id); return { nome: p.nome, quantidade: i.quantidade, preco_unitario: p.preco_fatia }; });
      const total = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0) + taxa;
      const pedido = {
        numero: 'DEMO-' + Math.floor(1000 + Math.random() * 9000),
        telefone: dados.telefone, status: 'recebido',                       // SQL: pedidos.status
        status_pagamento: dados.forma_pagamento === 'dinheiro' ? 'na_entrega' : 'pendente',   // NÃO EXISTE NO SQL
        forma_pagamento: dados.forma_pagamento, taxa_entrega: taxa, total, itens,
        endereco_entrega: `${dados.endereco}, ${dados.numero}${dados.complemento ? ', ' + dados.complemento : ''} (CEP ${dados.cep})`,
      };
      const lista = mockCarregar(); lista.unshift(pedido); mockSalvar(lista);
      return pedido;
    }
    // RESERVADO (C#): return (await fetch(`${API_BASE}/pedidos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })).json();
    throw new Error('Integração C# ainda não implementada: criarPedido');
  }

  /** GET /api/pedidos/{numero}?telefone=...  ->  pedido (formato de criarPedido) ou null.
   *  Status possíveis (SQL): recebido | em_preparo | a_caminho | entregue | cancelado */
  async function buscarPedido(numero, telefone) {
    if (USE_MOCK) {
      await espera(250);
      return mockCarregar().find((p) => p.numero === String(numero).trim().toUpperCase() && digitos(p.telefone) === digitos(telefone)) || null;
    }
    // RESERVADO (C#): return (await fetch(`${API_BASE}/pedidos/${numero}?telefone=${digitos(telefone)}`)).json();
    throw new Error('Integração C# ainda não implementada: buscarPedido');
  }

  /** SÓ NO PROTÓTIPO: avança ou cancela o status para avaliar a tela. NÃO existe em produção
   *  (na loja real, quem muda o status é a Altrove, via painel/admin protegido). */
  async function demoMudarStatus(numero, acao) {
    const ordem = ['recebido', 'em_preparo', 'a_caminho', 'entregue'];
    const lista = mockCarregar(); const p = lista.find((x) => x.numero === numero);
    if (p) { p.status = acao === 'cancelar' ? 'cancelado' : ordem[Math.min(ordem.indexOf(p.status) + 1, 3)]; mockSalvar(lista); }
    return p || null;
  }

  return { USE_MOCK, listarProdutos, obterProduto, consultarEntrega, criarPedido, buscarPedido, demoMudarStatus };
})();
