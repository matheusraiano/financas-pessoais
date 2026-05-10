let anoAtual = new Date().getFullYear();
let mesAtual = new Date().getMonth() + 1;
let containerAtivo = null; // referência do container atual

const listeners = [];

export function getPeriodo() {
    return { ano: anoAtual, mes: mesAtual };
}

export function onPeriodoMudou(fn) {
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
    containerAtivo = container; // salva referência
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

    container.querySelector('#cal-ano-anterior').addEventListener('click', () => {
        if (anoAtual <= anoMin) return;
        anoAtual--;
        atualizarDisplay();
        notificar();
    });

    container.querySelector('#cal-ano-proximo').addEventListener('click', () => {
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
    if (!containerAtivo) return;

    // busca APENAS dentro do container ativo
    const display = containerAtivo.querySelector('#cal-ano-display');
    if (display) display.textContent = anoAtual;

    containerAtivo.querySelectorAll('.cal-mes').forEach(btn => {
        btn.classList.toggle('ativo', Number(btn.dataset.mes) === mesAtual);
    });
}