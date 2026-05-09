//
// ================================
// DASHBOARD
// ================================
//
export function inicializarDashboard() {
    console.log('Dashboard carregado');
    // cleanup
    cleanupFunctions.push(() => {
        clearInterval(relogioInterval);
    });
}