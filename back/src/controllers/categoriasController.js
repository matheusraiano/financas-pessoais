import pool from '../database/connection.js';

export async function listar(req, res) {
    const [rows] = await pool.query('SELECT * FROM categorias ORDER BY nome ASC');
    res.json(rows);
}

export async function criar(req, res) {
    const { nome, tipo } = req.body;

    if (!nome || !tipo) {
        return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
    }

    const [result] = await pool.query(
        'INSERT INTO categorias (nome, tipo) VALUES (?, ?)',
        [nome, tipo]
    );

    res.status(201).json({ id: result.insertId, nome, tipo });
}