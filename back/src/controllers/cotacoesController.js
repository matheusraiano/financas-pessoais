import pool from '../database/connection.js';

const BRAPI_BASE = 'https://brapi.dev/api';
const BRAPI_TOKEN = process.env.BRAPI_TOKEN || null;
const BCB_CDI_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json';

// Cache em memória: { [ticker]: { data, expiry } }
const cachePrecos = {};
const cacheHistorico = {};
let cacheCdi = null;
let cacheCdiExpiry = 0;

const CACHE_TTL = 15 * 60 * 1000; // 15 minutos

function agora() { return Date.now(); }

function tokenHeader() {
    return BRAPI_TOKEN ? { Authorization: `Bearer ${BRAPI_TOKEN}` } : {};
}

// ─── CDI ───────────────────────────────────────────────────────────────────────

async function buscarCdi() {
    if (cacheCdi && agora() < cacheCdiExpiry) return cacheCdi;

    try {
        const res = await fetch(BCB_CDI_URL);
        const json = await res.json();
        // valor vem como taxa diária em %; converte pra anual: (1 + d)^252 - 1
        const diaria = parseFloat(json[0].valor) / 100;
        const anual = (Math.pow(1 + diaria, 252) - 1) * 100;
        cacheCdi = { diaria: parseFloat(json[0].valor), anual: parseFloat(anual.toFixed(2)) };
        cacheCdiExpiry = agora() + CACHE_TTL;
        return cacheCdi;
    } catch {
        return cacheCdi || { diaria: 0, anual: 0 };
    }
}

// ─── Cotação atual de um ticker ────────────────────────────────────────────────

async function buscarPrecoAtual(ticker) {
    const cached = cachePrecos[ticker];
    if (cached && agora() < cached.expiry) return cached.data;

    const url = `${BRAPI_BASE}/quote/${ticker}?dividends=true`;
    const res = await fetch(url, { headers: tokenHeader() });

    if (!res.ok) return null;

    const json = await res.json();
    const ativo = json.results?.[0];
    if (!ativo) return null;

    const ultDividendo = ativo.dividendsData?.cashDividends?.[0];
    const dy = ativo.priceEarnings ? null : null; // DY vem via módulo pago

    const data = {
        ticker: ativo.symbol,
        nome: ativo.shortName,
        preco: ativo.regularMarketPrice,
        variacaoDia: ativo.regularMarketChangePercent,
        abertura: ativo.regularMarketOpen,
        maxDia: ativo.regularMarketDayHigh,
        minDia: ativo.regularMarketDayLow,
        volumeDia: ativo.regularMarketVolume,
        ultimoDividendo: ultDividendo ? {
            valor: ultDividendo.rate,
            data: ultDividendo.paymentDate,
            tipo: ultDividendo.label
        } : null,
        atualizadoEm: ativo.regularMarketTime
    };

    cachePrecos[ticker] = { data, expiry: agora() + CACHE_TTL };
    return data;
}

// ─── Histórico de preços de um ticker ─────────────────────────────────────────

