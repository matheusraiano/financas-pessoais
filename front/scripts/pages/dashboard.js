import { popularSelectCategorias, criarCategoria } from '../services/categorias.js';
import { inicializarGraficos } from '../services/graficos.js';
import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';
import { inicializarModal, abrirModal } from '../services/modal.js';
import { formatarData } from '../services/utils.js';

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
}

async function carregarResumo(ano, mes) {
    try {
        const res = await fetch(`${API}/transacoes/resumo?ano=${ano}&mes=${mes}`);
        const { saldo, receitas, despesas } = await res.json();
        document.getElementById('saldo-total').textContent = formatar(saldo);
        document.getElementById('receitas-total').textContent = formatar(receitas);
        document.getElementById('despesas-total').textContent = formatar(despesas);
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
                    ${t.tipo === 'receita' ? '+' : '-'} ${formatar(t.valor)}
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
        document.getElementById('investimentos-total').textContent = formatar(total);
    } catch (e) {
        console.error('Erro ao carregar investimentos:', e);
    }
}

async function carregarCategorias(selectCategoria, selectTipo) {
    try {
        const res = await fetch(`${API}/categorias`);
        const categorias = await res.json();
        const container = document.getElementById('lista-categorias');
        if (!container) return;
        container.innerHTML = '';

        categorias.forEach(c => {
            const div = document.createElement('div');
            div.className = 'categoria-item';
            div.innerHTML = `
                <div class="categoria-info">
                    <span>${c.nome}</span>
                    <span class="badge-tipo ${c.tipo}">
                        ${c.tipo === 'ambos' ? 'Receita e Despesa' : c.tipo === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
                </div>
                <button class="btn-desativar-categoria" data-id="${c.id}">✕</button>
            `;
            div.querySelector('.btn-desativar-categoria').addEventListener('click', async () => {
                await fetch(`${API}/categorias/${c.id}`, { method: 'DELETE' });
                await carregarCategorias(selectCategoria, selectTipo);
                await popularSelectCategorias(selectCategoria, selectTipo.value);
            });
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar categorias:', e);
    }
}

function formatar(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}