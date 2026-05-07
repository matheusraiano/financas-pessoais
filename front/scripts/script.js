//Código de Matheus Raiano
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
    'transacoes.html': inicializarTransacoes,
    'investimentos.html': inicializarInvestimentos,
    'emprestimos.html': inicializarEmprestimos,
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

    fetch(`../paginas/${pagina}`)
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
        init();
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
//
// ================================
// DASHBOARD
// ================================
//
function inicializarDashboard() {
    console.log('Dashboard carregado');
}
//
// ================================
// EXTRATO
// ================================
//
function inicializarExtrato() {
    console.log('Extrato carregado');
}
//
// ================================
// TRANSAÇÕES
// ================================
//
function inicializarTransacoes() {
    console.log('Transações carregado');
}
//
// ================================
// INVESTIMENTOS
// ================================
//
function inicializarInvestimentos() {
    console.log('Investimentos carregado');
}
//
// ================================
// EMPRÉSTIMOS
// ================================
//
function inicializarEmprestimos() {
    console.log('Empréstimos carregado');
}
//
// ================================
// NOTIFICAÇÕES
// ================================
//
function inicializarNotificacoes() {
    console.log('Notificações carregado');
}