async function buscarHistoricoPrecos(ticker, startDate) {
    const chave = `${ticker}_${startDate}`;
    const cached = cacheHistorico[chave];
    if (cached && agora() < cached.expiry) return cached.data;

    const url = `${BRAPI_BASE}/quote/${ticker}?startDate=${startDate}&interval=1d`;
    const res = await fetch(url, { headers: tokenHeader() });

    if (!res.ok) return [];

    const json = await res.json();
    const historico = json.results?.[0]?.historicalDataPrice || [];

    // converte timestamps unix para datas legíveis
    const data = historico.map(p => ({
        data: new Date(p.date * 1000).toISOString().split('T')[0],
        fechamento: p.close,
        abertura: p.open,
        maximo: p.high,
        minimo: p.low,
        volume: p.volume
    })).filter(p => p.fechamento !== null);

    cacheHistorico[chave] = { data, expiry: agora() + CACHE_TTL };
    return data;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

/**
 * GET /api/cotacoes
 * Retorna cotação atual + cálculo de ganho/perda para todos os ativos de renda variável.
 */
export async function listarCotacoes(req, res) {
    try {
        // pega todos os ativos de renda variável com saldo > 0
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

        if (ativos.length === 0) {
            return res.json([]);
        }

        const resultados = await Promise.all(ativos.map(async (ativo) => {
            const cotacao = await buscarPrecoAtual(ativo.nome);

            if (!cotacao) {
                return {
                    ticker: ativo.nome,
                    cotacao_encontrada: false,
                    custo_total: Number(ativo.custo_total),
                    total_cotas: Number(ativo.total_cotas) || null,
                    preco_medio: ativo.total_cotas > 0
                        ? Number(ativo.custo_total) / Number(ativo.total_cotas)
                        : null
                };
            }

            const custoTotal = Number(ativo.custo_total);
            const totalCotas = Number(ativo.total_cotas) || null;
            const precoAtual = cotacao.preco;
            const precoMedio = totalCotas > 0 ? custoTotal / totalCotas : null;
            const valorAtual = totalCotas ? totalCotas * precoAtual : null;
            const ganhoReais = valorAtual !== null ? valorAtual - custoTotal : null;
            const ganhoPercent = ganhoReais !== null && custoTotal > 0
                ? (ganhoReais / custoTotal) * 100
                : null;

            // rendimento mensal estimado via último dividendo
            const rendimentoMensal = cotacao.ultimoDividendo && totalCotas
                ? totalCotas * cotacao.ultimoDividendo.valor
                : null;

            return {
                ticker: ativo.nome,
                cotacao_encontrada: true,
                nome: cotacao.nome,
                custo_total: custoTotal,
                total_cotas: totalCotas,
                preco_medio: precoMedio,
                preco_atual: precoAtual,
                variacao_dia: cotacao.variacaoDia,
                valor_atual: valorAtual,
                ganho_reais: ganhoReais,
                ganho_percent: ganhoPercent ? parseFloat(ganhoPercent.toFixed(2)) : null,
                ultimo_dividendo: cotacao.ultimoDividendo,
                rendimento_mensal_estimado: rendimentoMensal
                    ? parseFloat(rendimentoMensal.toFixed(2))
                    : null,
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
 * Retorna histórico de preços do ticker desde o primeiro aporte, com linha do preço médio.
 */
export async function historicoAtivo(req, res) {
    try {
        const ticker = req.params.ticker.toUpperCase();

        // pega data do primeiro aporte e custo médio
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

        // formata data para YYYY-MM-DD
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
 * Retorna a taxa CDI atual (diária e anual estimada) e simula rendimento de renda fixa.
 * Query params opcionais: valor, taxa (% do CDI, default 100), dias
 */
export async function taxaCdi(req, res) {
    try {
        const cdi = await buscarCdi();

        const { valor, taxa, dias } = req.query;

        let simulacao = null;
        if (valor && dias) {
            const valorNum = parseFloat(valor);
            const taxaPerc = parseFloat(taxa || 100) / 100;    // % do CDI
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
 * Soma valor de mercado de todos os ativos de renda variável + renda fixa para o total real da carteira.
 */
export async function resumoCarteira(req, res) {
    try {
        // renda variável: busca cotações
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

        // renda fixa: apenas custo (sem cotação de mercado)
        const [fixaRow] = await pool.query(`
            SELECT SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS custo_total
            FROM investimentos
            WHERE tipo = 'renda_fixa'
        `);

        let custoTotalVariavel = 0;
        let valorMercadoVariavel = 0;
        let ativosSemCotacao = 0;

        await Promise.all(ativosVar.map(async (ativo) => {
            custoTotalVariavel += Number(ativo.custo_total);
            const cotacao = await buscarPrecoAtual(ativo.nome);
            if (cotacao && ativo.total_cotas) {
                valorMercadoVariavel += Number(ativo.total_cotas) * cotacao.preco;
            } else {
                valorMercadoVariavel += Number(ativo.custo_total); // fallback: custo
                if (!cotacao) ativosSemCotacao++;
            }
        }));

        const custoFixa = Number(fixaRow[0].custo_total) || 0;
        const custoTotal = custoTotalVariavel + custoFixa;
        const valorMercadoTotal = valorMercadoVariavel + custoFixa;
        const ganhoReais = valorMercadoTotal - custoTotal;
        const ganhoPercent = custoTotal > 0
            ? parseFloat(((ganhoReais / custoTotal) * 100).toFixed(2))
            : 0;

        res.json({
            custo_total: parseFloat(custoTotal.toFixed(2)),
            valor_mercado: parseFloat(valorMercadoTotal.toFixed(2)),
            ganho_reais: parseFloat(ganhoReais.toFixed(2)),
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
