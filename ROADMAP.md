# Roadmap — Finanças Pessoais

Plano de implementação das melhorias planejadas. Cada item documenta exatamente o que criar, onde mexer e como a peça se encaixa no projeto atual.

---

## Índice

1. [Recorrência de Transações](#1-recorrência-de-transações)
2. [Orçamento por Categoria com Barra de Progresso](#2-orçamento-por-categoria-com-barra-de-progresso)
3. [Comparativo Mês a Mês no Extrato](#3-comparativo-mês-a-mês-no-extrato)
4. [Previsão de Saldo](#4-previsão-de-saldo)
5. [Exportar Extrato (CSV / PDF)](#5-exportar-extrato-csv--pdf)
6. [Meta de Alocação de Investimentos](#6-meta-de-alocação-de-investimentos)
7. [Projeção de Renda Passiva](#7-projeção-de-renda-passiva)
8. [Rentabilidade Comparada ao CDI](#8-rentabilidade-comparada-ao-cdi)
9. [Autenticação Simples por Senha](#9-autenticação-simples-por-senha)
10. [Paginação no Extrato](#10-paginação-no-extrato)
11. [Layout Responsivo para Mobile](#11-layout-responsivo-para-mobile)
12. [Tema Claro / Escuro](#12-tema-claro--escuro)
13. [PWA — Instalável no Celular](#13-pwa--instalável-no-celular)

---

## 1. Recorrência de Transações

**O que é:** marcar uma transação como recorrente (salário, aluguel, conta de luz). No início de cada mês, o sistema lança as recorrências automaticamente sem interação manual.

### Banco de dados

Adicionar coluna `recorrente` na tabela `transacoes` e criar tabela de templates:

```sql
-- migration a rodar no MySQL
ALTER TABLE transacoes ADD COLUMN recorrente BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recorrencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    descricao VARCHAR(255),
    valor DECIMAL(15,2) NOT NULL,
    tipo ENUM('receita', 'despesa') NOT NULL,
    categoria VARCHAR(100),
    dia_do_mes TINYINT NOT NULL DEFAULT 1,  -- dia 1–28 para lançar todo mês
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criada_em DATE NOT NULL
);
```

### Backend

**Criar** `back/src/controllers/recorrenciasController.js`:
- `listar` — `GET /api/recorrencias` → lista todas as recorrências ativas
- `criar` — `POST /api/recorrencias` → cria template (campos: descricao, valor, tipo, categoria, dia_do_mes)
- `toggleAtivo` — `PATCH /api/recorrencias/:id/toggle` → ativa/desativa
- `deletar` — `DELETE /api/recorrencias/:id`
- `processar` — `POST /api/recorrencias/processar?ano=&mes=` → lança as recorrências do mês se ainda não foram lançadas; verifica na tabela `transacoes` se já existe uma transação com `recorrente = TRUE` e mesma categoria+valor no mês antes de inserir (idempotente)

**Criar** `back/src/routes/recorrencias.js` e registrar em `server.js`:
```js
app.use('/api/recorrencias', recorrenciasRouter);
```

### Frontend

- Adicionar seção "Recorrências" no `front/pages/dashboard.html` abaixo do form de nova transação
- Criar `front/scripts/services/recorrencias.js` com as chamadas à API
- Em `front/scripts/pages/dashboard.js`, na função `inicializarDashboard`, chamar `POST /api/recorrencias/processar` com o mês atual logo no carregamento — assim as recorrências são lançadas automaticamente ao abrir o app no começo do mês
- Listar as recorrências ativas com botão de toggle e deletar

---

## 2. Orçamento por Categoria com Barra de Progresso

**O que é:** definir um limite de gasto mensal por categoria (ex: Alimentação → R$ 800). O dashboard mostra uma barra preenchendo conforme os gastos do mês avançam, ficando vermelha ao ultrapassar.

### Banco de dados

```sql
-- a tabela metas já existe e tem tipo = 'categoria'
-- não precisa de nova tabela — aproveitar a estrutura existente
-- o campo usado é: tipo = 'categoria', categoria, valor, mes, ano
```

A lógica já está parcialmente implementada nas notificações. Aqui é só a visualização.

### Backend

**Criar** endpoint em `back/src/controllers/metasController.js`:
- `progressoOrcamentos` — `GET /api/metas/progresso?ano=&mes=` → para cada meta do tipo `categoria` do mês, faz `SUM(valor)` das despesas da categoria e retorna: `{ meta, categoria, limite, gasto, percentual, ultrapassou }`

**Adicionar rota** em `back/src/routes/metas.js`:
```js
router.get('/progresso', progressoOrcamentos);
```
> ⚠️ Colocar antes de `router.get('/', listar)` para não conflitar com `/:id`.

### Frontend

- Adicionar seção "Orçamentos do Mês" no `front/pages/dashboard.html`
- Em `front/scripts/pages/dashboard.js`, dentro de `atualizarTudo()`, chamar `carregarOrcamentos(ano, mes)`
- Renderizar cada orçamento como:

```html
<div class="orcamento-item">
  <div class="orcamento-header">
    <span>Alimentação</span>
    <span>R$ 650 / R$ 800</span>
  </div>
  <div class="orcamento-barra">
    <div class="orcamento-progresso" style="width: 81%; background: #ff4d6d"></div>
  </div>
</div>
```

- Cor da barra: verde (`#00ff88`) até 80%, amarela (`#ffd700`) de 80% a 100%, vermelha (`#ff4d6d`) acima de 100%
- Adicionar estilos em `front/styles/pages/dashboard.css`

---

## 3. Comparativo Mês a Mês no Extrato

**O que é:** no resumo do extrato (receitas / despesas / saldo), mostrar a variação em relação ao mês anterior. Ex: "Despesas R$ 2.400 ▲ 12% vs mês anterior".

### Backend

Nenhuma mudança de schema necessária.

**Adicionar função** `resumoComparativo` em `back/src/controllers/transacoesController.js`:
- `GET /api/transacoes/resumo-comparativo?ano=&mes=` → busca o resumo do mês atual e do mês anterior em uma só query e retorna ambos com a variação percentual calculada

```sql
SELECT
    MONTH(data) AS mes,
    SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
    SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
FROM transacoes
WHERE (YEAR(data) = ? AND MONTH(data) = ?)
   OR (YEAR(data) = ? AND MONTH(data) = ?)  -- mês anterior
GROUP BY MONTH(data)
```

**Adicionar rota** em `back/src/routes/transacoes.js`:
```js
router.get('/resumo-comparativo', resumoComparativo);
```

### Frontend

- Em `front/scripts/pages/extrato.js`, substituir a chamada a `carregarResumo` pela nova `carregarResumoComparativo`
- Nos cards de receitas/despesas/saldo em `front/pages/extrato.html`, adicionar uma `<span>` abaixo do valor para o indicador:

```html
<span id="ext-receitas-var" class="variacao-mes"></span>
```

- Renderizar `▲ 12%` em verde ou `▼ 8%` em vermelho conforme o contexto (despesa subindo é vermelho, receita subindo é verde)
- Adicionar estilo `.variacao-mes` em `front/styles/pages/extrato.css`

---

## 4. Previsão de Saldo

**O que é:** com base nas recorrências ativas (feature 1), calcular quanto o saldo deve fechar no fim do mês atual e mostrar no dashboard.

> ⚠️ Depende da feature 1 (Recorrências) estar implementada.

### Backend

**Adicionar função** `previsaoMes` em `back/src/controllers/recorrenciasController.js`:
- `GET /api/recorrencias/previsao?ano=&mes=` → pega o saldo atual do mês + soma as recorrências que ainda não foram lançadas no mês (dia_do_mes > hoje) e retorna `{ saldo_atual, receitas_previstas, despesas_previstas, saldo_previsto }`

### Frontend

- Adicionar card "Saldo Previsto" na seção de cards do `front/pages/dashboard.html` (junto com os 4 existentes — vira 5 ou reorganiza em dois grids)
- Em `dashboard.js`, dentro de `atualizarTudo()`, chamar o endpoint e preencher o card
- Exibir com ícone de relógio ou label "estimado" para diferenciar do saldo real

---

## 5. Exportar Extrato (CSV / PDF)

**O que é:** botão no extrato para baixar as transações do mês filtrado.

### CSV (sem dependência)

**Adicionar endpoint** `GET /api/transacoes/exportar?ano=&mes=&tipo=&categoria=&formato=csv` em `back/src/controllers/transacoesController.js`:
- Monta o CSV no servidor com `Content-Type: text/csv` e `Content-Disposition: attachment; filename="extrato-MM-YYYY.csv"`
- Colunas: `Data,Categoria,Descrição,Tipo,Valor`
- Adicionar rota em `back/src/routes/transacoes.js`

### PDF (via biblioteca)

Instalar no backend:
```bash
cd back && npm install pdfkit
```

**Adicionar função** `exportarPdf` no mesmo controller:
- Usa `pdfkit` para gerar um PDF com cabeçalho, tabela de transações e totais
- Rota: `GET /api/transacoes/exportar?formato=pdf&ano=&mes=`

### Frontend

- Adicionar botões "⬇ CSV" e "⬇ PDF" no `front/pages/extrato.html`, junto ao contador de transações
- Em `front/scripts/pages/extrato.js`, os botões fazem `window.open(url)` com os parâmetros do período e filtros ativos — o browser abre o download direto

---

## 6. Meta de Alocação de Investimentos

**O que é:** você define o percentual alvo por ativo (ex: MXRF11 → 40%, CDB Banco X → 60%). O sistema compara com a alocação atual e mostra quanto comprar/vender para rebalancear.

### Banco de dados

```sql
CREATE TABLE IF NOT EXISTS alocacoes_alvo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,         -- nome do ativo (igual ao campo em investimentos)
    percentual_alvo DECIMAL(5,2) NOT NULL,  -- ex: 40.00
    UNIQUE KEY unico_ativo (nome)
);
```

### Backend

**Criar** `back/src/controllers/alocacoesController.js`:
- `listar` — `GET /api/alocacoes` → retorna alocações alvo
- `salvar` — `POST /api/alocacoes` → cria ou atualiza (upsert por nome)
- `deletar` — `DELETE /api/alocacoes/:id`
- `rebalanceamento` — `GET /api/alocacoes/rebalanceamento` → cruza as alocações alvo com os dados reais de `cotacoesController.resumoCarteira`, calcula o valor atual de cada ativo, compara com o alvo e retorna: `{ ativo, percentual_alvo, percentual_atual, valor_atual, valor_alvo, diferenca_reais, acao: 'comprar'|'vender'|'ok' }`

**Criar** `back/src/routes/alocacoes.js` e registrar em `server.js`.

### Frontend

- Adicionar seção "Rebalanceamento" na página `front/pages/investimentos.html`, abaixo do bloco de rentabilidade
- Tabela com colunas: Ativo | Alvo % | Atual % | Valor Atual | Diferença | Ação
- Células de ação coloridas: verde para "ok", roxo para "comprar", vermelho para "vender"
- Form para definir/editar os percentuais alvo
- Lógica em `front/scripts/pages/investimentos.js`

---

## 7. Projeção de Renda Passiva

**O que é:** com base nos dividendos mensais de cada FII/ativo, projetar quanto você vai receber nos próximos 12 meses mantendo a posição atual.

### Backend

**Adicionar função** `projecaoRendaPassiva` em `back/src/controllers/cotacoesController.js`:
- `GET /api/cotacoes/renda-passiva` → para cada ativo de renda variável com cotas, busca o último dividendo via Yahoo Finance (já existe a função `buscarUltimoDividendo`) e calcula `cotas × dividendo × 12` para a projeção anual
- Retorna: `{ ativos: [{ ticker, cotas, ultimo_dividendo, mensal, anual }], total_mensal, total_anual }`

**Adicionar rota** em `back/src/routes/cotacoes.js`:
```js
router.get('/renda-passiva', projecaoRendaPassiva);
```

### Frontend

- Adicionar card "Renda Passiva Estimada" na página `front/pages/investimentos.html`
- Mostrar total mensal estimado em destaque e tabela por ativo
- Em `front/scripts/pages/investimentos.js`, chamar dentro de `atualizarTudo()`

---

## 8. Rentabilidade Comparada ao CDI

**O que é:** no card de cada ativo de renda variável, mostrar se a rentabilidade desde o aporte está acima ou abaixo do CDI no mesmo período.

### Backend

**Adicionar lógica** em `buscarPrecoAtual` ou numa função nova em `cotacoesController.js`:
- `GET /api/cotacoes/:ticker/vs-cdi` → recebe o ticker, pega a data do primeiro aporte, calcula:
  - Rentabilidade real: `(preco_atual - preco_medio) / preco_medio * 100`
  - Rentabilidade CDI no mesmo período: busca o CDI acumulado via BCB (`api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=DD/MM/YYYY`) e compõe a taxa diária
  - Retorna ambas e o resultado: `acima_do_cdi: true/false`

### Frontend

- No card de cada ativo em `front/scripts/pages/investimentos.js`, adicionar linha na seção `.card-ativo-rentabilidade`:

```
Vs. CDI (desde o aporte): +2,3pp acima
```

- Verde se acima, vermelho se abaixo, `pp` = pontos percentuais

---

## 9. Autenticação Simples por Senha

**O que é:** middleware no backend que exige um header com senha fixa antes de processar qualquer rota. Protege a API se o servidor for acessível na rede local ou internet.

### Backend

**Adicionar variável** no `back/.env`:
```
APP_PASSWORD=sua_senha_aqui
```

**Criar** `back/src/middleware/auth.js`:
```js
export function autenticar(req, res, next) {
    const senha = req.headers['x-app-password'];
    if (senha !== process.env.APP_PASSWORD) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }
    next();
}
```

**Registrar** em `back/src/server.js` antes das rotas:
```js
import { autenticar } from './middleware/auth.js';
app.use(autenticar);
```

### Frontend

**Criar** `front/scripts/services/auth.js`:
- Salva a senha no `sessionStorage`
- Exporta uma função `getHeaders()` que todos os `fetch` passam como segundo argumento: `{ headers: { 'x-app-password': senha } }`

**Criar** `front/pages/login.html` com form de senha simples.

**Modificar** `front/scripts/main.js`:
- Na inicialização, verificar se a senha está no `sessionStorage`; se não, mostrar o form de login antes de carregar qualquer página

**Modificar todos os `fetch`** nos arquivos de serviços e páginas para passar `getHeaders()` — são os arquivos:
- `front/scripts/services/categorias.js`
- `front/scripts/services/graficos.js`
- `front/scripts/services/busca.js`
- `front/scripts/services/modal.js`
- `front/scripts/services/notificacoes.js`
- `front/scripts/pages/dashboard.js`
- `front/scripts/pages/extrato.js`
- `front/scripts/pages/investimentos.js`
- `front/scripts/pages/notificacoes.js`

---

## 10. Paginação no Extrato

**O que é:** carregar as transações em páginas de 50, com botões "Próxima" / "Anterior", para não sobrecarregar quando houver muitos meses acumulados.

### Backend

**Modificar** `listar` em `back/src/controllers/transacoesController.js`:
- Aceitar query params `limite` (default 50) e `offset` (default 0)
- Adicionar `LIMIT ? OFFSET ?` na query SQL
- Adicionar endpoint `GET /api/transacoes/total?ano=&mes=` que retorna só o `COUNT(*)` para o frontend saber o total de páginas

### Frontend

**Modificar** `front/scripts/pages/extrato.js`:
- Adicionar variáveis de estado `let paginaAtual = 0` e `const POR_PAGINA = 50`
- Passar `limite=50&offset=paginaAtual*50` no fetch de transações
- Renderizar controles de paginação abaixo da lista em `front/pages/extrato.html`
- Resetar `paginaAtual = 0` ao trocar mês ou filtro

---

## 11. Layout Responsivo para Mobile

**O que é:** os grids de múltiplas colunas quebram em telas pequenas. Adicionar media queries para o app funcionar bem em celular.

### CSS — pontos de quebra a corrigir

Todos os ajustes ficam nos arquivos existentes de CSS. Adicionar no final de cada um:

**`front/styles/layout/main.css`**
- `.perfil-main` (aside + conteúdo): de `grid` para `flex-direction: column` abaixo de 768px
- `.perfil-aside`: largura 100%, nav horizontal em vez de vertical

**`front/styles/pages/dashboard.css`**
- `.cards-financeiros`: de `repeat(4, 1fr)` para `repeat(2, 1fr)` abaixo de 768px, `1fr` abaixo de 480px
- `.dashboard-grid`: de `2fr 1fr 1fr` para coluna única abaixo de 900px
- `.rent-carteira-grid`: de `repeat(4, 1fr)` para `repeat(2, 1fr)` abaixo de 600px

**`front/styles/pages/extrato.css`**
- `.extrato-resumo`: de `repeat(3, 1fr)` para `repeat(2, 1fr)` abaixo de 600px, `1fr` abaixo de 400px
- `.extrato-filtros`: `flex-direction: column` abaixo de 600px

**`front/styles/pages/investimentos.css`**
- `.inv-resumo-geral`: de `repeat(3, 1fr)` para coluna única abaixo de 600px
- `.inv-grid`: de `2fr 1fr` para coluna única abaixo de 900px
- `.inv-cdi-bloco`: de `1fr 2fr` para coluna única abaixo de 768px
- `.simulador-resultado`: de `repeat(3, 1fr)` para `1fr` abaixo de 500px

**`front/styles/pages/notificacoes.css`**
- `.notif-grid`: de `2fr 1fr` para coluna única abaixo de 900px

**`front/styles/layout/header.css`**
- `.header-center input`: reduzir largura ou ocultar o ícone de busca abaixo de 480px

---

## 12. Tema Claro / Escuro

**O que é:** toggle no header que alterna entre o tema escuro atual e um tema claro, salvando a preferência no `localStorage`.

### CSS

**Modificar** `front/styles/geral.css`:
- Mover todas as cores hardcoded para variáveis CSS no `:root` (já tem algumas como `--roxo`, `--fundoPreto`)
- Criar seletor `[data-tema="claro"]` no `body` com as variáveis sobrescritas:

```css
[data-tema="claro"] {
    --bg-principal: #f5f5f5;
    --bg-card: #ffffff;
    --texto-principal: #111111;
    --texto-secundario: #555555;
    --borda: rgba(0,0,0,0.08);
    /* etc. */
}
```

- Substituir todas as cores fixas (`#111`, `#0d0d0d`, `black`, `white`, `#888`, `#555`) nos CSS de páginas e layout pelas variáveis equivalentes

### JavaScript

**Criar** `front/scripts/services/tema.js`:
```js
export function inicializarTema() {
    const salvo = localStorage.getItem('tema') || 'escuro';
    document.body.dataset.tema = salvo;
}

export function toggleTema() {
    const atual = document.body.dataset.tema;
    const novo = atual === 'escuro' ? 'claro' : 'escuro';
    document.body.dataset.tema = novo;
    localStorage.setItem('tema', novo);
}
```

**Modificar** `front/index.html`:
- Adicionar botão de toggle no header (ex: `🌙` / `☀️`)

**Modificar** `front/scripts/main.js`:
- Importar e chamar `inicializarTema()` no topo
- Ligar o botão ao `toggleTema()`

---

## 13. PWA — Instalável no Celular

**O que é:** adicionar `manifest.json` e um service worker básico para tornar o app instalável na tela inicial do celular/PC e permitir funcionamento offline parcial (páginas em cache).

> ⚠️ Recomendado implementar após o layout responsivo (feature 11) estar pronto.

### Arquivos a criar

**`front/manifest.json`**:
```json
{
    "name": "Finanças Pessoais",
    "short_name": "Finanças",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#000000",
    "theme_color": "#800080",
    "icons": [
        { "src": "assets/images/logo.png", "sizes": "192x192", "type": "image/png" },
        { "src": "assets/images/logo.png", "sizes": "512x512", "type": "image/png" }
    ]
}
```

**`front/sw.js`** (service worker):
- Estratégia cache-first para assets estáticos (HTML, CSS, JS, imagens)
- Estratégia network-first para chamadas à API (`/api/*`) — tenta a rede, cai no cache se offline
- Versionar o cache (`const CACHE = 'v1'`) para facilitar invalidação futura

### HTML

**Modificar** `front/index.html`:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#800080">
```

**Modificar** `front/scripts/main.js`:
```js
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
```

---

## Ordem sugerida de implementação

| Prioridade | Feature | Motivo |
|---|---|---|
| 1 | Autenticação simples (#9) | Segurança básica antes de expor o app |
| 2 | Recorrências (#1) | Elimina trabalho manual todo mês |
| 3 | Orçamento por categoria (#2) | Visualização imediata do controle financeiro |
| 4 | Comparativo mês a mês (#3) | Baixo esforço, alto valor informativo |
| 5 | Exportar extrato (#5) | Útil para imposto de renda |
| 6 | Meta de alocação (#6) | Complementa o módulo de investimentos |
| 7 | Projeção de renda passiva (#7) | Depende só do que já está pronto |
| 8 | Rentabilidade vs CDI (#8) | Complementa o módulo de investimentos |
| 9 | Previsão de saldo (#4) | Depende das recorrências (#1) |
| 10 | Paginação no extrato (#10) | Necessário só quando houver volume |
| 11 | Layout responsivo (#11) | Base para o PWA |
| 12 | Tema claro/escuro (#12) | Polimento |
| 13 | PWA (#13) | Depende do responsivo (#11) |
