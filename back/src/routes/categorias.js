import { Router } from 'express';
import { listar, criar, toggleAtivo, deletar } from '../controllers/categoriasController.js';

const router = Router();

router.get('/', listar);
router.post('/', criar);
router.patch('/:id/toggle', toggleAtivo);
router.delete('/:id', deletar);

export default router;