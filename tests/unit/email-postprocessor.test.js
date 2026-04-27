import { process } from '../../src/services/email-postprocessor.js';

describe('email post-processor', () => {
  test('extracts base64 images and replaces with cid references', () => {
    const html = '<p>Hello</p><img src="data:image/png;base64,AAAA" alt="logo"><img src="data:image/png;base64,BBBB" alt="qr">';
    const result = process(html);

    expect(result.attachments).toHaveLength(2);
    expect(result.html).not.toContain('data:image/png;base64');
    expect(result.html).toContain('cid:');
    expect(result.attachments[0].content).toBe('AAAA');
    expect(result.attachments[0].contentType).toBe('image/png');
    expect(result.attachments[0].encoding).toBe('base64');
  });

  test('leaves HTML without images unchanged', () => {
    const html = '<p>No images here</p>';
    const result = process(html);
    expect(result.html).toBe(html);
    expect(result.attachments).toHaveLength(0);
  });

  test('each CID is unique', () => {
    const html = '<img src="data:image/png;base64,AA"><img src="data:image/png;base64,BB">';
    const result = process(html);
    expect(result.attachments[0].cid).not.toBe(result.attachments[1].cid);
  });
});
