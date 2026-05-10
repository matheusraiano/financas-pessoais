import pool from '../database/connection.js';

export async function buscar(req, res) {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
        return res.status(400).json({ erro: 'Busca muito curta' });
    }

    const termo = q.trim();
    const termoLike = `%${termo}%`;

    // verifica se é um número
    const isNumero = !isNaN(termo.replace(',', '.'));
    const valor = isNumero ? parseFloat(termo.replace(',', '.')) : null;

    // verifica se é uma data no formato dd/mm/aaaa ou aaaa-mm-dd
    const dataFormatada = parsearData(termo);

    const params_like = [termoLike];

    // busca transações por categoria, valor ou data
    let sqlTransacoes = `
        SELECT id, categoria, valor, tipo, data, data_edicao, 'transacao' AS origem
        FROM transacoes
        WHERE categoria LIKE ?
    `;

    if (valor !== null) {
        const margem = valor * 0.10;
        const minimo = valor - margem;
        const maximo = valor + margem;

        sqlTransacoes += ' OR valor BETWEEN ? AND ?';
        params_like.push(minimo, maximo);
    }

    if (dataFormatada) {
        sqlTransacoes += ' OR data = ?';
        params_like.push(dataFormatada);
    }

    sqlTransacoes += ' ORDER BY data DESC LIMIT 15';

    const [transacoes] = await pool.query(sqlTransacoes, params_like);

    // busca investimentos por nome, valor ou data
    const params_inv = [termoLike];
    let sqlInvestimentos = `
        SELECT id, nome, valor, tipo, operacao, data, 'investimento' AS origem
        FROM investimentos
        WHERE nome LIKE ?
    `;

    if (valor !== null) {
        const margem = valor * 0.10;
        const minimo = valor - margem;
        const maximo = valor + margem;

        sqlInvestimentos += ' OR valor BETWEEN ? AND ?';
        params_inv.push(minimo, maximo);
    }

    if (dataFormatada) {
        sqlInvestimentos += ' OR data = ?';
        params_inv.push(dataFormatada);
    }

    sqlInvestimentos += ' ORDER BY data DESC LIMIT 15';

    const [investimentos] = await pool.query(sqlInvestimentos, params_inv);

    // busca categorias por nome
    const [categorias] = await pool.query(`
        SELECT id, nome, tipo, ativa, 'categoria' AS origem
        FROM categorias
        WHERE nome LIKE ?
        ORDER BY nome ASC
        LIMIT 10
    `, [termoLike]);

    res.json({ transacoes, investimentos, categorias });
}

function parsearData(termo) {
    // aceita dd/mm/aaaa
    const ptBR = termo.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ptBR) return `${ptBR[3]}-${ptBR[2]}-${ptBR[1]}`;

    // aceita aaaa-mm-dd
    const iso = termo.match(/^\d{4}-\d{2}-\d{2}$/);
    if (iso) return termo;

    return null;
}