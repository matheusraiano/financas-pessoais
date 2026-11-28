import { inicializarDashboard } from './pages/dashboard.js';
import { inicializarExtrato } from './pages/extrato.js';
import { inicializarInvestimentos } from './pages/investimentos.js';
import { inicializarNotificacoes } from './pages/notificacoes.js';
import { inicializarBusca } from './services/busca.js';
import { getSenha, setSenha, estaAutenticado, getHeaders } from './services/auth.js';
import { API } from './services/config.js';

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

// ─── Login ───────────────────────────────────────────────────────────────────

async function verificarSenha(senha) {
    try {
        // Testa a senha tentando chamar qualquer endpoint protegido
        const res = await fetch(`${API}/categorias`, {
            headers: { 'x-app-password': senha }
        });
        return res.ok;
    } catch {
        return false;
    }
}

async function mostrarLogin() {
    try {
        const res = await fetch('pages/login.html');
        const html = await res.text();
        conteudo.innerHTML = html;
    } catch {
        conteudo.innerHTML = `
            <section class="login-container">
                <div class="login-box">
                    <h2>Finanças Pessoais</h2>
                    <form id="form-login">
                        <div class="grupo-form">
                            <input type="password" id="login-senha" placeholder="Senha" required>
                        </div>
                        <p id="login-erro" class="login-erro" style="display:none;">Senha incorreta.</p>
                        <button type="submit" class="btn-login">Entrar</button>
                    </form>
                </div>
            </section>
        `;
    }

    document.getElementById('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const senha = document.getElementById('login-senha').value;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Verificando...';

        const ok = await verificarSenha(senha);
        if (ok) {
            setSenha(senha);
            inicializarApp();
        } else {
            document.getElementById('login-erro').style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'Entrar';
        }
    });
}

function inicializarApp() {
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
}

// ─── Boot ────────────────────────────────────────────────────────────────────

if (estaAutenticado()) {
    // Sessão ainda ativa — valida silenciosamente a senha salva
    verificarSenha(getSenha()).then(ok => {
        if (ok) {
            inicializarApp();
        } else {
            mostrarLogin();
        }
    });
} else {
    mostrarLogin();
}
