// converte "2026-05-10" para "10/05/2026" sem fuso horário
export function formatarData(dataStr) {
    if (!dataStr) return '';
    const [ano, mes, dia] = String(dataStr).split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
}

export function formatarValor(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}