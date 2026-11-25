import pool from '../database/connection.js';

// Brapi: cotação atual (token obrigatório no plano gratuito)
const BRAPI_BASE = 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;
const BRAPI_HEADERS = BRAPI_TOKEN ? { Authorization: `Bearer ${BRAPI_TOKEN}` } : {};

// Yahoo Finance: histórico longo + dividendos (sem token)
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

// BCB: CDI
const BCB_CDI_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json';

// Cache em memória
const cache = {};
const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function agora() { return Date.now(); }
function doCache(chave, data) { cache[chave] = { data, expiry: agora() + CACHE_TTL }; return data; }
function getCache(chave) { const c = cache[chave]; return c && agora() < c.expiry ? c.data : null; }

// Yahoo usa sufixo .SA para ativos da B3
function tickerYahoo(ticker) {
    return ticker.includes('.') || ticker.startsWith('^') ? ticker : `${ticker}.SA`;
}

// ─── CDI (BCB) ────────────────────────────────────────────────────────────────

async function buscarCdi() {
    const cached = getCache('cdi');
    if (cached) return cached;

    try {
        const res = await fetch(BCB_CDI_URL);
        const json = await res.json();
        const diaria = parseFloat(json[0].valor);
        const anual = (Math.pow(1 + diaria / 100, 252) - 1) * 100;
        return doCache('cdi', { diaria, anual: parseFloat(anual.toFixed(2)) });
    } catch {
        return getCache('cdi') || { diaria: 0, anual: 0 };
    }
}

// ─── Cotação atual (Brapi) ────────────────────────────────────────────────────

async function buscarPrecoAtual(ticker) {
    const chave = `preco_${ticker}`;
    const cached = getCache(chave);
    if (cached) return cached;

    try {
        const url = `${BRAPI_BASE}/quote/${ticker}`;
        const res = await fetch(url, { headers: BRAPI_HEADERS });
        if (!res.ok) return null;

        const json = await res.json();
        const r = json.results?.[0];
        if (!r || !r.regularMarketPrice) return null;

        return doCache(chave, {
            ticker,
            nome: r.longName || r.shortName || ticker,
            preco: r.regularMarketPrice,
            variacaoDia: parseFloat((r.regularMarketChangePercent || 0).toFixed(2)),
            abertura: r.regularMarketOpen,
            maxDia: r.regularMarketDayHigh,
            minDia: r.regularMarketDayLow,
            volumeDia: r.regularMarketVolume,
            atualizadoEm: r.regularMarketTime
        });
    } catch {
        return null;
    }
}

// ─── Dividendos (Yahoo Finance) ───────────────────────────────────────────────

async function buscarUltimoDividendo(ticker) {
    const chave = `div_${ticker}`;
    const cached = getCache(chave);
    if (cached) return cached;

    try {
        const symbol = tickerYahoo(ticker);
        // range=1y é suficiente para pegar dividendos recentes
        const url = `${YAHOO_BASE}/${symbol}?interval=1mo&range=1y&events=dividends`;
        const res = await fetch(url, { headers: YAHOO_HEADERS });
        if (!res.ok) return doCache(chave, null);

        const json = await res.json();
        const divs = json.chart?.result?.[0]?.events?.dividends;
        if (!divs) return doCache(chave, null);

        const ultimo = Object.values(divs).sort((a, b) => b.date - a.date)[0];
        return doCache(chave, {
            valor: ultimo.amount,
            data: new Date(ultimo.date * 1000).toISOString().split('T')[0]
        });
    } catch {
        return doCache(chave, null);
    }
}

// ─── Histórico de preços (Yahoo Finance) ─────────────────────────────────────

