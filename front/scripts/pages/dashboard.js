import { popularSelectCategorias, criarCategoria } from '../services/categorias.js';
import { inicializarGraficos } from '../services/graficos.js';
import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';

const API = 'http://localhost:3000/api';
let transacaoAtualId = null;

export async function inicializarDashboard(cleanupFunctions) {
    console.log('Dashboard carregado');

    // limpa listeners antigos antes de registrar novos
    removerListeners();

    inicializarCalendario();
    await atualizarTudo();

    // registra listener — quando mudar período atualiza tudo
    onPeriodoMudou(async () => await atualizarTudo());

    // cleanup quando sair da página
    cleanupFunctions.push(() => removerListeners());

    const selectTipo = document.getElementById('tipo');
    const selectCategoria = document.getElementById('categoria');
    await popularSelectCategorias(selectCategoria, selectTipo.value);

    selectTipo.addEventListener('change', () => {
        popularSelectCategorias(selectCategoria, selectTipo.value);
    });

    document.getElementById('form-transacao').addEventListener('submit', async (e) => {
        e.preventDefault();

        const { ano, mes } = getPeriodo();

        // monta a data com o mês/ano selecionado + dia atual
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
    });

    document.getElementById('btn-fechar').addEventListener('click', fecharModal);
    document.getElementById('modal-transacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-transacao') fecharModal();
    });

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
        await atualizarTudo();
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
        await atualizarTudo();
    });
}

async function atualizarTudo() {
    const { ano, mes } = getPeriodo();
    await carregarResumo(ano, mes);
    await carregarTransacoes(ano, mes);
    await inicializarGraficos(ano, mes);
}

async function abrirModal(transacao) {
    transacaoAtualId = transacao.id;
    const dataEdicao = transacao.data_edicao ? ` (editado em ${transacao.data_edicao})` : '';
    document.getElementById('modal-titulo').textContent = `Transação — ${transacao.data}${dataEdicao}`;
    document.getElementById('edit-valor').value = transacao.valor;
    document.getElementById('edit-tipo').value = transacao.tipo;
    const editCategoria = document.getElementById('edit-categoria');
    await popularSelectCategorias(editCategoria, transacao.tipo);
    editCategoria.value = transacao.categoria;
    document.getElementById('modal-transacao').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal-transacao').style.display = 'none';
    transacaoAtualId = null;
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