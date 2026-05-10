import { Router } from 'express';
import { listar, resumoPorAtivo, totalGeral, criar, deletar } from '../controllers/investimentosController.js';

const router = Router();

router.get('/', listar);
router.get('/resumo', resumoPorAtivo);
router.get('/total', totalGeral);
router.post('/', criar);
router.delete('/:id', deletar);

export default router;