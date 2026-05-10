import { Router } from 'express';
import { listar, criar, deletar } from '../controllers/metasController.js';

const router = Router();

router.get('/', listar);
router.post('/', criar);
router.delete('/:id', deletar);

export default router;