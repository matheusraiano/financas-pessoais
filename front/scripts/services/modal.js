import { popularSelectCategorias } from './categorias.js';

const API = 'http://localhost:3000/api';
let transacaoAtualId = null;
let onSalvar = null;
let onDeletar = null;

// injeta o HTML do modal no body (uma vez só)
export function inicializarModal() {
    if (document.getElementById('modal-transacao')) return; // já existe

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div id="modal-transacao" class="modal-overlay" style="display:none;">
            <div class="modal-box">
                <h3 id="modal-titulo">Transação</h3>
                <form id="form-edicao">
                    <div class="grupo-form">
                        <input type="number" id="edit-valor" placeholder="Valor" required>
                    </div>
                    <div class="grupo-form">
                        <select id="edit-tipo">
                            <option value="receita">Receita</option>
                            <option value="despesa">Despesa</option>
                        </select>
                        <select id="edit-categoria"></select>
                    </div>
                    <div class="modal-botoes">
                        <button type="submit" class="btn-salvar">Salvar</button>
                        <button type="button" id="btn-deletar" class="btn-deletar">Deletar</button>
                        <button type="button" id="btn-fechar" class="btn-fechar">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-fechar').addEventListener('click', fecharModal);
    document.getElementById('modal-transacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-transacao') fecharModal();
    });

    const editTipo = document.getElementById('edit-tipo');
    editTipo.addEventListener('change', () => {
        popularSelectCategorias(document.getElementById('edit-categoria'), editTipo.value);
    });

    document.getElementById('form-edicao').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = {
            valor: document.getElementById('edit-valor').value,
            tipo: document.getElementById('edit-tipo').value,
            categoria: document.getElementById('edit-categoria').value
        };
        await fetch(`${API}/transacoes/${transacaoAtualId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        fecharModal();
        if (onSalvar) onSalvar();
    });

    document.getElementById('btn-deletar').addEventListener('click', async () => {
        const idParaDeletar = transacaoAtualId;
        const el = document.querySelector(`[data-id="${idParaDeletar}"]`);
        fecharModal();
        if (el) {
            el.classList.add('saindo');
            await new Promise(r => setTimeout(r, 400));
        }
        await fetch(`${API}/transacoes/${idParaDeletar}`, { method: 'DELETE' });
        if (onDeletar) onDeletar();
    });
}

export async function abrirModal(transacao, callbacks = {}) {
    onSalvar = callbacks.onSalvar || null;
    onDeletar = callbacks.onDeletar || null;
    transacaoAtualId = transacao.id;

    const dataEdicao = transacao.data_edicao ? ` (editado em ${transacao.data_edicao})` : '';
    document.getElementById('modal-titulo').textContent = `Transação — ${transacao.data}${dataEdicao}`;
    document.getElementById('edit-valor').value = transacao.valor;
    document.getElementById('edit-tipo').value = transacao.tipo;

    const editCategoria = document.getElementById('edit-categoria');
    await popularSelectCategorias(editCategoria, transacao.tipo);
    editCategoria.value = transacao.categoria;

    document.getElementById('modal-transacao').style.display = 'flex';
}

export function fecharModal() {
    document.getElementById('modal-transacao').style.display = 'none';
    transacaoAtualId = null;
}