//Código de Matheus Raiano
import { inicializarDashboard } from './pages/dashboard.js';
import { inicializarExtrato } from './pages/extrato.js';
import { inicializarInvestimentos } from './pages/investimentos.js';
import { inicializarNotificacoes } from './pages/notificacoes.js';
import { inicializarBusca } from './services/busca.js';
//
// ELEMENTOS PRINCIPAIS
//
const navItems = document.querySelectorAll('.nav-item');
const conteudo = document.getElementById('conteudo-dinamico');
//
// CACHE DAS PÁGINAS
//
const cache = {};
//
// SISTEMA DE CLEANUP
//
const cleanupFunctions = [];
//
// MAPA DE PÁGINAS
//
const paginas = {
    'dashboard.html': inicializarDashboard,
    'extrato.html': inicializarExtrato,
    'investimentos.html': inicializarInvestimentos,
    'notificacoes.html': inicializarNotificacoes
};
//
// FUNÇÃO PRINCIPAL DE CARREGAMENTO
//
function carregarPagina(pagina) {
    limparPaginaAtual();
    // verifica cache
    if (cache[pagina]) {

        conteudo.innerHTML = cache[pagina];

        inicializarScriptsPagina(pagina);

        return;
    }

    conteudo.innerHTML = "<p>Carregando...</p>";

    fetch(`pages/${pagina}`)
        .then(res => res.text())
        .then(html => {
            // salva cache
            cache[pagina] = html;
            // injeta conteúdo
            conteudo.innerHTML = html;
            // inicializa scripts da página
            inicializarScriptsPagina(pagina);
        })
        .catch(() => {
            conteudo.innerHTML = `
                <div class="erro-carregamento">
                    <h2>Erro ao carregar página</h2>
                    <p>Tente novamente mais tarde.</p>
                </div>
            `;
        });
}
//
// LIMPA SCRIPTS DA PÁGINA ANTERIOR
//
function limparPaginaAtual() {
    cleanupFunctions.forEach(fn => fn());

    cleanupFunctions.length = 0;
}
//
// INICIALIZA SCRIPT DA PÁGINA
//
function inicializarScriptsPagina(pagina) {

    const init = paginas[pagina];

    if (typeof init === 'function') {

        init(cleanupFunctions);
    }
}
//
// EVENTOS DE NAVEGAÇÃO
//
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // remove ativos
        navItems.forEach(i => {
            i.classList.remove('ativo');
        });
        // adiciona ativo
        item.classList.add('ativo');
        // pega página
        const pagina = item.dataset.page;
        // carrega página
        carregarPagina(pagina);
        // salva estado
        localStorage.setItem('paginaAtual', pagina);
    });
});
//
// CARREGAMENTO INICIAL
//
const paginaSalva = localStorage.getItem('paginaAtual') || 'dashboard.html';

carregarPagina(paginaSalva);
//
// SINCRONIZA MENU ATIVO
//
navItems.forEach(item => {
    if (item.dataset.page === paginaSalva) {
        item.classList.add('ativo');
    } else {
        item.classList.remove('ativo');
    }
});
inicializarBusca();