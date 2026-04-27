import config from '../config.js';
import TemplateStore from './template-store.js';

export default class TemplateService {
  constructor() {
    this.store = new TemplateStore(config.templatesDir);
  }

  listTemplates() {
    return this.store.list();
  }
}
