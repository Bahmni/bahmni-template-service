import { Router } from 'express';
import TemplateService from '../services/template-service.js';

const router = Router();
const templateService = new TemplateService();

router.get('/', (req, res) => {
  res.json({ templates: templateService.listTemplates() });
});

export default router;
export { templateService };
