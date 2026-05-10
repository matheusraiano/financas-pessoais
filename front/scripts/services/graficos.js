const API = 'http://localhost:3000/api';

let graficoFluxo = null;
let graficoCategorias = null;

const coresPizza = [
    '#ff4d6d', '#ff6b6b', '#ff8585', '#cc0033',
    '#e63950', '#ff1a40', '#b30000', '#ff9999'
];

let graficoReceitasCategorias = null;

const coresPizzaReceitas = [
    '#00ff88', '#00cc6a', '#00aa55', '#008844',
    '#006633', '#004422', '#00ff99', '#33ffaa'
];

export async function inicializarGraficos(ano, mes) {
    await renderizarFluxo(ano, mes);
    await renderizarCategorias(ano, mes);
    await renderizarReceitasCategorias(ano, mes);
}

async function renderizarFluxo(ano, mes) {
    const res = await fetch(`${API}/transacoes/fluxo?ano=${ano}`);
    const dados = await res.json();

    const labels = dados.map(d => {
        const [a, m] = d.mes.split('-');
        const nomeMes = new Date(a, m - 1).toLocaleString('pt-BR', { month: 'short' });
        return `${nomeMes}/${a.slice(2)}`;
    });

    const receitas = dados.map(d => Number(d.receitas));
    const despesas = dados.map(d => Number(d.despesas));

    // destaca o mês selecionado nas barras
    const mesStr = `${ano}-${String(mes).padStart(2, '0')}`;
    const indexSelecionado = dados.findIndex(d => d.mes === mesStr);

    const bgReceitas = dados.map((d, i) =>
        i === indexSelecionado ? 'rgba(0, 255, 136, 1)' : 'rgba(0, 255, 136, 0.4)'
    );
    const bgDespesas = dados.map((d, i) =>
        i === indexSelecionado ? 'rgba(255, 77, 109, 1)' : 'rgba(255, 77, 109, 0.4)'
    );

    const ctx = document.getElementById('graficoFluxo').getContext('2d');
    if (graficoFluxo) graficoFluxo.destroy();

    graficoFluxo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: receitas,
                    backgroundColor: bgReceitas,
                    borderColor: '#00ff88',
                    borderWidth: 1,
                    borderRadius: 6,
                },
                {
                    label: 'Despesas',
                    data: despesas,
                    backgroundColor: bgDespesas,
                    borderColor: '#ff4d6d',
                    borderWidth: 1,
                    borderRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
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
                    ticks: { color: '#888' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: {
                        color: '#888',
                        callback: val => `R$ ${val.toLocaleString('pt-BR')}`
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

async function renderizarCategorias(ano, mes) {
    const res = await fetch(`${API}/transacoes/categorias-gastos?ano=${ano}&mes=${mes}`);
    const dados = await res.json();

    const ctx = document.getElementById('graficoCategorias').getContext('2d');
    if (graficoCategorias) graficoCategorias.destroy();

    if (dados.length === 0) {
        // desenha mensagem de vazio no canvas
        graficoCategorias = null;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#555';
        ctx.font = '14px DM Sans';
        ctx.textAlign = 'center';
        ctx.fillText('Sem despesas neste mês', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    const labels = dados.map(d => d.categoria);
    const valores = dados.map(d => Number(d.total));

    graficoCategorias = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: coresPizza.slice(0, dados.length),
                borderColor: '#111',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#aaa', padding: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${Number(ctx.raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    }
                }
            }
        }
    });
}

async function renderizarReceitasCategorias(ano, mes) {
    const res = await fetch(`${API}/transacoes/receitas-categorias?ano=${ano}&mes=${mes}`);
    const dados = await res.json();

    const ctx = document.getElementById('graficoReceitasCategorias').getContext('2d');
    if (graficoReceitasCategorias) graficoReceitasCategorias.destroy();

    if (dados.length === 0) {
        graficoReceitasCategorias = null;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = '#555';
        ctx.font = '14px DM Sans';
        ctx.textAlign = 'center';
        ctx.fillText('Sem receitas neste mês', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    graficoReceitasCategorias = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: dados.map(d => d.categoria),
            datasets: [{
                data: dados.map(d => Number(d.total)),
                backgroundColor: coresPizzaReceitas.slice(0, dados.length),
                borderColor: '#111',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#aaa', padding: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${Number(ctx.raw).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                    }
                }
            }
        }
    });
}