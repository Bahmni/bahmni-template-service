/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import * as bwipjs from 'bwip-js';
import nunjucks from 'nunjucks';
import logger from '../logger';
import { htmlEscape } from '../utils';

type BarcodeCallback = (
  err: Error | null,
  result: nunjucks.runtime.SafeString,
) => void;

export function formatDate(value: string, locale?: string): string {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString(locale, { month: 'long' });
    return `${day} ${month} ${date.getFullYear()}`;
  } catch {
    return value;
  }
}

export function calculateAge(birthDate: string): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  const days = Math.floor((now.getTime() - birth.getTime()) / 86_400_000);
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() - birth.getMonth() - (now.getDate() < birth.getDate() ? 1 : 0);
  const years = Math.floor(months / 12);
  const p = (n: number, w: string) => `${n} ${w}${n !== 1 ? 's' : ''}`;
  if (days < 30) return p(days, 'day');
  if (months < 24) return p(months, 'month');
  return p(years, 'year');
}

export function round(value: number, decimals: number = 0): string {
  if (value == null || isNaN(value)) return '';
  return value.toFixed(decimals);
}

export function barcodeFilter(...args: unknown[]): void {
  const callback = args.pop() as BarcodeCallback;
  const [value, type = 'code128', height = 40] = args as [
    string,
    string?,
    number?,
  ];
  renderBarcode(value, type, height)
    .then((html) => callback(null, new nunjucks.runtime.SafeString(html)))
    .catch((err: Error) => callback(err, new nunjucks.runtime.SafeString('')));
}

function toImgTag(base64: string, alt: string): string {
  return `<img src="data:image/png;base64,${base64}" alt="${alt}" style="display:block;" />`;
}

export async function renderBarcode(
  value: string,
  type: string = 'code128',
  height: number = 40,
): Promise<string> {
  const escapedValue = htmlEscape(value);
  const fallback = `<span class="barcode-fallback">${escapedValue}</span>`;
  try {
    const png = await bwipjs.toBuffer({
      bcid: type,
      text: String(value),
      height,
      includetext: true,
      textxalign: 'center',
    });
    return toImgTag(png.toString('base64'), escapedValue);
  } catch (err) {
    logger.error({ err }, 'Barcode generation failed');
    return fallback;
  }
}

export function qrcodeFilter(...args: unknown[]): void {
  const callback = args.pop() as BarcodeCallback;
  const [value, scale = 3] = args as [string, number?];
  renderQRCode(value, scale)
    .then((html) => callback(null, new nunjucks.runtime.SafeString(html)))
    .catch((err: Error) => callback(err, new nunjucks.runtime.SafeString('')));
}

export async function renderQRCode(
  value: string,
  scale: number = 3,
): Promise<string> {
  if (!value) return '';
  const escapedValue = htmlEscape(value);
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'qrcode',
      text: String(value),
      scale,
    });
    return toImgTag(png.toString('base64'), escapedValue);
  } catch (err) {
    logger.error({ err }, 'QR code generation failed');
    return `<span class="qrcode-fallback">${escapedValue}</span>`;
  }
}
