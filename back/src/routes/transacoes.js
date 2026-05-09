import { Router } from 'express';
import { listar, resumo, criar, deletar, atualizar, fluxoPorMes, gastosPorCategoria } from '../controllers/transacoesController.js';

const router = Router();

router.get('/', listar);
router.get('/resumo', resumo);
router.post('/', criar);
router.delete('/:id', deletar);
router.put('/:id', atualizar);
router.get('/fluxo', fluxoPorMes);
router.get('/categorias-gastos', gastosPorCategoria);

export default router;