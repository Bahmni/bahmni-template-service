import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export default class AssetService {
  constructor(templatesDir) {
    this.assetsDir = path.join(templatesDir, 'assets');
  }

  toDataUri(relativePath) {
    if (typeof relativePath !== 'string') {
      throw new Error(`asset filter expects a quoted string, got: ${typeof relativePath}. Use {{ 'filename.png' | asset }}`);
    }
    const filePath = path.join(this.assetsDir, relativePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext];
    if (!mime) {
      throw new Error(`Unsupported asset type: ${ext}`);
    }
    const data = fs.readFileSync(filePath);
    return `data:${mime};base64,${data.toString('base64')}`;
  }
}
