import { Router } from 'express';
import { listar, criar, atualizar, deletar, progressoOrcamentos } from '../controllers/metasController.js';

const router = Router();

// /progresso antes de /:id para evitar conflito
router.get('/progresso', progressoOrcamentos);

router.get('/', listar);
router.post('/', criar);
router.put('/:id', atualizar);
router.delete('/:id', deletar);

export default router;
