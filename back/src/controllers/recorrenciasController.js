import pool from '../database/connection.js';

// ─── Migration automática ────────────────────────────────────────────────────
// Garante que as tabelas existam sem precisar rodar SQL manualmente.

export async function migrar() {
    await pool.query(`
        ALTER TABLE transacoes
        ADD COLUMN IF NOT EXISTS recorrente BOOLEAN NOT NULL DEFAULT FALSE
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS recorrencias (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            descricao   VARCHAR(255),
            valor       DECIMAL(15,2) NOT NULL,
            tipo        ENUM('receita','despesa') NOT NULL,
            categoria   VARCHAR(100),
            dia_do_mes  TINYINT NOT NULL DEFAULT 1,
            ativa       BOOLEAN NOT NULL DEFAULT TRUE,
            criada_em   DATE NOT NULL
        )
    `);
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listar(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM recorrencias ORDER BY id DESC'
        );
        res.json(rows);
    } catch (e) {
        console.error('Erro ao listar recorrências:', e);
        res.status(500).json({ erro: 'Erro interno ao listar recorrências' });
    }
}

export async function criar(req, res) {
    try {
        const { descricao, valor, tipo, categoria, dia_do_mes } = req.body;

        if (!valor || !tipo || !dia_do_mes) {
            return res.status(400).json({ erro: 'valor, tipo e dia_do_mes são obrigatórios' });
        }

        const dia = Number(dia_do_mes);
        if (dia < 1 || dia > 28) {
            return res.status(400).json({ erro: 'dia_do_mes deve ser entre 1 e 28' });
        }

        const [result] = await pool.query(
            `INSERT INTO recorrencias (descricao, valor, tipo, categoria, dia_do_mes, ativa, criada_em)
             VALUES (?, ?, ?, ?, ?, TRUE, CURDATE())`,
            [descricao || null, valor, tipo, categoria || 'Outros', dia]
        );

        res.status(201).json({ id: result.insertId, descricao, valor, tipo, categoria, dia_do_mes: dia });
    } catch (e) {
        console.error('Erro ao criar recorrência:', e);
        res.status(500).json({ erro: 'Erro interno ao criar recorrência' });
    }
}

export async function toggleAtivo(req, res) {
    try {
        const [rows] = await pool.query('SELECT ativa FROM recorrencias WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ erro: 'Recorrência não encontrada' });

        const novoEstado = !rows[0].ativa;
        await pool.query('UPDATE recorrencias SET ativa = ? WHERE id = ?', [novoEstado, req.params.id]);
        res.json({ id: req.params.id, ativa: novoEstado });
    } catch (e) {
        console.error('Erro ao alternar recorrência:', e);
        res.status(500).json({ erro: 'Erro interno ao alternar recorrência' });
    }
}

export async function deletar(req, res) {
    try {
        const [result] = await pool.query('DELETE FROM recorrencias WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ erro: 'Recorrência não encontrada' });
        res.status(204).send();
    } catch (e) {
        console.error('Erro ao deletar recorrência:', e);
        res.status(500).json({ erro: 'Erro interno ao deletar recorrência' });
    }
}

// ─── Processar (lançar recorrências do mês) ──────────────────────────────────

export async function processar(req, res) {
    try {
        const { ano, mes } = req.query;

        if (!ano || !mes) {
            return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
        }

        const [recorrencias] = await pool.query(
            'SELECT * FROM recorrencias WHERE ativa = TRUE'
        );

        let lancadas = 0;

        for (const r of recorrencias) {
            // Idempotência: verifica se já existe uma transação recorrente
            // com mesma categoria, tipo e valor no mês
            const [existentes] = await pool.query(
                `SELECT id FROM transacoes
                 WHERE recorrente = TRUE
                   AND categoria = ?
                   AND tipo = ?
                   AND valor = ?
                   AND YEAR(data) = ?
                   AND MONTH(data) = ?
                 LIMIT 1`,
                [r.categoria, r.tipo, r.valor, ano, mes]
            );

            if (existentes.length > 0) continue;

            // Monta a data: ano-mes-dia_do_mes (limitado ao último dia do mês)
            const diasNoMes = new Date(ano, mes, 0).getDate();
            const dia = Math.min(r.dia_do_mes, diasNoMes);
            const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

            await pool.query(
                `INSERT INTO transacoes (valor, tipo, categoria, data, descricao, recorrente)
                 VALUES (?, ?, ?, ?, ?, TRUE)`,
                [r.valor, r.tipo, r.categoria, data, r.descricao || null]
            );

            lancadas++;
        }

        res.json({ lancadas, total: recorrencias.length });
    } catch (e) {
        console.error('Erro ao processar recorrências:', e);
        res.status(500).json({ erro: 'Erro interno ao processar recorrências' });
    }
}

// ─── Previsão de saldo (feature #4 — depende das recorrências) ───────────────

export async function previsaoMes(req, res) {
    try {
        const { ano, mes } = req.query;

        if (!ano || !mes) {
            return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
        }

        // Saldo atual do mês
        const [resumo] = await pool.query(`
            SELECT
                SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
                SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
            FROM transacoes
            WHERE YEAR(data) = ? AND MONTH(data) = ?
        `, [ano, mes]);

        const receitasAtuais = Number(resumo[0].receitas) || 0;
        const despesasAtuais = Number(resumo[0].despesas) || 0;
        const saldoAtual = receitasAtuais - despesasAtuais;

        // Recorrências ainda não lançadas no mês (dia_do_mes > hoje se for o mês atual)
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth() + 1;
        const diaHoje = hoje.getDate();

        const [recorrencias] = await pool.query(
            'SELECT * FROM recorrencias WHERE ativa = TRUE'
        );

        let receitasPrevistas = 0;
        let despesasPrevistas = 0;

        for (const r of recorrencias) {
            // Verifica se já foi lançada
            const [existentes] = await pool.query(
                `SELECT id FROM transacoes
                 WHERE recorrente = TRUE
                   AND categoria = ?
                   AND tipo = ?
                   AND valor = ?
                   AND YEAR(data) = ?
                   AND MONTH(data) = ?
                 LIMIT 1`,
                [r.categoria, r.tipo, r.valor, ano, mes]
            );

            if (existentes.length > 0) continue; // já lançada, não conta como prevista

            // Só conta como "ainda a lançar" se for o mês atual e o dia ainda não passou
            const isMesAtual = Number(ano) === anoAtual && Number(mes) === mesAtual;
            if (isMesAtual && r.dia_do_mes <= diaHoje) continue;

            if (r.tipo === 'receita') receitasPrevistas += Number(r.valor);
            else despesasPrevistas += Number(r.valor);
        }

        res.json({
            saldo_atual: saldoAtual,
            receitas_previstas: receitasPrevistas,
            despesas_previstas: despesasPrevistas,
            saldo_previsto: saldoAtual + receitasPrevistas - despesasPrevistas
        });
    } catch (e) {
        console.error('Erro ao calcular previsão:', e);
        res.status(500).json({ erro: 'Erro interno ao calcular previsão' });
    }
}
