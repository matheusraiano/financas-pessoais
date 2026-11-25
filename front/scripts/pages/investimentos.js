import { formatarData, formatarValor } from '../services/utils.js';
import { getPeriodo } from '../services/periodo.js';
import { verificarBadgeNotificacoes } from '../services/notificacoes.js';
import { API } from '../services/config.js';

let filtroTipo = 'todos';
let graficoEvolucao = null;

export async function inicializarInvestimentos(cleanupFunctions) {
    document.getElementById('inv-data').value = new Date().toISOString().split('T')[0];

    await atualizarTudo();

    // filtros
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroTipo = btn.dataset.tipo;
            carregarAtivos();
            carregarAportes();
        });
    });

    // form novo aporte
    document.getElementById('form-aporte').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Registrando...';

        const res = await fetch(`${API}/investimentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: document.getElementById('inv-nome').value,
                tipo: document.getElementById('inv-tipo').value,
                operacao: document.getElementById('inv-operacao').value,
                valor: document.getElementById('inv-valor').value,
                cotas: document.getElementById('inv-cotas').value || null,
                data: document.getElementById('inv-data').value
            })
        });

        if (!res.ok) {
            const erro = await res.json();
            alert(erro.erro || 'Erro ao registrar aporte.');
        } else {
            e.target.reset();
            document.getElementById('inv-data').value = new Date().toISOString().split('T')[0];
            await atualizarTudo();
        }

        btn.disabled = false;
        btn.textContent = 'Registrar';
    });

    // simulador CDI
    document.getElementById('btn-simular').addEventListener('click', async () => {
        const valor = document.getElementById('sim-valor').value;
        const taxa = document.getElementById('sim-taxa').value;
        const dias = document.getElementById('sim-dias').value;

        if (!valor || !dias) return;

        const params = new URLSearchParams({ valor, taxa: taxa || 100, dias });
        const res = await fetch(`${API}/cotacoes/cdi?${params}`);
        const { simulacao } = await res.json();

        if (!simulacao) return;

        document.getElementById('sim-valor-final').textContent = formatarValor(simulacao.valor_final);
        document.getElementById('sim-rendimento').textContent = formatarValor(simulacao.rendimento);
        document.getElementById('sim-rentabilidade').textContent = `${simulacao.rendimento_percent}%`;
        document.getElementById('simulador-resultado').style.display = 'grid';
    });

    // fechar gráfico
    document.getElementById('btn-fechar-grafico').addEventListener('click', () => {
        document.getElementById('bloco-grafico-ativo').style.display = 'none';
        if (graficoEvolucao) { graficoEvolucao.destroy(); graficoEvolucao = null; }
    });

    cleanupFunctions.push(() => {
        if (graficoEvolucao) { graficoEvolucao.destroy(); graficoEvolucao = null; }
    });
}

async function atualizarTudo() {
    await Promise.all([
        carregarTotal(),
        carregarAtivos(),
        carregarAportes(),
        carregarRentabilidadeCarteira(),
        carregarCdi(),
        verificarBadgeNotificacoes()
    ]);
}

// ─── Total investido ───────────────────────────────────────────────────────────

async function carregarTotal() {
    try {
        const res = await fetch(`${API}/investimentos/total`);
        const { total, renda_fixa, renda_variavel } = await res.json();
        document.getElementById('inv-total').textContent = formatarValor(total);
        document.getElementById('inv-renda-fixa').textContent = formatarValor(renda_fixa);
        document.getElementById('inv-renda-variavel').textContent = formatarValor(renda_variavel);
    } catch (e) {
        console.error('Erro ao carregar total:', e);
    }
}

// ─── Rentabilidade geral da carteira ──────────────────────────────────────────

async function carregarRentabilidadeCarteira() {
    try {
        const res = await fetch(`${API}/cotacoes/resumo-carteira`);
        if (!res.ok) return;
        const d = await res.json();

        if (d.renda_variavel_custo === 0) return;

        document.getElementById('bloco-rentabilidade-carteira').style.display = 'block';
        document.getElementById('rent-valor-mercado').textContent = formatarValor(d.valor_mercado);
        document.getElementById('rent-custo-total').textContent = formatarValor(d.custo_total);

        const ganhoEl = document.getElementById('rent-ganho-reais');
        const percentEl = document.getElementById('rent-ganho-percent');
        const positivo = d.ganho_reais >= 0;

        ganhoEl.textContent = `${positivo ? '+' : ''}${formatarValor(d.ganho_reais)}`;
        ganhoEl.className = `rent-valor ${positivo ? 'positivo' : 'negativo'}`;
        percentEl.textContent = `${positivo ? '+' : ''}${d.ganho_percent}%`;
        percentEl.className = `rent-valor ${positivo ? 'positivo' : 'negativo'}`;

        document.getElementById('rent-atualizado').textContent = `atualizado agora`;

        const aviso = document.getElementById('rent-aviso-sem-cotacao');
        if (d.ativos_sem_cotacao > 0) {
            aviso.textContent = `⚠️ ${d.ativos_sem_cotacao} ativo${d.ativos_sem_cotacao > 1 ? 's' : ''} sem cotação disponível — calculado com custo.`;
            aviso.style.display = 'block';
        } else {
            aviso.style.display = 'none';
        }
    } catch (e) {
        console.error('Erro ao carregar rentabilidade da carteira:', e);
    }
}

// ─── CDI ───────────────────────────────────────────────────────────────────────

async function carregarCdi() {
    try {
        const res = await fetch(`${API}/cotacoes/cdi`);
        const { cdi } = await res.json();
        document.getElementById('cdi-anual').textContent = `${cdi.anual}% a.a.`;
        document.getElementById('cdi-diario').textContent = `${cdi.diaria}% a.d.`;
    } catch {
        document.getElementById('cdi-anual').textContent = 'Indisponível';
    }
}

// ─── Cards de ativos ───────────────────────────────────────────────────────────

async function carregarAtivos() {
    try {
        const [resumoRes, cotacoesRes] = await Promise.all([
            fetch(`${API}/investimentos/resumo`),
            fetch(`${API}/cotacoes`)
        ]);

        let ativos = await resumoRes.json();
        const cotacoes = cotacoesRes.ok ? await cotacoesRes.json() : [];

        // mapa ticker → cotação
        const mapaCotacoes = {};
        cotacoes.forEach(c => { mapaCotacoes[c.ticker] = c; });

        if (filtroTipo !== 'todos') {
            ativos = ativos.filter(a => a.tipo === filtroTipo);
        }

        const container = document.getElementById('cards-ativos');
        container.innerHTML = '';

        if (ativos.length === 0) {
            container.innerHTML = '<p class="inv-vazio">Nenhum ativo encontrado.</p>';
            return;
        }

        ativos.forEach(a => {
            const cotacao = mapaCotacoes[a.nome];
            const temCotacao = cotacao?.cotacao_encontrada;

            const div = document.createElement('div');
            div.className = 'card-ativo';

            // parte do ganho/perda (só para renda variável com cotação)
            let htmlRentabilidade = '';
            if (a.tipo === 'renda_variavel' && temCotacao) {
                const positivo = cotacao.ganho_reais >= 0;
                const sinal = positivo ? '+' : '';
                const classeGanho = positivo ? 'positivo' : 'negativo';
                const varDia = cotacao.variacao_dia;
                const classeVar = varDia >= 0 ? 'positivo' : 'negativo';

                htmlRentabilidade = `
                    <div class="card-ativo-rentabilidade">
                        <div class="rent-linha">
                            <span class="rent-label">Preço atual</span>
                            <span class="rent-preco">${formatarValor(cotacao.preco_atual)}
                                <span class="rent-var ${classeVar}">${varDia >= 0 ? '+' : ''}${varDia?.toFixed(2)}% hoje</span>
                            </span>
                        </div>
                        <div class="rent-linha">
                            <span class="rent-label">Preço médio</span>
                            <span>${formatarValor(cotacao.preco_medio)}</span>
                        </div>
                        <div class="rent-linha">
                            <span class="rent-label">Valor de mercado</span>
                            <span>${formatarValor(cotacao.valor_atual)}</span>
                        </div>
                        <div class="rent-linha">
                            <span class="rent-label">Ganho / Perda</span>
                            <span class="rent-valor ${classeGanho}">
                                ${sinal}${formatarValor(cotacao.ganho_reais)}
                                (${sinal}${cotacao.ganho_percent}%)
                            </span>
                        </div>
                        ${cotacao.rendimento_mensal_estimado ? `
                        <div class="rent-linha">
                            <span class="rent-label">Rend. mensal estimado</span>
                            <span class="positivo">${formatarValor(cotacao.rendimento_mensal_estimado)}</span>
                        </div>
                        ${cotacao.ultimo_dividendo ? `
                        <div class="rent-linha rent-dividendo">
                            <span class="rent-label">Último dividendo</span>
                            <span>${formatarValor(cotacao.ultimo_dividendo.valor)}/cota
                                em ${formatarData(cotacao.ultimo_dividendo.data)}
                            </span>
                        </div>` : ''}` : ''}
                    </div>
                    <button class="btn-ver-grafico" data-ticker="${a.nome}">📈 Ver evolução</button>
                `;
            } else if (a.tipo === 'renda_variavel' && !temCotacao) {
                htmlRentabilidade = `<p class="cotacao-indisponivel">Cotação não disponível para este ativo</p>`;
            }

            div.innerHTML = `
                <div class="card-ativo-header">
                    <div>
                        <strong>${a.nome}</strong>
                        <span class="badge-tipo ${a.tipo}">
                            ${a.tipo === 'renda_fixa' ? 'Renda Fixa' : 'Renda Variável'}
                        </span>
                    </div>
                    <h3>${formatarValor(a.total_investido)}</h3>
                </div>
                <div class="card-ativo-detalhes">
                    <span>${a.num_aportes} aporte${a.num_aportes > 1 ? 's' : ''}</span>
                    ${a.total_cotas ? `<span>${Number(a.total_cotas)} cotas</span>` : ''}
                    <span>Desde ${formatarData(a.primeiro_aporte)}</span>
                </div>
                ${htmlRentabilidade}
            `;

            // botão de gráfico
            const btnGrafico = div.querySelector('.btn-ver-grafico');
            if (btnGrafico) {
                btnGrafico.addEventListener('click', () => abrirGraficoEvolucao(a.nome));
            }

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar ativos:', e);
    }
}

// ─── Gráfico de evolução ───────────────────────────────────────────────────────

async function abrirGraficoEvolucao(ticker) {
    const bloco = document.getElementById('bloco-grafico-ativo');
    const titulo = document.getElementById('grafico-ativo-titulo');
    const info = document.getElementById('grafico-preco-medio-info');

    titulo.textContent = `Evolução — ${ticker}`;
    bloco.style.display = 'block';
    bloco.scrollIntoView({ behavior: 'smooth', block: 'start' });
    info.textContent = 'Carregando...';

    if (graficoEvolucao) { graficoEvolucao.destroy(); graficoEvolucao = null; }

    try {
        const res = await fetch(`${API}/cotacoes/${ticker}/historico`);
        if (!res.ok) {
            info.textContent = 'Histórico não disponível para este ativo.';
            return;
        }

        const { historico, preco_medio, custo_total, total_cotas } = await res.json();

        if (!historico.length) {
            info.textContent = 'Sem dados históricos disponíveis.';
            return;
        }

        const labels = historico.map(p => p.data);
        const precos = historico.map(p => p.fechamento);
        const mediasLinha = labels.map(() => preco_medio);

        const precoAtual = precos[precos.length - 1];
        const variacaoDesdeAporte = preco_medio
            ? parseFloat(((precoAtual - preco_medio) / preco_medio * 100).toFixed(2))
            : null;
        const positivo = variacaoDesdeAporte >= 0;

        info.innerHTML = preco_medio ? `
            Preço médio de compra: <strong>${formatarValor(preco_medio)}</strong> &nbsp;|&nbsp;
            Preço atual: <strong>${formatarValor(precoAtual)}</strong> &nbsp;|&nbsp;
            Variação desde o aporte: <strong class="${positivo ? 'positivo' : 'negativo'}">
                ${positivo ? '+' : ''}${variacaoDesdeAporte}%
            </strong>
            ${total_cotas ? `&nbsp;|&nbsp; ${total_cotas} cotas &nbsp;·&nbsp; Posição: <strong>${formatarValor(total_cotas * precoAtual)}</strong>` : ''}
        ` : '';

        const ctx = document.getElementById('graficoEvolucaoAtivo').getContext('2d');

        graficoEvolucao = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: `${ticker} — Fechamento`,
                        data: precos,
                        borderColor: '#c237c2',
                        backgroundColor: 'rgba(194,55,194,0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.3,
                        fill: true
                    },
                    ...(preco_medio ? [{
                        label: `Preço médio — ${formatarValor(preco_medio)}`,
                        data: mediasLinha,
                        borderColor: '#00ff88',
                        borderWidth: 1.5,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false
                    }] : [])
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#aaa' } },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${Number(ctx.raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#666',
                            maxTicksLimit: 8,
                            callback: (_, i) => {
                                const d = labels[i];
                                return d ? d.slice(5).replace('-', '/') : '';
                            }
                        },
                        grid: { color: 'rgba(255,255,255,0.03)' }
                    },
                    y: {
                        ticks: {
                            color: '#888',
                            callback: val => `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
    } catch (e) {
        console.error('Erro ao carregar gráfico:', e);
        document.getElementById('grafico-preco-medio-info').textContent = 'Erro ao carregar histórico.';
    }
}

