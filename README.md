# 💸 Finanças Pessoais

Um sistema completo de controle financeiro pessoal com dashboard, extrato, investimentos e notificações inteligentes.

---

## 📋 Funcionalidades

### Dashboard
- Resumo mensal de saldo, receitas e despesas
- Card com total investido
- Gráfico de fluxo financeiro por mês (receitas vs despesas)
- Gráfico de pizza de gastos por categoria
- Gráfico de pizza de receitas por categoria
- Cadastro e gerenciamento de transações
- Cadastro e gerenciamento de categorias com soft delete
- Seletor de mês/ano para filtrar todos os dados

### Extrato
- Lista completa de transações do mês selecionado
- Filtro por tipo (receita/despesa) e por categoria
- Resumo de receitas, despesas e saldo do mês
- Edição e exclusão de transações via modal

### Investimentos
- Registro de aportes e retiradas em renda fixa e renda variável
- Cards por ativo com total investido e quantidade de cotas
- Histórico completo de operações
- Validação de saldo antes de registrar retiradas
- Integração com o card de investimentos no dashboard

### Notificações
- Alertas automáticos de saldo negativo
- Alertas de despesas maiores que receitas
- Alertas de concentração de carteira (diversificação)
- Metas mensais por categoria, economia, receita e investimento total
- Badge no menu com contagem de notificações não lidas

### Pesquisa Global
- Busca em transações, investimentos e categorias simultaneamente
- Busca por texto (categoria/nome do ativo)
- Busca por valor com margem de 10%
- Busca por data nos formatos `dd/mm/aaaa` e `aaaa-mm-dd`

---

## 🛠️ Tecnologias

### Frontend
- HTML, CSS e JavaScript puro (ES Modules)
- Chart.js para gráficos
- Arquitetura de SPA com carregamento dinâmico de páginas

### Backend
- Node.js com Express 5
- MySQL com mysql2
- dotenv para variáveis de ambiente

---

## 📁 Estrutura do Projeto

```
financas-pessoais/
├── back/
│   └── src/
│       ├── controllers/
│       │   ├── buscaController.js
│       │   ├── categoriasController.js
│       │   ├── investimentosController.js
│       │   ├── metasController.js
│       │   ├── notificacoesController.js
│       │   └── transacoesController.js
│       ├── database/
│       │   ├── connection.js
│       │   └── schema.sql
│       ├── routes/
│       │   ├── busca.js
│       │   ├── categorias.js
│       │   ├── investimentos.js
│       │   ├── metas.js
│       │   ├── notificacoes.js
│       │   └── transacoes.js
│       └── server.js
└── front/
    ├── assets/
    ├── pages/
    │   ├── dashboard.html
    │   ├── extrato.html
    │   ├── investimentos.html
    │   └── notificacoes.html
    ├── scripts/
    │   ├── pages/
    │   │   ├── dashboard.js
    │   │   ├── extrato.js
    │   │   ├── investimentos.js
    │   │   └── notificacoes.js
    │   ├── services/
    │   │   ├── busca.js
    │   │   ├── categorias.js
    │   │   ├── graficos.js
    │   │   ├── modal.js
    │   │   └── periodo.js
    │   └── main.js
    ├── styles/
    │   ├── layout/
    │   │   ├── busca.css
    │   │   ├── header.css
    │   │   └── main.css
    │   ├── pages/
    │   │   ├── dashboard.css
    │   │   ├── extrato.css
    │   │   ├── investimentos.css
    │   │   └── notificacoes.css
    │   └── geral.css
    └── index.html
```

---

## 🚀 Como rodar

### Pré-requisitos
- Node.js 18+
- MySQL

### 1. Clone o repositório

```bash
git clone https://github.com/metelrzx/financas-pessoais.git
cd financas-pessoais
```

### 2. Configure o banco de dados

Abra o MySQL e execute o arquivo de schema:

```bash
mysql -u root -p < back/src/database/schema.sql
```

### 3. Configure as variáveis de ambiente

Crie o arquivo `.env` dentro da pasta `back/`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=financas
```

### 4. Instale as dependências e suba o servidor

```bash
cd back
npm install
node src/server.js
```

### 5. Abra o frontend

Abra o arquivo `front/index.html` com um servidor local (ex: Live Server no VS Code) ou acesse diretamente pelo navegador.

---

## 🗄️ API — Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/transacoes?ano=&mes=` | Lista transações do mês |
| POST | `/api/transacoes` | Cria transação |
| PUT | `/api/transacoes/:id` | Edita transação (valor, tipo, categoria, data, descricao) |
| DELETE | `/api/transacoes/:id` | Remove transação |
| GET | `/api/transacoes/resumo?ano=&mes=` | Resumo financeiro do mês |
| GET | `/api/transacoes/fluxo?ano=` | Fluxo mensal do ano |
| GET | `/api/transacoes/categorias-gastos?ano=&mes=` | Gastos por categoria |
| GET | `/api/transacoes/receitas-categorias?ano=&mes=` | Receitas por categoria |
| GET | `/api/categorias` | Lista categorias ativas |
| POST | `/api/categorias` | Cria categoria |
| DELETE | `/api/categorias/:id` | Desativa categoria |
| GET | `/api/investimentos` | Lista aportes/retiradas |
| POST | `/api/investimentos` | Registra aporte ou retirada |
| DELETE | `/api/investimentos/:id` | Remove registro |
| GET | `/api/investimentos/resumo` | Resumo por ativo |
| GET | `/api/investimentos/total` | Total geral investido |
| GET | `/api/metas?ano=&mes=` | Lista metas do mês |
| POST | `/api/metas` | Cria meta |
| PUT | `/api/metas/:id` | Edita valor e descrição de uma meta |
| DELETE | `/api/metas/:id` | Remove meta |
| GET | `/api/notificacoes?ano=&mes=` | Lista notificações do mês |
| GET | `/api/notificacoes/gerar?ano=&mes=` | Gera e retorna notificações |
| PATCH | `/api/notificacoes/:id/lida` | Marca notificação como lida |
| PATCH | `/api/notificacoes/:id/toggle-lida` | Alterna estado lida/não lida |
| PATCH | `/api/notificacoes/todas/lidas` | Marca todas como lidas |
| GET | `/api/busca?q=` | Busca global |

### Cotações (Brapi + BCB)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cotacoes` | Cotação atual + ganho/perda de todos os ativos de renda variável |
| GET | `/api/cotacoes/cdi` | Taxa CDI atual (BCB) + simulador opcional de renda fixa |
| GET | `/api/cotacoes/resumo-carteira` | Valor de mercado total da carteira vs. custo |
| GET | `/api/cotacoes/:ticker/historico` | Histórico de preços diários desde o primeiro aporte |

---

## 📄 Licença

MIT — veja o arquivo [LICENSE](LICENSE) para mais detalhes.