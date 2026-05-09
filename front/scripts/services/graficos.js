const API = 'http://localhost:3000/api';

let graficoFluxo = null;
let graficoCategorias = null;

// cores do tema roxo para o gráfico de pizza
const coresPizza = [
    '#8b00ff', '#a020f0', '#c23fc2', '#d855d8',
    '#e070e0', '#6600cc', '#9900ff', '#bb44bb'
];

export async function inicializarGraficos() {
    await renderizarFluxo();
    await renderizarCategorias();
}

async function renderizarFluxo() {
    const res = await fetch(`${API}/transacoes/fluxo`);
    const dados = await res.json();

    // formata '2026-05' para 'Mai/26'
    const labels = dados.map(d => {
        const [ano, mes] = d.mes.split('-');
        const nomeMes = new Date(ano, mes - 1).toLocaleString('pt-BR', { month: 'short' });
        return `${nomeMes}/${ano.slice(2)}`;
    });

    const receitas = dados.map(d => Number(d.receitas));
    const despesas = dados.map(d => Number(d.despesas));

    const ctx = document.getElementById('graficoFluxo').getContext('2d');

    // destrói o gráfico anterior se existir (evita duplicação ao recarregar)
    if (graficoFluxo) graficoFluxo.destroy();

    graficoFluxo = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: receitas,
                    backgroundColor: 'rgba(0, 255, 136, 0.6)',
                    borderColor: '#00ff88',
                    borderWidth: 1,
                    borderRadius: 6,
                },
                {
                    label: 'Despesas',
                    data: despesas,
                    backgroundColor: 'rgba(255, 77, 109, 0.6)',
                    borderColor: '#ff4d6d',
                    borderWidth: 1,
                    borderRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: '#aaa' }
                },
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

async function renderizarCategorias() {
    const res = await fetch(`${API}/transacoes/categorias-gastos`);
    const dados = await res.json();

    if (dados.length === 0) return;

    const labels = dados.map(d => d.categoria);
    const valores = dados.map(d => Number(d.total));

    const ctx = document.getElementById('graficoCategorias').getContext('2d');

    if (graficoCategorias) graficoCategorias.destroy();

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