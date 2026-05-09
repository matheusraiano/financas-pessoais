import pool from '../database/connection.js';

export async function listar(req, res) {
    const [rows] = await pool.query(
        'SELECT * FROM transacoes ORDER BY data DESC'
    );
    res.json(rows);
}

export async function resumo(req, res) {
    const [rows] = await pool.query(`
        SELECT
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes
    `);

    const { receitas, despesas } = rows[0];
    res.json({
        receitas: Number(receitas) || 0,
        despesas: Number(despesas) || 0,
        saldo: (Number(receitas) || 0) - (Number(despesas) || 0)
    });
}

export async function criar(req, res) {
    const { descricao, valor, tipo, categoria } = req.body;

    if (!valor || !tipo) {
        return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
    }

    const data = new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
        'INSERT INTO transacoes (descricao, valor, tipo, categoria, data) VALUES (?, ?, ?, ?, ?)',
        [descricao || '', valor, tipo, categoria || 'outros', data]
    );

    res.status(201).json({ id: result.insertId, descricao, valor, tipo, categoria, data });
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

export async function atualizar(req, res) {
    const { descricao, valor, tipo, categoria } = req.body;

    if (!valor || !tipo) {
        return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
    }

    const dataEdicao = new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
        `UPDATE transacoes 
         SET descricao = ?, valor = ?, tipo = ?, categoria = ?, data_edicao = ?
         WHERE id = ?`,
        [descricao, valor, tipo, categoria, dataEdicao, req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Transação não encontrada' });
    }

    res.json({ id: req.params.id, descricao, valor, tipo, categoria, dataEdicao });
}