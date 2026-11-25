import pool from '../database/connection.js';

export async function listar(req, res) {
    try {
        const { todas } = req.query;
        const sql = todas === 'true'
            ? 'SELECT * FROM categorias ORDER BY ativa DESC, nome ASC'
            : 'SELECT * FROM categorias WHERE ativa = TRUE ORDER BY nome ASC';

        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (e) {
        console.error('Erro ao listar categorias:', e);
        res.status(500).json({ erro: 'Erro interno ao listar categorias' });
    }
}

export async function criar(req, res) {
    try {
        const { nome, tipo } = req.body;

        if (!nome || !tipo) {
            return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
        }

        const [existente] = await pool.query(
            'SELECT * FROM categorias WHERE LOWER(nome) = LOWER(?)',
            [nome]
        );

        if (existente.length > 0) {
            const cat = existente[0];
            if (!cat.ativa) {
                return res.status(409).json({
                    erro: `A categoria "${cat.nome}" já existe mas está inativa. Reative-a na lista de categorias.`,
                    inativa: true
                });
            }
            return res.status(409).json({
                erro: `Já existe uma categoria com o nome "${cat.nome}".`
            });
        }

        const [result] = await pool.query(
            'INSERT INTO categorias (nome, tipo) VALUES (?, ?)',
            [nome, tipo]
        );

        res.status(201).json({ id: result.insertId, nome, tipo, ativa: true });
    } catch (e) {
        console.error('Erro ao criar categoria:', e);
        res.status(500).json({ erro: 'Erro interno ao criar categoria' });
    }
}

export async function toggleAtivo(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT ativa FROM categorias WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ erro: 'Categoria não encontrada' });
        }

        const novoEstado = !rows[0].ativa;

        await pool.query(
            'UPDATE categorias SET ativa = ? WHERE id = ?',
            [novoEstado, req.params.id]
        );

        res.json({ ativa: novoEstado });
    } catch (e) {
        console.error('Erro ao alternar categoria:', e);
        res.status(500).json({ erro: 'Erro interno ao alternar categoria' });
    }
}

export async function deletar(req, res) {
    try {
        const id = req.params.id;

        const [uso] = await pool.query(
            `SELECT COUNT(*) AS total FROM transacoes 
             WHERE categoria = (SELECT nome FROM categorias WHERE id = ?)`,
            [id]
        );

        if (uso[0].total > 0) {
            return res.status(409).json({
                erro: 'Categoria não pode ser deletada pois já foi usada em transações. Inative-a.'
            });
        }

        const [result] = await pool.query(
            'DELETE FROM categorias WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Categoria não encontrada' });
        }

        res.status(204).send();
    } catch (e) {
        console.error('Erro ao deletar categoria:', e);
        res.status(500).json({ erro: 'Erro interno ao deletar categoria' });
    }
}
