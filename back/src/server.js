import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import transacoesRouter from './routes/transacoes.js';
import categoriasRouter from './routes/categorias.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS (para o frontend conseguir chamar a API)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Rotas
app.use('/api/transacoes', transacoesRouter);
app.use('/api/categorias', categoriasRouter);

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});