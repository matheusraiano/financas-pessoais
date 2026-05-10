import pool from '../database/connection.js';

export async function listar(req, res) {
    const [rows] = await pool.query('SELECT * FROM metas ORDER BY id DESC');
    res.json(rows);
}

export async function criar(req, res) {
    const { tipo, categoria, valor, descricao } = req.body;

    if (!tipo || !valor) {
        return res.status(400).json({ erro: 'Tipo e valor são obrigatórios' });
    }

    if (tipo === 'categoria' && !categoria) {
        return res.status(400).json({ erro: 'Categoria é obrigatória para este tipo de meta' });
    }

    const [result] = await pool.query(
        'INSERT INTO metas (tipo, categoria, valor, descricao) VALUES (?, ?, ?, ?)',
        [tipo, categoria || null, valor, descricao || null]
    );

    res.status(201).json({ id: result.insertId, tipo, categoria, valor, descricao });
}

export async function deletar(req, res) {
    const [result] = await pool.query('DELETE FROM metas WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Meta não encontrada' });
    }

    res.status(204).send();
}