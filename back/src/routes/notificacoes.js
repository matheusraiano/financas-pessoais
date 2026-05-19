import { Router } from 'express';
import { listar, marcarLida, marcarTodasLidas, gerarNotificacoes, toggleLida } from '../controllers/notificacoesController.js';

const router = Router();

router.get('/', listar);
router.get('/gerar', gerarNotificacoes);
router.patch('/todas/lidas', marcarTodasLidas);
router.patch('/:id/lida', marcarLida);
router.patch('/:id/toggle-lida', toggleLida);

export default router;