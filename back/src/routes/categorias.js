import { Router } from 'express';
import { listar, criar, toggleAtivo } from '../controllers/categoriasController.js';

const router = Router();

router.get('/', listar);
router.post('/', criar);
router.patch('/:id/toggle', toggleAtivo);

export default router;