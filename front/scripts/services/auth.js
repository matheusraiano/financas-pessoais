const CHAVE = 'app_senha';

export function getSenha() {
    return sessionStorage.getItem(CHAVE);
}

export function setSenha(senha) {
    sessionStorage.setItem(CHAVE, senha);
}

export function limparSenha() {
    sessionStorage.removeItem(CHAVE);
}

export function estaAutenticado() {
    return !!getSenha();
}

/**
 * Retorna os headers padrão para todos os fetch, incluindo a senha.
 * Aceita headers adicionais opcionais (ex: { 'Content-Type': 'application/json' }).
 */
export function getHeaders(extras = {}) {
    return {
        'x-app-password': getSenha() || '',
        ...extras
    };
}