// ─── Histórico de aportes ──────────────────────────────────────────────────────

async function carregarAportes() {
    try {
        const params = new URLSearchParams();
        if (filtroTipo !== 'todos') params.append('tipo', filtroTipo);

        const res = await fetch(`${API}/investimentos?${params}`);
        const aportes = await res.json();

        const container = document.getElementById('lista-aportes');
        container.innerHTML = '';

        if (aportes.length === 0) {
            container.innerHTML = '<p class="inv-vazio">Nenhum aporte registrado.</p>';
            return;
        }

        aportes.forEach(a => {
            const div = document.createElement('div');
            div.className = 'transacao';
            div.dataset.id = a.id;
            div.innerHTML = `
                <div class="transacao-info">
                    <strong>${a.nome}</strong>
                    <span>${formatarData(a.data)}
                        ${a.cotas ? ` · ${Number(a.cotas)} cotas` : ''}
                        · <span class="badge-operacao ${a.operacao}">${a.operacao === 'aporte' ? 'Aporte' : 'Retirada'}</span>
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="transacao-valor ${a.operacao === 'aporte' ? 'receita' : 'despesa'}">
                        ${a.operacao === 'aporte' ? '+' : '-'} ${formatarValor(a.valor)}
                    </div>
                    <button class="btn-deletar-aporte" data-id="${a.id}">✕</button>
                </div>
            `;
            div.querySelector('.btn-deletar-aporte').addEventListener('click', async () => {
                div.classList.add('saindo');
                await new Promise(r => setTimeout(r, 400));
                await fetch(`${API}/investimentos/${a.id}`, { method: 'DELETE' });
                await atualizarTudo();
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar aportes:', e);
    }
}
