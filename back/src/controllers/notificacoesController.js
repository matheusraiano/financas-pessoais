import pool from '../database/connection.js';

export async function listar(req, res) {
    const { ano, mes } = req.query;

    let sql = 'SELECT * FROM notificacoes';
    const params = [];

    if (ano && mes) {
        sql += ' WHERE ano = ? AND mes = ?';
        params.push(ano, mes);
    }

    sql += ' ORDER BY criada_em DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows);
}

export async function marcarLida(req, res) {
    await pool.query('UPDATE notificacoes SET lida = TRUE WHERE id = ?', [req.params.id]);
    res.status(204).send();
}

export async function marcarTodasLidas(req, res) {
    const { ano, mes } = req.body;
    await pool.query(
        'UPDATE notificacoes SET lida = TRUE WHERE ano = ? AND mes = ?',
        [ano, mes]
    );
    res.status(204).send();
}

export async function gerarNotificacoes(req, res) {
    const { ano, mes } = req.query;

    if (!ano || !mes) {
        return res.status(400).json({ erro: 'ano e mes são obrigatórios' });
    }

    const novas = [];

    // resumo do mês
    const [resumo] = await pool.query(`
        SELECT
            SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) AS receitas,
            SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) AS despesas
        FROM transacoes
        WHERE YEAR(data) = ? AND MONTH(data) = ?
    `, [ano, mes]);

    const receitas = Number(resumo[0].receitas) || 0;
    const despesas = Number(resumo[0].despesas) || 0;
    const saldo = receitas - despesas;

    // alerta: saldo negativo
    if (saldo < 0) {
        novas.push({
            tipo: 'alerta',
            mensagem: `Saldo negativo em ${mes}/${ano}: ${formatar(saldo)}.`
        });
    }

    // alerta: despesas maiores que receitas
    if (despesas > receitas && saldo >= 0) {
        novas.push({
            tipo: 'alerta',
            mensagem: `Despesas (${formatar(despesas)}) maiores que receitas (${formatar(receitas)}) em ${mes}/${ano}.`
        });
    }

    // total investido geral
    const [totalInv] = await pool.query(`
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

    const totalInvestido = Number(totalInv[0].total) || 0;
    const rendaFixa = Number(totalInv[0].renda_fixa) || 0;
    const rendaVariavel = Number(totalInv[0].renda_variavel) || 0;

    // alerta: diversificação
    if (totalInvestido > 0) {
        const percFixa = (rendaFixa / totalInvestido) * 100;
        const percVariavel = (rendaVariavel / totalInvestido) * 100;

        if (percFixa > 80) {
            novas.push({
                tipo: 'alerta',
                mensagem: `Carteira concentrada: ${percFixa.toFixed(1)}% em renda fixa. Considere diversificar.`
            });
        }

        if (percVariavel > 80) {
            novas.push({
                tipo: 'alerta',
                mensagem: `Carteira concentrada: ${percVariavel.toFixed(1)}% em renda variável. Considere diversificar.`
            });
        }
    }

    // metas
    const [metas] = await pool.query('SELECT * FROM metas');

    for (const meta of metas) {
        if (meta.tipo === 'categoria') {
            const [rows] = await pool.query(`
                SELECT SUM(valor) AS total FROM transacoes
                WHERE tipo = 'despesa' AND categoria = ?
                AND YEAR(data) = ? AND MONTH(data) = ?
            `, [meta.categoria, ano, mes]);

            const total = Number(rows[0].total) || 0;
            if (total > Number(meta.valor)) {
                novas.push({
                    tipo: 'meta',
                    mensagem: `Meta de "${meta.categoria}" ultrapassada: gasto ${formatar(total)} de ${formatar(meta.valor)} permitido.`
                });
            }
        }

        if (meta.tipo === 'economia') {
            if (saldo < Number(meta.valor)) {
                novas.push({
                    tipo: 'meta',
                    mensagem: `Meta de economia não atingida: saldo ${formatar(saldo)} de ${formatar(meta.valor)} esperado.`
                });
            }
        }

        if (meta.tipo === 'receita') {
            if (receitas < Number(meta.valor)) {
                novas.push({
                    tipo: 'meta',
                    mensagem: `Meta de receita não atingida: ${formatar(receitas)} de ${formatar(meta.valor)} esperado.`
                });
            }
        }

        if (meta.tipo === 'investimento') {
            if (totalInvestido < Number(meta.valor)) {
                novas.push({
                    tipo: 'meta',
                    mensagem: `Meta de investimento não atingida: ${formatar(totalInvestido)} de ${formatar(meta.valor)} investido.`
                });
            }
        }
    }

    await pool.query('DELETE FROM notificacoes WHERE ano = ? AND mes = ?', [ano, mes]);

    for (const n of novas) {
        await pool.query(
            'INSERT INTO notificacoes (tipo, mensagem, ano, mes) VALUES (?, ?, ?, ?)',
            [n.tipo, n.mensagem, ano, mes]
        );
    }

    const [resultado] = await pool.query(
        'SELECT * FROM notificacoes WHERE ano = ? AND mes = ? ORDER BY criada_em DESC',
        [ano, mes]
    );

    res.json(resultado);
}

function formatar(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}