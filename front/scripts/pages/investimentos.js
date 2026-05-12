import { formatarData, formatarValor } from '../services/utils.js';
import { getPeriodo } from '../services/periodo.js';

import { API } from '../services/config.js';
let filtroTipo = 'todos';

export async function inicializarInvestimentos(cleanupFunctions) {
    console.log('Investimentos carregado');

    // define data de hoje como padrão no campo de data
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
        await fetch(`${API}/investimentos`, {
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
        e.target.reset();
        document.getElementById('inv-data').value = new Date().toISOString().split('T')[0];
        await atualizarTudo();
    });
}

async function atualizarTudo() {
    await carregarTotal();
    await carregarAtivos();
    await carregarAportes();
    await verificarBadgeNotificacoes();
}

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

async function carregarAtivos() {
    try {
        const res = await fetch(`${API}/investimentos/resumo`);
        let ativos = await res.json();

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
            const div = document.createElement('div');
            div.className = 'card-ativo';
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
                    ${a.total_cotas ? `<span>${Number(a.total_cotas).toFixed(4)} cotas</span>` : ''}
                    <span>Desde ${formatarData(a.primeiro_aporte)}</span>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar ativos:', e);
    }
}

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
                        ${a.cotas ? ` · ${Number(a.cotas).toFixed(4)} cotas` : ''}
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

async function verificarBadgeNotificacoes() {
    try {
        const { ano, mes } = getPeriodo();
        const res = await fetch(`${API}/notificacoes/gerar?ano=${ano}&mes=${mes}`);
        const notificacoes = await res.json();

        const naoLidas = notificacoes.filter(n => !n.lida).length;
        let badge = document.getElementById('badge-notificacoes');

        if (!badge) {
            const navItem = document.querySelector('[data-page="notificacoes.html"]');
            if (!navItem) return;
            badge = document.createElement('span');
            badge.id = 'badge-notificacoes';
            badge.className = 'badge-notif';
            navItem.appendChild(badge);
        }

        if (naoLidas > 0) {
            badge.textContent = naoLidas;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch {
        console.error('Erro ao verificar notificações');
    }
}