import { Router } from 'express';
import {
    listarCotacoes,
    historicoAtivo,
    taxaCdi,
    resumoCarteira
} from '../controllers/cotacoesController.js';

const router = Router();

router.get('/', listarCotacoes);
router.get('/cdi', taxaCdi);
router.get('/resumo-carteira', resumoCarteira);
router.get('/:ticker/historico', historicoAtivo);

export default router;
