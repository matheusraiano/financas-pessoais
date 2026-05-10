import pool from '../database/connection.js';

export async function listar(req, res) {
    const { tipo } = req.query;

    let sql = 'SELECT * FROM investimentos';
    const params = [];

    if (tipo && tipo !== 'todos') {
        sql += ' WHERE tipo = ?';
        params.push(tipo);
    }

    sql += ' ORDER BY data DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
}

export async function resumoPorAtivo(req, res) {
    const [rows] = await pool.query(`
        SELECT
            nome,
            tipo,
            SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS total_investido,
            SUM(CASE WHEN operacao = 'aporte' THEN cotas ELSE -cotas END) AS total_cotas,
            COUNT(*) AS num_aportes,
            MIN(data) AS primeiro_aporte,
            MAX(data) AS ultimo_aporte
        FROM investimentos
        GROUP BY nome, tipo
        HAVING total_investido > 0
        ORDER BY total_investido DESC
    `);
    res.json(rows);
}

export async function totalGeral(req, res) {
    const [rows] = await pool.query(`
        SELECT
            SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS total,
            SUM(CASE WHEN tipo = 'renda_fixa' AND operacao = 'aporte' THEN valor
                     WHEN tipo = 'renda_fixa' AND operacao = 'retirada' THEN -valor
                     ELSE 0 END) AS renda_fixa,
            SUM(CASE WHEN tipo = 'renda_variavel' AND operacao = 'aporte' THEN valor
                     WHEN tipo = 'renda_variavel' AND operacao = 'retirada' THEN -valor
                     ELSE 0 END) AS renda_variavel
        FROM investimentos
    `);

    const { total, renda_fixa, renda_variavel } = rows[0];
    res.json({
        total: Number(total) || 0,
        renda_fixa: Number(renda_fixa) || 0,
        renda_variavel: Number(renda_variavel) || 0
    });
}

export async function criar(req, res) {
    const { nome, tipo, operacao, valor, cotas, data } = req.body;

    if (!nome || !tipo || !valor || !data) {
        return res.status(400).json({ erro: 'Nome, tipo, valor e data são obrigatórios' });
    }

    const valorNumerico = parseFloat(String(valor).replace(',', '.'));

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({ erro: 'Valor inválido' });
    }

    const operacaoFinal = operacao || 'aporte';

    // valida se tem saldo suficiente para retirada
    if (operacaoFinal === 'retirada') {
        const [saldo] = await pool.query(`
            SELECT SUM(CASE WHEN operacao = 'aporte' THEN valor ELSE -valor END) AS total
            FROM investimentos WHERE nome = ?
        `, [nome.toUpperCase()]);

        if ((Number(saldo[0].total) || 0) < valorNumerico) {
            return res.status(400).json({ erro: 'Saldo insuficiente para retirada' });
        }
    }

    const [result] = await pool.query(
        'INSERT INTO investimentos (nome, tipo, operacao, valor, cotas, data) VALUES (?, ?, ?, ?, ?, ?)',
        [nome.toUpperCase(), tipo, operacaoFinal, valorNumerico, cotas || null, data]
    );

    res.status(201).json({ id: result.insertId, nome, tipo, operacao: operacaoFinal, valor: valorNumerico, cotas, data });
}

export async function deletar(req, res) {
    const [result] = await pool.query(
        'DELETE FROM investimentos WHERE id = ?',
        [req.params.id]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ erro: 'Registro não encontrado' });
    }

    res.status(204).send();
}