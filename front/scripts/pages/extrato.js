import { inicializarModal, abrirModal } from '../services/modal.js';
import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';
import { formatarData, formatarValor } from '../services/utils.js';

import { API } from '../services/config.js';

let filtroTipo = 'todos';
let filtroCategoria = 'todos';

export async function inicializarExtrato(cleanupFunctions) {
    console.log('Extrato carregado');

    removerListeners();
    inicializarModal();

    // usa um container diferente para não conflitar com o do dashboard
    inicializarCalendario('seletor-periodo-extrato');

    await atualizarExtrato();
    await popularFiltroCategoria();

    onPeriodoMudou(async () => await atualizarExtrato());
    cleanupFunctions.push(() => removerListeners());

    // filtros de tipo
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            filtroTipo = btn.dataset.tipo;
            atualizarExtrato();
        });
    });

    // filtro de categoria
    document.getElementById('filtro-categoria').addEventListener('change', (e) => {
        filtroCategoria = e.target.value;
        atualizarExtrato();
    });
}

async function atualizarExtrato() {
    const { ano, mes } = getPeriodo();
    await carregarResumo(ano, mes);
    await carregarTransacoes(ano, mes);
    await verificarBadgeNotificacoes();
}

async function carregarResumo(ano, mes) {
    try {
        const res = await fetch(`${API}/transacoes/resumo?ano=${ano}&mes=${mes}`);
        const { saldo, receitas, despesas } = await res.json();
        document.getElementById('ext-receitas').textContent = formatarValor(receitas);
        document.getElementById('ext-despesas').textContent = formatarValor(despesas);
        document.getElementById('ext-saldo').textContent = formatarValor(saldo);
        document.getElementById('ext-saldo').style.color = saldo >= 0 ? '#00ff88' : '#ff4d6d';
    } catch (e) {
        console.error('Erro ao carregar resumo:', e);
    }
}

async function carregarTransacoes(ano, mes) {
    try {
        const params = new URLSearchParams({ ano, mes });
        if (filtroTipo !== 'todos') params.append('tipo', filtroTipo);
        if (filtroCategoria !== 'todos') params.append('categoria', filtroCategoria);

        const res = await fetch(`${API}/transacoes?${params}`);
        let transacoes = await res.json();

        const container = document.getElementById('lista-extrato');
        const contador = document.getElementById('ext-contador');
        contador.textContent = `${transacoes.length} transaç${transacoes.length === 1 ? 'ão' : 'ões'}`;
        container.innerHTML = '';

        if (transacoes.length === 0) {
            container.innerHTML = '<p class="extrato-vazio">Nenhuma transação encontrada.</p>';
            return;
        }

        transacoes.forEach(t => {
            const div = document.createElement('div');
            div.className = 'transacao';
            div.dataset.id = t.id;
            const dataEdicao = t.data_edicao
                ? ` <span class="data-edicao">(editado em ${formatarData(t.data_edicao)})</span>`
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
                onSalvar: atualizarExtrato,
                onDeletar: atualizarExtrato
            }));
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar transações:', e);
    }
}

async function popularFiltroCategoria() {
    try {
        const res = await fetch(`${API}/categorias`);
        const categorias = await res.json();
        const select = document.getElementById('filtro-categoria');
        categorias.forEach(c => {
            const option = document.createElement('option');
            option.value = c.nome;
            option.textContent = c.nome;
            select.appendChild(option);
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