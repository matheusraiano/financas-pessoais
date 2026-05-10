import pool from '../database/connection.js';

export async function listar(req, res) {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
    }

    const [rows] = await pool.query(
        'SELECT * FROM metas WHERE ano = ? AND mes = ? ORDER BY id DESC',
        [ano, mes]
    );
    res.json(rows);
}

export async function criar(req, res) {
    const { tipo, categoria, valor, descricao, ano, mes } = req.body;

    if (!tipo || !valor || !ano || !mes) {
        return res.status(400).json({ erro: 'Tipo, valor, ano e mes são obrigatórios' });
    }

    if (tipo === 'categoria' && !categoria) {
        return res.status(400).json({ erro: 'Categoria é obrigatória para este tipo de meta' });
    }

    const [result] = await pool.query(
        'INSERT INTO metas (tipo, categoria, valor, descricao, ano, mes) VALUES (?, ?, ?, ?, ?, ?)',
        [tipo, categoria || null, valor, descricao || null, ano, mes]
    );

    res.status(201).json({ id: result.insertId, tipo, categoria, valor, descricao, ano, mes });
}

export async function deletar(req, res) {
    const [result] = await pool.query('DELETE FROM metas WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Meta não encontrada' });
    }

    res.status(204).send();
}