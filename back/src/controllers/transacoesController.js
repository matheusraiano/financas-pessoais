import pool from '../database/connection.js';

// helper para montar o filtro de data
function filtroData(ano, mes) {
    return {
        sql: 'YEAR(data) = ? AND MONTH(data) = ?',
        params: [ano, mes]
    };
}

export async function listar(req, res) {
    const { ano, mes, tipo, categoria } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
    }

    let sql = 'SELECT * FROM transacoes WHERE YEAR(data) = ? AND MONTH(data) = ?';
    const params = [ano, mes];

    if (tipo && tipo !== 'todos') {
        sql += ' AND tipo = ?';
        params.push(tipo);
    }

    if (categoria && categoria !== 'todos') {
        sql += ' AND categoria = ?';
        params.push(categoria);
    }

    sql += ' ORDER BY data DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
}

export async function resumo(req, res) {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
    }

    const filtro = filtroData(ano, mes);

    const [rows] = await pool.query(`
        SELECT
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes
        WHERE ${filtro.sql}
    `, filtro.params);

    const { receitas, despesas } = rows[0];
    res.json({
        receitas: Number(receitas) || 0,
        despesas: Number(despesas) || 0,
        saldo: (Number(receitas) || 0) - (Number(despesas) || 0)
    });
}

export async function criar(req, res) {
    const { valor, tipo, categoria, data } = req.body;

    if (!valor || !tipo) {
        return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
    }

    // usa a data enviada pelo frontend, ou hoje como fallback
    const dataFinal = data || new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
        'INSERT INTO transacoes (valor, tipo, categoria, data) VALUES (?, ?, ?, ?)',
        [valor, tipo, categoria || 'outros', dataFinal]
    );

    res.status(201).json({ id: result.insertId, valor, tipo, categoria, data: dataFinal });
}

export async function atualizar(req, res) {
    const { valor, tipo, categoria } = req.body;

    if (!valor || !tipo) {
        return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
    }

    const dataEdicao = new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
        `UPDATE transacoes SET valor = ?, tipo = ?, categoria = ?, data_edicao = ? WHERE id = ?`,
        [valor, tipo, categoria, dataEdicao, req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Transação não encontrada' });
    }

    res.json({ id: req.params.id, valor, tipo, categoria, dataEdicao });
}

export async function deletar(req, res) {
    const [result] = await pool.query(
        'DELETE FROM transacoes WHERE id = ?',
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Transação não encontrada' });
    }

    res.status(204).send();
}

export async function fluxoPorMes(req, res) {
    const [rows] = await pool.query(`
        SELECT 
            DATE_FORMAT(data, '%Y-%m') AS mes,
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes
        GROUP BY mes
        ORDER BY mes ASC
        LIMIT 12
    `);
    res.json(rows);
}

export async function gastosPorCategoria(req, res) {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
    }

    const filtro = filtroData(ano, mes);

    const [rows] = await pool.query(`
        SELECT categoria, SUM(valor) AS total
        FROM transacoes
        WHERE tipo = 'despesa' AND ${filtro.sql}
        GROUP BY categoria
        ORDER BY total DESC
    `, filtro.params);

    res.json(rows);
}