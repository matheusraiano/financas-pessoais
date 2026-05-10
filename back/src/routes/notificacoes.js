import { Router } from 'express';
import { listar, marcarLida, marcarTodasLidas, gerarNotificacoes } from '../controllers/notificacoesController.js';

const router = Router();

router.get('/', listar);
router.get('/gerar', gerarNotificacoes);
router.patch('/:id/lida', marcarLida);
router.patch('/todas/lidas', marcarTodasLidas);

export default router;