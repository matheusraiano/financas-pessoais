import { popularSelectCategorias, criarCategoria } from '../services/categorias.js';
import { inicializarGraficos } from '../services/graficos.js';

const API = 'http://localhost:3000/api';
let transacaoAtualId = null;

export async function inicializarDashboard(cleanupFunctions) {
    console.log('Dashboard carregado');

    await carregarResumo();
    await carregarTransacoes();
    await inicializarGraficos();

    const selectTipo = document.getElementById('tipo');
    const selectCategoria = document.getElementById('categoria');

    // popula categorias conforme o tipo selecionado
    await popularSelectCategorias(selectCategoria, selectTipo.value);
    selectTipo.addEventListener('change', () => {
        popularSelectCategorias(selectCategoria, selectTipo.value);
    });

    // form nova transação
    document.getElementById('form-transacao').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch(`${API}/transacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valor: document.getElementById('valor').value,
                tipo: selectTipo.value,
                categoria: selectCategoria.value
            })
        });
        e.target.reset();
        await popularSelectCategorias(selectCategoria, selectTipo.value);
        await carregarResumo();
        await carregarTransacoes();
        await inicializarGraficos();
    });

    // form nova categoria
    document.getElementById('form-categoria').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = document.getElementById('cat-nome').value;
        const tipo = document.getElementById('cat-tipo').value;
        await criarCategoria(nome, tipo);
        e.target.reset();
        // atualiza o select de categoria já aberto
        await popularSelectCategorias(selectCategoria, selectTipo.value);
    });

    // modal
    document.getElementById('btn-fechar').addEventListener('click', fecharModal);
    document.getElementById('modal-transacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-transacao') fecharModal();
    });

    // editar — atualiza categorias quando muda o tipo no modal também
    const editTipo = document.getElementById('edit-tipo');
    editTipo.addEventListener('change', () => {
        popularSelectCategorias(document.getElementById('edit-categoria'), editTipo.value);
    });

    document.getElementById('form-edicao').addEventListener('submit', async (e) => {
        e.preventDefault();
        await fetch(`${API}/transacoes/${transacaoAtualId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                valor: document.getElementById('edit-valor').value,
                tipo: document.getElementById('edit-tipo').value,
                categoria: document.getElementById('edit-categoria').value
            })
        });
        fecharModal();
        await carregarResumo();
        await carregarTransacoes();
        await inicializarGraficos();
    });

    document.getElementById('btn-deletar').addEventListener('click', async () => {
        const idParaDeletar = transacaoAtualId;
        const el = document.querySelector(`[data-id="${idParaDeletar}"]`);
        fecharModal();
        if (el) {
            el.classList.add('saindo');
            await new Promise(r => setTimeout(r, 400));
        }
        await fetch(`${API}/transacoes/${idParaDeletar}`, { method: 'DELETE' });
        await carregarResumo();
        await carregarTransacoes();
        await inicializarGraficos();
    });
}

async function abrirModal(transacao) {
    transacaoAtualId = transacao.id;

    const dataEdicao = transacao.data_edicao ? ` (editado em ${transacao.data_edicao})` : '';
    document.getElementById('modal-titulo').textContent = `Transação — ${transacao.data}${dataEdicao}`;

    document.getElementById('edit-valor').value = transacao.valor;
    document.getElementById('edit-tipo').value = transacao.tipo;

    // popula categorias do tipo correto e seleciona a atual
    const editCategoria = document.getElementById('edit-categoria');
    await popularSelectCategorias(editCategoria, transacao.tipo);
    editCategoria.value = transacao.categoria;

    document.getElementById('modal-transacao').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal-transacao').style.display = 'none';
    transacaoAtualId = null;
}

async function carregarResumo() {
    try {
        const res = await fetch(`${API}/transacoes/resumo`);
        const { saldo, receitas, despesas } = await res.json();
        document.getElementById('saldo-total').textContent = formatar(saldo);
        document.getElementById('receitas-total').textContent = formatar(receitas);
        document.getElementById('despesas-total').textContent = formatar(despesas);
    } catch (e) {
        console.error('Erro ao carregar resumo:', e);
    }
}

async function carregarTransacoes() {
    try {
        const res = await fetch(`${API}/transacoes`);
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
                    <span>${t.data}${dataEdicao}</span>
                </div>
                <div class="transacao-valor ${t.tipo}">
                    ${t.tipo === 'receita' ? '+' : '-'} ${formatar(t.valor)}
                </div>
            `;

            div.addEventListener('click', () => abrirModal(t));
            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar transações:', e);
    }
}

function formatar(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}