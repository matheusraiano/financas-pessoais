import pool from '../database/connection.js';

export async function listar(req, res) {
    // por padrão só retorna ativas, mas aceita ?todas=true
    const { todas } = req.query;
    const sql = todas === 'true'
        ? 'SELECT * FROM categorias ORDER BY nome ASC'
        : 'SELECT * FROM categorias WHERE ativa = TRUE ORDER BY nome ASC';

    const [rows] = await pool.query(sql);
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

    res.status(201).json({ id: result.insertId, nome, tipo, ativa: true });
}

export async function desativar(req, res) {
    const [result] = await pool.query(
        'UPDATE categorias SET ativa = FALSE WHERE id = ?',
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Categoria não encontrada' });
    }

    res.status(204).send();
}