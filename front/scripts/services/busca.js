import { formatarData } from '../services/utils.js';

import { API } from './config.js';

export function inicializarBusca() {
    const input = document.querySelector('.header-center input');
    const modal = document.getElementById('modal-busca');
    const btnFechar = document.getElementById('btn-fechar-busca');

    let timeout = null;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim().length >= 2) {
            executarBusca(input.value.trim());
        }
    });

    // busca em tempo real com debounce de 400ms
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        if (input.value.trim().length < 2) return;
        timeout = setTimeout(() => executarBusca(input.value.trim()), 400);
    });

    btnFechar.addEventListener('click', fecharBusca);
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'modal-busca') fecharBusca();
    });

    // ESC fecha
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') fecharBusca();
    });
}

async function executarBusca(termo) {
    const modal = document.getElementById('modal-busca');
    const container = document.getElementById('busca-resultados');

    modal.style.display = 'flex';
    container.innerHTML = '<p class="busca-carregando">Buscando...</p>';

    try {
        const res = await fetch(`${API}/busca?q=${encodeURIComponent(termo)}`);
        const { transacoes, investimentos, categorias } = await res.json();

        const total = transacoes.length + investimentos.length + categorias.length;

        if (total === 0) {
            container.innerHTML = '<p class="busca-vazio">Nenhum resultado encontrado.</p>';
            return;
        }

        container.innerHTML = '';

        if (transacoes.length > 0) {
            container.innerHTML += `<h4 class="busca-grupo-titulo">Transações</h4>`;
            transacoes.forEach(t => {
                container.innerHTML += `
                    <div class="busca-item">
                        <div class="busca-item-info">
                            <strong>${t.categoria}</strong>
                            <span>${formatarData(t.data)}</span>
                        </div>
                        <span class="transacao-valor ${t.tipo}">
                            ${t.tipo === 'receita' ? '+' : '-'} ${formatar(t.valor)}
                        </span>
                    </div>
                `;
            });
        }

        if (investimentos.length > 0) {
            container.innerHTML += `<h4 class="busca-grupo-titulo">Investimentos</h4>`;
            investimentos.forEach(i => {
                container.innerHTML += `
                    <div class="busca-item">
                        <div class="busca-item-info">
                            <strong>${i.nome}</strong>
                            <span>${formatarData(i.data)} · ${i.operacao}</span>
                        </div>
                        <span class="transacao-valor receita">+ ${formatar(i.valor)}</span>
                    </div>
                `;
            });
        }

        if (categorias.length > 0) {
            container.innerHTML += `<h4 class="busca-grupo-titulo">Categorias</h4>`;
            categorias.forEach(c => {
                container.innerHTML += `
                    <div class="busca-item">
                        <div class="busca-item-info">
                            <strong>${c.nome}</strong>
                            <span>${c.tipo} · ${c.ativa ? 'Ativa' : 'Inativa'}</span>
                        </div>
                    </div>
                `;
            });
        }

    } catch (e) {
        container.innerHTML = '<p class="busca-vazio">Erro ao buscar. Tente novamente.</p>';
    }
}

function fecharBusca() {
    document.getElementById('modal-busca').style.display = 'none';
    document.querySelector('.header-center input').value = '';
}

function formatar(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}