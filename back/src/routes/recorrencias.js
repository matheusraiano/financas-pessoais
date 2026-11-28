import { Router } from 'express';
import {
    listar,
    criar,
    toggleAtivo,
    deletar,
    processar,
    previsaoMes
} from '../controllers/recorrenciasController.js';

const router = Router();

// Rotas específicas antes de /:id para evitar conflito
router.get('/previsao', previsaoMes);
router.post('/processar', processar);

router.get('/', listar);
router.post('/', criar);
router.patch('/:id/toggle', toggleAtivo);
router.delete('/:id', deletar);

export default router;
