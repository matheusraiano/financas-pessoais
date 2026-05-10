import { Router } from 'express';
import { buscar } from '../controllers/buscaController.js';

const router = Router();
router.get('/', buscar);
export default router;