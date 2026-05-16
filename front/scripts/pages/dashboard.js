import { popularSelectCategorias, criarCategoria } from '../services/categorias.js';
import { inicializarGraficos } from '../services/graficos.js';
import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';
import { inicializarModal, abrirModal } from '../services/modal.js';
import { formatarData, formatarValor } from '../services/utils.js';

import { API } from '../services/config.js';

export async function inicializarDashboard(cleanupFunctions) {
    console.log('Dashboard carregado');

    removerListeners();
    inicializarModal();
    inicializarCalendario();
    await atualizarTudo();

    onPeriodoMudou(async () => await atualizarTudo());
    cleanupFunctions.push(() => removerListeners());

    const selectTipo = document.getElementById('tipo');
    const selectCategoria = document.getElementById('categoria');
    await popularSelectCategorias(selectCategoria, selectTipo.value);

    selectTipo.addEventListener('change', () => {
        popularSelectCategorias(selectCategoria, selectTipo.value);
    });

    const btnVerCategorias = document.getElementById('btn-ver-categorias');
    const listaCategorias = document.getElementById('lista-categorias');
    let categoriasVisiveis = false;

    btnVerCategorias.addEventListener('click', async () => {
        categoriasVisiveis = !categoriasVisiveis;
        if (categoriasVisiveis) {
            await carregarCategorias(selectCategoria, selectTipo);
            listaCategorias.style.display = 'block';
            btnVerCategorias.textContent = 'Ocultar categorias';
        } else {
            listaCategorias.style.display = 'none';
            btnVerCategorias.textContent = 'Ver categorias';
        }
    });

    document.getElementById('form-transacao').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { ano, mes } = getPeriodo();
        const dia = new Date().getDate();
        const dataTransacao = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        await fetch(`${API}/transacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valor: document.getElementById('valor').value,
                tipo: selectTipo.value,
                categoria: selectCategoria.value,
                data: dataTransacao
            })
        });
        e.target.reset();
        await popularSelectCategorias(selectCategoria, selectTipo.value);
        await atualizarTudo();
    });

    document.getElementById('form-categoria').addEventListener('submit', async (e) => {
        e.preventDefault();
        await criarCategoria(
            document.getElementById('cat-nome').value,
            document.getElementById('cat-tipo').value
        );
        e.target.reset();
        await popularSelectCategorias(selectCategoria, selectTipo.value);
        if (categoriasVisiveis) await carregarCategorias(selectCategoria, selectTipo);
    });
}

async function atualizarTudo() {
    const { ano, mes } = getPeriodo();
    await carregarResumo(ano, mes);
    await carregarTransacoes(ano, mes);
    await inicializarGraficos(ano, mes);
    await carregarInvestimentos();
    await verificarBadgeNotificacoes();
}

async function carregarResumo(ano, mes) {
    try {
        const res = await fetch(`${API}/transacoes/resumo?ano=${ano}&mes=${mes}`);
        const { saldo, receitas, despesas } = await res.json();
        document.getElementById('saldo-total').textContent = formatarValor(saldo);
        document.getElementById('receitas-total').textContent = formatarValor(receitas);
        document.getElementById('despesas-total').textContent = formatarValor(despesas);
    } catch (e) {
        console.error('Erro ao carregar resumo:', e);
    }
}

async function carregarTransacoes(ano, mes) {
    try {
        const res = await fetch(`${API}/transacoes?ano=${ano}&mes=${mes}`);
        const transacoes = await res.json();
        const container = document.getElementById('ultimas-transacoes');
        container.innerHTML = '';

        transacoes.slice(0, 10).forEach(t => {
            const div = document.createElement('div');
            div.className = 'transacao';
            div.dataset.id = t.id;
            const dataEdicao = t.data_edicao
                ? ` <span class="data-edicao">(editado em ${t.data_edicao})</span>`
                : '';
            div.innerHTML = `
                <div class="transacao-info">
                    <strong>${t.categoria}</strong>
                    <span>${formatarData(t.data)}${dataEdicao}</span>
                </div>
                <div class="transacao-valor ${t.tipo}">
                    ${t.tipo === 'receita' ? '+' : '-'} ${formatarValor(t.valor)}
                </div>
            `;
            div.addEventListener('click', () => abrirModal(t, {
                onSalvar: atualizarTudo,
                onDeletar: atualizarTudo
            }));
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar transações:', e);
    }
}

async function carregarInvestimentos() {
    try {
        const res = await fetch(`${API}/investimentos/total`);
        const { total } = await res.json();
        document.getElementById('investimentos-total').textContent = formatarValor(total);
    } catch (e) {
        console.error('Erro ao carregar investimentos:', e);
    }
}

async function carregarCategorias(selectCategoria, selectTipo) {
    try {
        const res = await fetch(`${API}/categorias?todas=true`);
        const categorias = await res.json();
        const container = document.getElementById('lista-categorias');
        if (!container) return;
        container.innerHTML = '';

        categorias.forEach(c => {
            const div = document.createElement('div');
            div.className = `categoria-item ${!c.ativa ? 'categoria-inativa' : ''}`;
            div.innerHTML = `
                <div class="categoria-info">
                    <span>${c.nome} ${!c.ativa ? '<span class="badge-inativa">Inativa</span>' : ''}</span>
                    <span class="badge-tipo ${c.tipo}">
                        ${c.tipo === 'ambos' ? 'Receita e Despesa' : c.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-toggle-categoria" data-id="${c.id}" data-ativa="${c.ativa}" title="${c.ativa ? 'Inativar' : 'Reativar'}">
                        ${c.ativa ? '✕' : '↺'}
                    </button>
                    <button class="btn-deletar-categoria" data-id="${c.id}" title="Deletar permanentemente">
                        🗑
                    </button>
                </div>
            `;

            div.querySelector('.btn-toggle-categoria').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                await fetch(`${API}/categorias/${btn.dataset.id}/toggle`, { method: 'PATCH' });
                await carregarCategorias(selectCategoria, selectTipo);
                await popularSelectCategorias(selectCategoria, selectTipo.value);
            });

            div.querySelector('.btn-deletar-categoria').addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const res = await fetch(`${API}/categorias/${id}`, { method: 'DELETE' });

                if (res.status === 409) {
                    const erro = await res.json();
                    alert(erro.erro);
                    return;
                }

                if (res.ok) {
                    await carregarCategorias(selectCategoria, selectTipo);
                    await popularSelectCategorias(selectCategoria, selectTipo.value);
                }
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar categorias:', e);
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