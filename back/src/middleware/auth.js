export function autenticar(req, res, next) {
    // Permite requisições OPTIONS (preflight CORS) sem autenticação
    if (req.method === 'OPTIONS') return next();

    const senha = req.headers['x-app-password'];
    if (!process.env.APP_PASSWORD || senha !== process.env.APP_PASSWORD) {
        return res.status(401).json({ erro: 'Não autorizado' });
    }
    next();
}
