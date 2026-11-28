import { popularSelectCategorias, criarCategoria } from '../services/categorias.js';
import { inicializarGraficos } from '../services/graficos.js';
import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';
import { inicializarModal, abrirModal } from '../services/modal.js';
import { formatarData, formatarValor } from '../services/utils.js';
import { verificarBadgeNotificacoes } from '../services/notificacoes.js';
import { API } from '../services/config.js';
import { getHeaders } from '../services/auth.js';
import {
    listarRecorrencias,
    criarRecorrencia,
    toggleRecorrencia,
    deletarRecorrencia,
    processarRecorrencias,
    previsaoSaldo
} from '../services/recorrencias.js';

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
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                valor: document.getElementById('valor').value,
                tipo: selectTipo.value,
                categoria: selectCategoria.value,
                descricao: document.getElementById('descricao').value || null,
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

    // ─── Form recorrências ────────────────────────────────────────────────
    const selectRecorrTipo = document.getElementById('recorr-tipo');
    const selectRecorrCat = document.getElementById('recorr-categoria');
    await popularSelectCategorias(selectRecorrCat, selectRecorrTipo.value);

    selectRecorrTipo.addEventListener('change', () => {
        popularSelectCategorias(selectRecorrCat, selectRecorrTipo.value);
    });

    document.getElementById('form-recorrencia').addEventListener('submit', async (e) => {
        e.preventDefault();
        await criarRecorrencia({
            valor: document.getElementById('recorr-valor').value,
            tipo: selectRecorrTipo.value,
            categoria: selectRecorrCat.value,
            dia_do_mes: document.getElementById('recorr-dia').value,
            descricao: document.getElementById('recorr-descricao').value || null
        });
        e.target.reset();
        await popularSelectCategorias(selectRecorrCat, selectRecorrTipo.value);
        await carregarListaRecorrencias();
    });

    await carregarListaRecorrencias();
}

async function atualizarTudo() {
    const { ano, mes } = getPeriodo();
    // Processa recorrências do mês ao carregar
    await processarRecorrencias(ano, mes);
    await carregarResumo(ano, mes);
    await carregarPrevisao(ano, mes);
    await carregarTransacoes(ano, mes);
    await inicializarGraficos(ano, mes);
    await carregarInvestimentos();
    await verificarBadgeNotificacoes();
}

async function carregarResumo(ano, mes) {
    try {
        const res = await fetch(`${API}/transacoes/resumo?ano=${ano}&mes=${mes}`, { headers: getHeaders() });
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
        const res = await fetch(`${API}/transacoes?ano=${ano}&mes=${mes}`, { headers: getHeaders() });
        const transacoes = await res.json();
        const container = document.getElementById('ultimas-transacoes');
        container.innerHTML = '';

        transacoes.slice(0, 10).forEach(t => {
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
                    ${t.descricao ? `<span class="transacao-descricao">${t.descricao}</span>` : ''}
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
        const res = await fetch(`${API}/investimentos/total`, { headers: getHeaders() });
        const { total } = await res.json();
        document.getElementById('investimentos-total').textContent = formatarValor(total);
    } catch (e) {
        console.error('Erro ao carregar investimentos:', e);
    }
}

async function carregarPrevisao(ano, mes) {
    try {
        const data = await previsaoSaldo(ano, mes);
        const card = document.getElementById('card-previsao');
        const el = document.getElementById('saldo-previsto');
        const detalhes = document.getElementById('previsao-detalhes');

        // Só exibe o card se houver recorrências previstas
        if (data.receitas_previstas > 0 || data.despesas_previstas > 0) {
            card.style.display = 'flex';
            el.textContent = formatarValor(data.saldo_previsto);
            el.style.color = data.saldo_previsto >= 0 ? '#00ff88' : '#ff4d6d';
            detalhes.textContent = `+${formatarValor(data.receitas_previstas)} receitas / -${formatarValor(data.despesas_previstas)} despesas previstas`;
        } else {
            card.style.display = 'none';
        }
    } catch {
        // falha silenciosa — card permanece oculto
    }
}

async function carregarListaRecorrencias() {
    try {
        const recorrencias = await listarRecorrencias();
        const container = document.getElementById('lista-recorrencias');
        container.innerHTML = '';

        if (recorrencias.length === 0) {
            container.innerHTML = '<p class="recorr-vazio">Nenhuma recorrência cadastrada.</p>';
            return;
        }

        recorrencias.forEach(r => {
            const div = document.createElement('div');
            div.className = `recorr-item ${!r.ativa ? 'recorr-inativa' : ''}`;
            div.innerHTML = `
                <div class="recorr-info">
                    <strong>${r.descricao || r.categoria}</strong>
                    <span>Dia ${r.dia_do_mes} &bull; ${r.categoria} &bull;
                        <span class="badge-tipo ${r.tipo}">${r.tipo === 'receita' ? 'Receita' : 'Despesa'}</span>
                        ${!r.ativa ? '<span class="badge-inativa">Inativa</span>' : ''}
                    </span>
                </div>
                <div class="recorr-acoes">
                    <span class="recorr-valor ${r.tipo}">${r.tipo === 'receita' ? '+' : '-'} ${formatarValor(r.valor)}</span>
                    <button class="btn-toggle-recorr" data-id="${r.id}" title="${r.ativa ? 'Desativar' : 'Ativar'}">
                        ${r.ativa ? '⏸' : '▶'}
                    </button>
                    <button class="btn-deletar-recorr" data-id="${r.id}" title="Deletar">✕</button>
                </div>
            `;

            div.querySelector('.btn-toggle-recorr').addEventListener('click', async () => {
                await toggleRecorrencia(r.id);
                await carregarListaRecorrencias();
            });

            div.querySelector('.btn-deletar-recorr').addEventListener('click', async () => {
                div.classList.add('saindo');
                await new Promise(resolve => setTimeout(resolve, 300));
                await deletarRecorrencia(r.id);
                await carregarListaRecorrencias();
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar recorrências:', e);
    }
}

async function carregarCategorias(selectCategoria, selectTipo) {
    try {
        const res = await fetch(`${API}/categorias?todas=true`, { headers: getHeaders() });
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
                await fetch(`${API}/categorias/${btn.dataset.id}/toggle`, { method: 'PATCH', headers: getHeaders() });
                await carregarCategorias(selectCategoria, selectTipo);
                await popularSelectCategorias(selectCategoria, selectTipo.value);
            });

            div.querySelector('.btn-deletar-categoria').addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                const res = await fetch(`${API}/categorias/${id}`, { method: 'DELETE', headers: getHeaders() });

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

