let anoAtual = new Date().getFullYear();
let mesAtual = new Date().getMonth() + 1;

const listeners = [];

export function getPeriodo() {
    return { ano: anoAtual, mes: mesAtual };
}

export function onPeriodoMudou(fn) {
    // evita duplicar o mesmo listener ao recarregar a página
    if (!listeners.includes(fn)) listeners.push(fn);
}

export function removerListeners() {
    listeners.length = 0;
}

function notificar() {
    listeners.forEach(fn => fn({ ano: anoAtual, mes: mesAtual }));
}

export function inicializarCalendario(containerId = 'seletor-periodo') {
    const container = document.getElementById(containerId);
    if (!container) return;
    renderizarCalendario(container);
}

function renderizarCalendario(container) {
    const meses = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    const anoMin = new Date().getFullYear() - 3;
    const anoMax = new Date().getFullYear();

    container.innerHTML = `
        <div class="calendario-periodo">
            <div class="calendario-header">
                <button id="cal-ano-anterior" class="cal-btn">‹</button>
                <span id="cal-ano-display">${anoAtual}</span>
                <button id="cal-ano-proximo" class="cal-btn">›</button>
            </div>
            <div class="calendario-meses">
                ${meses.map((m, i) => `
                    <button 
                        class="cal-mes ${(i + 1) === mesAtual ? 'ativo' : ''}" 
                        data-mes="${i + 1}">
                        ${m}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('cal-ano-anterior').addEventListener('click', () => {
        if (anoAtual <= anoMin) return;
        anoAtual--;
        atualizarDisplay();
        notificar();
    });

    document.getElementById('cal-ano-proximo').addEventListener('click', () => {
        if (anoAtual >= anoMax) return;
        anoAtual++;
        atualizarDisplay();
        notificar();
    });

    container.querySelectorAll('.cal-mes').forEach(btn => {
        btn.addEventListener('click', () => {
            mesAtual = Number(btn.dataset.mes);
            atualizarDisplay();
            notificar();
        });
    });
}

function atualizarDisplay() {
    document.getElementById('cal-ano-display').textContent = anoAtual;
    document.querySelectorAll('.cal-mes').forEach(btn => {
        btn.classList.toggle('ativo', Number(btn.dataset.mes) === mesAtual);
    });
}