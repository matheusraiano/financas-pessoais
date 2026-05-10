import { Router } from 'express';
import { listar, criar, desativar } from '../controllers/categoriasController.js';

const router = Router();

router.get('/', listar);
router.post('/', criar);
router.delete('/:id', desativar); // não deleta, só desativa

export default router;