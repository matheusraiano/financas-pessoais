import pool from '../database/connection.js';

function filtroData(ano, mes) {
    return {
        sql: 'YEAR(data) = ? AND MONTH(data) = ?',
        params: [ano, mes]
    };
}

export async function listar(req, res) {
    try {
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
    } catch (e) {
        console.error('Erro ao listar transações:', e);
        res.status(500).json({ erro: 'Erro interno ao listar transações' });
    }
}

export async function resumo(req, res) {
    try {
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
    } catch (e) {
        console.error('Erro ao calcular resumo:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular resumo' });
    }
}

export async function criar(req, res) {
    try {
        const { valor, tipo, categoria, data, descricao } = req.body;

        if (!valor || !tipo) {
            return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
        }

        const valorNumerico = parseFloat(String(valor).replace(',', '.'));

        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({ erro: 'Valor inválido' });
        }

        const dataFinal = data || new Date().toISOString().split('T')[0];

        const [result] = await pool.query(
            'INSERT INTO transacoes (valor, tipo, categoria, data, descricao) VALUES (?, ?, ?, ?, ?)',
            [valorNumerico, tipo, categoria || 'Outros', dataFinal, descricao || null]
        );

        res.status(201).json({ id: result.insertId, valor: valorNumerico, tipo, categoria, data: dataFinal, descricao });
    } catch (e) {
        console.error('Erro ao criar transação:', e);
        res.status(500).json({ erro: 'Erro interno ao criar transação' });
    }
}

export async function atualizar(req, res) {
    try {
        const { valor, tipo, categoria, data, descricao } = req.body;

        if (!valor || !tipo) {
            return res.status(400).json({ erro: 'Valor e tipo são obrigatórios' });
        }

        const dataEdicao = new Date().toISOString().split('T')[0];

        const [result] = await pool.query(
            `UPDATE transacoes SET valor = ?, tipo = ?, categoria = ?, data = ?, descricao = ?, data_edicao = ? WHERE id = ?`,
            [valor, tipo, categoria, data || null, descricao || null, dataEdicao, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Transação não encontrada' });
        }

        res.json({ id: req.params.id, valor, tipo, categoria, data, descricao, dataEdicao });
    } catch (e) {
        console.error('Erro ao atualizar transação:', e);
        res.status(500).json({ erro: 'Erro interno ao atualizar transação' });
    }
}

export async function deletar(req, res) {
    try {
        const [result] = await pool.query(
            'DELETE FROM transacoes WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ erro: 'Transação não encontrada' });
        }

        res.status(204).send();
    } catch (e) {
        console.error('Erro ao deletar transação:', e);
        res.status(500).json({ erro: 'Erro interno ao deletar transação' });
    }
}

export async function fluxoPorMes(req, res) {
    try {
        const { ano } = req.query;

        let sql = `
            SELECT 
                DATE_FORMAT(data, '%Y-%m') AS mes,
                SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
                SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
            FROM transacoes
        `;

        const params = [];

        if (ano) {
            sql += ' WHERE YEAR(data) = ?';
            params.push(ano);
        }

        sql += ' GROUP BY mes ORDER BY mes ASC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (e) {
        console.error('Erro ao calcular fluxo:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular fluxo' });
    }
}

export async function gastosPorCategoria(req, res) {
    try {
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
    } catch (e) {
        console.error('Erro ao calcular gastos por categoria:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular gastos por categoria' });
    }
}

export async function receitasPorCategoria(req, res) {
    try {
        const { ano, mes } = req.query;

        if (!ano || !mes) {
            return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
        }

        const [rows] = await pool.query(`
            SELECT categoria, SUM(valor) AS total
            FROM transacoes
            WHERE tipo = 'receita' AND YEAR(data) = ? AND MONTH(data) = ?
            GROUP BY categoria
            ORDER BY total DESC
        `, [ano, mes]);

        res.json(rows);
    } catch (e) {
        console.error('Erro ao calcular receitas por categoria:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular receitas por categoria' });
    }
}
