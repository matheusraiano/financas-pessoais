import { API } from './config.js';
import { getPeriodo } from './periodo.js';

/**
 * Busca as notificações já existentes (sem regenerar) e atualiza o badge do menu.
 * Chamada nas páginas Dashboard, Extrato e Investimentos ao navegar.
 */
export async function verificarBadgeNotificacoes() {
    try {
        const { ano, mes } = getPeriodo();
        const res = await fetch(`${API}/notificacoes?ano=${ano}&mes=${mes}`);
        const notificacoes = await res.json();
        atualizarBadgeMenu(notificacoes);
    } catch {
        // falha silenciosa — badge simplesmente não atualiza
    }
}

/**
 * Atualiza o elemento badge no menu com a contagem de não lidas.
 * Exportada para ser usada também pela página de notificações após gerar.
 */
export function atualizarBadgeMenu(notificacoes) {
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
