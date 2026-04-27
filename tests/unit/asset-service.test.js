import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AssetService from '../../src/services/asset-service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '..', 'fixtures', 'assets');

// 1x1 red pixel PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

// 1x1 white pixel JPEG
const TINY_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
  'base64',
);

beforeAll(() => {
  fs.mkdirSync(path.join(fixtureDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(fixtureDir, 'assets', 'logo.png'), TINY_PNG);
  fs.writeFileSync(path.join(fixtureDir, 'assets', 'photo.jpg'), TINY_JPG);
  fs.writeFileSync(path.join(fixtureDir, 'assets', 'photo.jpeg'), TINY_JPG);
});

describe('AssetService', () => {
  const service = new AssetService(fixtureDir);

  test('converts PNG to data URI', () => {
    const uri = service.toDataUri('logo.png');
    expect(uri).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  });

  test('converts JPG to data URI', () => {
    const uri = service.toDataUri('photo.jpg');
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('converts JPEG to data URI', () => {
    const uri = service.toDataUri('photo.jpeg');
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('throws on undefined input', () => {
    expect(() => service.toDataUri(undefined)).toThrow('asset filter expects a quoted string');
  });

  test('throws on non-string input', () => {
    expect(() => service.toDataUri(42)).toThrow('asset filter expects a quoted string');
  });

  test('throws on unsupported file type', () => {
    expect(() => service.toDataUri('style.css')).toThrow('Unsupported asset type: .css');
  });

  test('throws on missing file', () => {
    expect(() => service.toDataUri('nonexistent.png')).toThrow();
  });
});
