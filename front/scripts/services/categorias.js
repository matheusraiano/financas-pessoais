import { API } from './config.js';

// busca categorias e popula um <select> filtrando pelo tipo selecionado
export async function popularSelectCategorias(selectEl, tipoAtual) {
    const res = await fetch(`${API}/categorias`);
    const categorias = await res.json();

    selectEl.innerHTML = '';

    categorias
        .filter(c => c.tipo === tipoAtual || c.tipo === 'ambos')
        .forEach(c => {
            const option = document.createElement('option');
            option.value = c.nome;
            option.textContent = c.nome;
            selectEl.appendChild(option);
        });
}

// cria uma nova categoria via API
export async function criarCategoria(nome, tipo) {
    const res = await fetch(`${API}/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, tipo })
    });
    return res.json();
}