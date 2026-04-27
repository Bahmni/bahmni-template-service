import bwipjs from 'bwip-js';

export async function generateBarcode(value, format = 'code128', height = 30) {
  if (!value) return '';
  const png = await bwipjs.toBuffer({
    bcid: format,
    text: String(value),
    scale: 2,
    height,
    includetext: true,
    textxalign: 'center',
  });
  const b64 = png.toString('base64');
  return `data:image/png;base64,${b64}`;
}

export async function generateQrcode(value, size = 150) {
  if (!value) return '';
  const png = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: String(value),
    scale: 3,
    width: Math.round(size / 3),
    height: Math.round(size / 3),
  });
  const b64 = png.toString('base64');
  return `data:image/png;base64,${b64}`;
}

