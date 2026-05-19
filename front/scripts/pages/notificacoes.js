import { inicializarCalendario, getPeriodo, onPeriodoMudou, removerListeners } from '../services/periodo.js';
import { popularSelectCategorias } from '../services/categorias.js';
import { formatarData, formatarValor } from '../services/utils.js';
import { API } from '../services/config.js';

export async function inicializarNotificacoes(cleanupFunctions) {
    console.log('Notificações carregado');

    removerListeners();
    inicializarCalendario('seletor-periodo-notificacoes');

    await atualizarTudo();

    onPeriodoMudou(async () => await atualizarTudo());
    cleanupFunctions.push(() => removerListeners());

    const metaTipo = document.getElementById('meta-tipo');
    const grupoCategoria = document.getElementById('grupo-meta-categoria');

    await popularSelectCategorias(document.getElementById('meta-categoria'), 'despesa');

    metaTipo.addEventListener('change', () => {
        grupoCategoria.style.display = metaTipo.value === 'categoria' ? 'flex' : 'none';
    });
    grupoCategoria.style.display = 'flex';

    document.getElementById('form-meta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const { ano, mes } = getPeriodo();
        const tipo = metaTipo.value;

        const body = {
            tipo,
            valor: document.getElementById('meta-valor').value,
            descricao: document.getElementById('meta-descricao').value,
            categoria: tipo === 'categoria' ? document.getElementById('meta-categoria').value : null,
            ano,
            mes
        };

        await fetch(`${API}/metas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        e.target.reset();
        grupoCategoria.style.display = 'flex';
        await atualizarTudo();
    });

    document.getElementById('btn-marcar-todas').addEventListener('click', async () => {
        const { ano, mes } = getPeriodo();
        await fetch(`${API}/notificacoes/todas/lidas`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ano, mes })
        });
        await carregarNotificacoes();
    });
}

async function atualizarTudo() {
    const { ano, mes } = getPeriodo();
    await gerarECarregarNotificacoes(ano, mes);
    await carregarMetas();
}

async function gerarECarregarNotificacoes(ano, mes) {
    try {
        const res = await fetch(`${API}/notificacoes/gerar?ano=${ano}&mes=${mes}`);
        const notificacoes = await res.json();
        renderizarNotificacoes(notificacoes);
        atualizarBadgeMenu(notificacoes);
    } catch (e) {
        console.error('Erro ao gerar notificações:', e);
    }
}

async function carregarNotificacoes() {
    try {
        const { ano, mes } = getPeriodo();
        const res = await fetch(`${API}/notificacoes?ano=${ano}&mes=${mes}`);
        const notificacoes = await res.json();
        renderizarNotificacoes(notificacoes);
        atualizarBadgeMenu(notificacoes);
    } catch (e) {
        console.error('Erro ao carregar notificações:', e);
    }
}

function renderizarNotificacoes(notificacoes) {
    const container = document.getElementById('lista-notificacoes');
    container.innerHTML = '';

    if (notificacoes.length === 0) {
        container.innerHTML = '<p class="notif-vazio">Nenhuma notificação para este mês. 🎉</p>';
        return;
    }

    notificacoes.forEach(n => {
        const div = document.createElement('div');
        div.className = `notif-item ${n.tipo} ${n.lida ? 'lida' : ''}`;
        div.innerHTML = `
            <div class="notif-icone">${n.tipo === 'alerta' ? '⚠️' : '🎯'}</div>
            <div class="notif-corpo">
                <p>${n.mensagem}</p>
                <span>${formatarData(n.criada_em)}</span>
            </div>
            <button class="btn-toggle-lida" data-id="${n.id}" data-lida="${n.lida}" title="${n.lida ? 'Marcar como não lida' : 'Marcar como lida'}">
                ${n.lida ? '↺' : '✓'}
            </button>
        `;

        div.querySelector('.btn-toggle-lida').addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const estaLida = btn.dataset.lida === 'true' || btn.dataset.lida === '1';

            await fetch(`${API}/notificacoes/${n.id}/toggle-lida`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lida: !estaLida })
            });
            await carregarNotificacoes();
        });

        container.appendChild(div);
    });
}

async function carregarMetas() {
    try {
        const { ano, mes } = getPeriodo();
        const res = await fetch(`${API}/metas?ano=${ano}&mes=${mes}`);
        const metas = await res.json();
        const container = document.getElementById('lista-metas');
        container.innerHTML = '';

        if (metas.length === 0) {
            container.innerHTML = '<p class="notif-vazio">Nenhuma meta para este mês.</p>';
            return;
        }

        metas.forEach(m => {
            const div = document.createElement('div');
            div.className = 'meta-item';
            const label = {
                categoria: `Máx. em ${m.categoria}`,
                economia: 'Meta de economia',
                receita: 'Meta de receita',
                investimento: 'Meta de investimento'
            }[m.tipo];

            div.innerHTML = `
                <div class="meta-info">
                    <strong>${label}</strong>
                    <span>${m.descricao || ''}</span>
                </div>
                <div class="meta-direita">
                    <span class="meta-valor">${formatarValor(m.valor)}</span>
                    <button class="btn-deletar-meta" data-id="${m.id}">✕</button>
                </div>
            `;

            div.querySelector('.btn-deletar-meta').addEventListener('click', async () => {
                await fetch(`${API}/metas/${m.id}`, { method: 'DELETE' });
                await atualizarTudo();
            });

            container.appendChild(div);
        });
    } catch (e) {
        console.error('Erro ao carregar metas:', e);
    }
}

function atualizarBadgeMenu(notificacoes) {
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
}