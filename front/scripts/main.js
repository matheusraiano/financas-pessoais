import { inicializarDashboard } from './pages/dashboard.js';
import { inicializarExtrato } from './pages/extrato.js';
import { inicializarInvestimentos } from './pages/investimentos.js';
import { inicializarNotificacoes } from './pages/notificacoes.js';
import { inicializarBusca } from './services/busca.js';

const navItems = document.querySelectorAll('.nav-item');
const conteudo = document.getElementById('conteudo-dinamico');
const cleanupFunctions = [];

const paginas = {
    'dashboard.html': inicializarDashboard,
    'extrato.html': inicializarExtrato,
    'investimentos.html': inicializarInvestimentos,
    'notificacoes.html': inicializarNotificacoes
};

function limparPaginaAtual() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions.length = 0;
}

function inicializarScriptsPagina(pagina) {
    const init = paginas[pagina];
    if (typeof init === 'function') {
        init(cleanupFunctions);
    }
}

async function carregarPagina(pagina) {
    limparPaginaAtual();

    conteudo.innerHTML = '<p style="color:#555; padding:20px;">Carregando...</p>';

    try {
        const res = await fetch(`pages/${pagina}`);
        const html = await res.text();
        conteudo.innerHTML = html;
        inicializarScriptsPagina(pagina);
    } catch {
        conteudo.innerHTML = `
            <div style="padding:40px; text-align:center; color:#555;">
                <h2>Erro ao carregar página</h2>
                <p>Tente novamente mais tarde.</p>
            </div>
        `;
    }
}

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('ativo'));
        item.classList.add('ativo');
        const pagina = item.dataset.page;
        carregarPagina(pagina);
        localStorage.setItem('paginaAtual', pagina);
    });
});

const paginaSalva = localStorage.getItem('paginaAtual') || 'dashboard.html';
carregarPagina(paginaSalva);

navItems.forEach(item => {
    item.classList.toggle('ativo', item.dataset.page === paginaSalva);
});

inicializarBusca();