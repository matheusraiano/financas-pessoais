import { API } from './config.js';
import { getHeaders } from './auth.js';

export async function listarRecorrencias() {
    const res = await fetch(`${API}/recorrencias`, { headers: getHeaders() });
    return res.json();
}

export async function criarRecorrencia(dados) {
    const res = await fetch(`${API}/recorrencias`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(dados)
    });
    return res.json();
}

export async function toggleRecorrencia(id) {
    const res = await fetch(`${API}/recorrencias/${id}/toggle`, {
        method: 'PATCH',
        headers: getHeaders()
    });
    return res.json();
}

export async function deletarRecorrencia(id) {
    await fetch(`${API}/recorrencias/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
}

export async function processarRecorrencias(ano, mes) {
    const res = await fetch(`${API}/recorrencias/processar?ano=${ano}&mes=${mes}`, {
        method: 'POST',
        headers: getHeaders()
    });
    return res.json();
}

export async function previsaoSaldo(ano, mes) {
    const res = await fetch(`${API}/recorrencias/previsao?ano=${ano}&mes=${mes}`, {
        headers: getHeaders()
    });
    return res.json();
}
