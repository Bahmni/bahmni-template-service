import request from 'supertest';
import createApp from '../../src/app.js';

const app = createApp();
const RENDER = '/template-service/api/v1/render';
const TEMPLATES = '/template-service/api/v1/templates';

describe('Health check', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /health with provider returns enhanced info', async () => {
    const appWithProvider = createApp({
      healthProvider: () => ({ status: 'ok', templates: 3, chromium: false, uptime: 10 }),
    });
    const res = await request(appWithProvider).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', templates: 3, chromium: false, uptime: 10 });
  });
});

describe(`GET ${TEMPLATES}`, () => {
  test('returns list of enabled templates', async () => {
    const res = await request(app).get(TEMPLATES);
    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(2);
    expect(res.body.templates[0]).toHaveProperty('id');
  });
});

describe(`POST ${RENDER} — validation`, () => {
  test('400 when templateId missing', async () => {
    const res = await request(app).post(RENDER).send({});
    expect(res.status).toBe(400);
  });

  test('404 for unknown templateId', async () => {
    const res = await request(app).post(RENDER).send({ templateId: 'NOPE' });
    expect(res.status).toBe(404);
  });
});

describe(`POST ${RENDER} — passthrough registration card`, () => {
  const payload = {
    templateId: 'REG_CARD_V1',
    format: 'html',
    locale: 'en',
    data: {
      patient: {
        uuid: 'test-uuid-1234',
        identifier: 'BAH200045',
        name: 'Arthi Sai',
        gender: 'Female',
        birthDate: '1980-04-15',
        address: '12 Main Street, Juba',
        registrationDate: '2026-04-09',
      },
      facility: { name: 'District Hospital' },
    },
  };

  test('returns HTML with patient data and barcode', async () => {
    const res = await request(app).post(RENDER).send(payload);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('Arthi Sai');
    expect(res.text).toContain('BAH200045');
    expect(res.text).toContain('data:image/png;base64,');
    expect(res.text).toContain('District Hospital');
  });

  test('renders with French locale', async () => {
    const res = await request(app).post(RENDER).send({ ...payload, locale: 'fr' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('lang="fr"');
    expect(res.text).toContain('ID Patient');
    expect(res.text).toContain('Date de Naissance');
  });

  test('email format returns JSON with CID attachments', async () => {
    const res = await request(app).post(RENDER).send({ ...payload, format: 'email' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('html');
    expect(res.body).toHaveProperty('attachments');
    expect(res.body.html).toContain('cid:');
    expect(res.body.attachments.length).toBeGreaterThan(0);
    expect(res.body.attachments[0]).toHaveProperty('contentType', 'image/png');
  });
});