async function buscarHistoricoPrecos(ticker, startDate) {
    const chave = `hist_${ticker}_${startDate}`;
    const cached = getCache(chave);
    if (cached) return cached;

    try {
        const symbol = tickerYahoo(ticker);
        const period1 = Math.floor(new Date(startDate).getTime() / 1000);
        const period2 = Math.floor(agora() / 1000);
        const url = `${YAHOO_BASE}/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;

        const res = await fetch(url, { headers: YAHOO_HEADERS });
        if (!res.ok) return [];

        const json = await res.json();
        const result = json.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.adjclose?.[0]?.adjclose || [];

        const historico = timestamps
            .map((ts, i) => ({
                data: new Date(ts * 1000).toISOString().split('T')[0],
                fechamento: closes[i] ?? null
            }))
            .filter(p => p.fechamento !== null && p.fechamento > 0);

        return doCache(chave, historico);
    } catch {
        return [];
    }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/cotacoes
 * Cotação atual (Brapi) + dividendos (Yahoo) + cálculo de ganho/perda por ativo.
 */
export async function listarCotacoes(req, res) {
    try {
        const [ativos] = await pool.query(`
            SELECT
                nome,
                SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS custo_total,
                SUM(CASE WHEN operacao = 'aporte' THEN cotas ELSE -cotas END) AS total_cotas
            FROM investimentos
            WHERE tipo = 'renda_variavel'
            GROUP BY nome
            HAVING custo_total > 0
        `);

        if (ativos.length === 0) return res.json([]);

        const resultados = await Promise.all(ativos.map(async (ativo) => {
            const custoTotal = Number(ativo.custo_total);
            const totalCotas = Number(ativo.total_cotas) || null;
            const precoMedio = totalCotas > 0 ? custoTotal / totalCotas : null;

            // cotação e dividendo em paralelo
            const [cotacao, ultimoDividendo] = await Promise.all([
                buscarPrecoAtual(ativo.nome),
                buscarUltimoDividendo(ativo.nome)
            ]);

            if (!cotacao) {
                return {
                    ticker: ativo.nome,
                    cotacao_encontrada: false,
                    custo_total: custoTotal,
                    total_cotas: totalCotas,
                    preco_medio: precoMedio ? parseFloat(precoMedio.toFixed(2)) : null
                };
            }

            const precoAtual = cotacao.preco;
            const valorAtual = totalCotas ? parseFloat((totalCotas * precoAtual).toFixed(2)) : null;
            const ganhoReais = valorAtual !== null ? parseFloat((valorAtual - custoTotal).toFixed(2)) : null;
            const ganhoPercent = ganhoReais !== null && custoTotal > 0
                ? parseFloat(((ganhoReais / custoTotal) * 100).toFixed(2))
                : null;
            const rendimentoMensal = ultimoDividendo && totalCotas
                ? parseFloat((totalCotas * ultimoDividendo.valor).toFixed(2))
                : null;

            return {
                ticker: ativo.nome,
                cotacao_encontrada: true,
                nome: cotacao.nome,
                custo_total: custoTotal,
                total_cotas: totalCotas,
                preco_medio: precoMedio ? parseFloat(precoMedio.toFixed(2)) : null,
                preco_atual: precoAtual,
                variacao_dia: cotacao.variacaoDia,
                valor_atual: valorAtual,
                ganho_reais: ganhoReais,
                ganho_percent: ganhoPercent,
                ultimo_dividendo: ultimoDividendo,
                rendimento_mensal_estimado: rendimentoMensal,
                atualizadoEm: cotacao.atualizadoEm
            };
        }));

        res.json(resultados);
    } catch (e) {
        console.error('Erro ao listar cotações:', e);
        res.status(500).json({ erro: 'Erro interno ao buscar cotações' });
    }
}

/**
 * GET /api/cotacoes/:ticker/historico
 * Histórico de preços (Yahoo) desde o primeiro aporte + preço médio.
 */
export async function historicoAtivo(req, res) {
    try {
        const ticker = req.params.ticker.toUpperCase();

        const [rows] = await pool.query(`
            SELECT
                MIN(data) AS primeiro_aporte,
                SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS custo_total,
                SUM(CASE WHEN operacao = 'aporte' THEN cotas ELSE -cotas END) AS total_cotas
            FROM investimentos
            WHERE nome = ? AND tipo = 'renda_variavel'
        `, [ticker]);

        if (!rows[0].primeiro_aporte) {
            return res.status(404).json({ erro: 'Ativo não encontrado' });
        }

        const { primeiro_aporte, custo_total, total_cotas } = rows[0];
        const precoMedio = total_cotas > 0
            ? parseFloat((Number(custo_total) / Number(total_cotas)).toFixed(2))
            : null;

        const startDate = new Date(primeiro_aporte).toISOString().split('T')[0];
        const historico = await buscarHistoricoPrecos(ticker, startDate);

        res.json({
            ticker,
            preco_medio: precoMedio,
            custo_total: Number(custo_total),
            total_cotas: Number(total_cotas),
            historico
        });
    } catch (e) {
        console.error('Erro ao buscar histórico:', e);
        res.status(500).json({ erro: 'Erro interno ao buscar histórico' });
    }
}

/**
 * GET /api/cotacoes/cdi
 * Taxa CDI atual (BCB) + simulador opcional de renda fixa.
 * Query: valor, taxa (% do CDI, default 100), dias
 */
export async function taxaCdi(req, res) {
    try {
        const cdi = await buscarCdi();
        const { valor, taxa, dias } = req.query;

        let simulacao = null;
        if (valor && dias) {
            const valorNum = parseFloat(valor);
            const taxaPerc = parseFloat(taxa || 100) / 100;
            const diasNum = parseInt(dias);
            const taxaDiariaEfetiva = (cdi.diaria / 100) * taxaPerc;
            const valorFinal = valorNum * Math.pow(1 + taxaDiariaEfetiva, diasNum);
            const rendimento = valorFinal - valorNum;

            simulacao = {
                valor_inicial: valorNum,
                taxa_cdi_percent: parseFloat(taxa || 100),
                dias: diasNum,
                valor_final: parseFloat(valorFinal.toFixed(2)),
                rendimento: parseFloat(rendimento.toFixed(2)),
                rendimento_percent: parseFloat(((rendimento / valorNum) * 100).toFixed(2))
            };
        }

        res.json({ cdi, simulacao });
    } catch (e) {
        console.error('Erro ao buscar CDI:', e);
        res.status(500).json({ erro: 'Erro interno ao buscar CDI' });
    }
}

/**
 * GET /api/cotacoes/resumo-carteira
 * Valor de mercado total (renda variável via Brapi + renda fixa por custo).
 */
export async function resumoCarteira(req, res) {
    try {
        const [ativosVar] = await pool.query(`
            SELECT
                nome,
                SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS custo_total,
                SUM(CASE WHEN operacao = 'aporte' THEN cotas ELSE -cotas END) AS total_cotas
            FROM investimentos
            WHERE tipo = 'renda_variavel'
            GROUP BY nome
            HAVING custo_total > 0
        `);

        const [fixaRow] = await pool.query(`
            SELECT SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS custo_total
            FROM investimentos
            WHERE tipo = 'renda_fixa'
        `);

        let custoTotalVariavel = 0;
        let valorMercadoVariavel = 0;
        let ativosSemCotacao = 0;

        await Promise.all(ativosVar.map(async (ativo) => {
            const custo = Number(ativo.custo_total);
            const cotas = Number(ativo.total_cotas);
            custoTotalVariavel += custo;

            const cotacao = await buscarPrecoAtual(ativo.nome);
            if (cotacao && cotas > 0) {
                valorMercadoVariavel += cotas * cotacao.preco;
            } else {
                valorMercadoVariavel += custo;
                if (!cotacao) ativosSemCotacao++;
            }
        }));

        const custoFixa = Number(fixaRow[0].custo_total) || 0;
        const custoTotal = custoTotalVariavel + custoFixa;
        const valorMercadoTotal = valorMercadoVariavel + custoFixa;
        const ganhoReais = parseFloat((valorMercadoTotal - custoTotal).toFixed(2));
        const ganhoPercent = custoTotal > 0
            ? parseFloat(((ganhoReais / custoTotal) * 100).toFixed(2))
            : 0;

        res.json({
            custo_total: parseFloat(custoTotal.toFixed(2)),
            valor_mercado: parseFloat(valorMercadoTotal.toFixed(2)),
            ganho_reais: ganhoReais,
            ganho_percent: ganhoPercent,
            ativos_sem_cotacao: ativosSemCotacao,
            renda_fixa_custo: parseFloat(custoFixa.toFixed(2)),
            renda_variavel_custo: parseFloat(custoTotalVariavel.toFixed(2)),
            renda_variavel_mercado: parseFloat(valorMercadoVariavel.toFixed(2))
        });
    } catch (e) {
        console.error('Erro ao calcular resumo da carteira:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular resumo da carteira' });
    }
}
