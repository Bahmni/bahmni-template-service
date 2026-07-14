/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { randomUUID } from 'crypto';

import { EmailAttachment, EmailResult } from '../types';

const DATA_URI_IMG_REGEX =
  /<img\s+([^>]*)src="data:([^;]+);base64,([^"]+)"([^>]*)>/g;

export async function processEmail(html: string): Promise<EmailResult> {
  const { default: juice } = await import('juice');
  const inlinedHtml = juice(html, {
    applyWidthAttributes: true,
    applyAttributesTableElements: true,
  });

  const attachments: EmailAttachment[] = [];
  const cidsByContent = new Map<string, string>();

  const processedHtml = inlinedHtml.replace(
    DATA_URI_IMG_REGEX,
    (
      _match,
      pre: string,
      contentType: string,
      base64Data: string,
      post: string,
    ) => {
      const contentKey = `${contentType}:${base64Data}`;
      let cid = cidsByContent.get(contentKey);
      if (!cid) {
        cid = randomUUID();
        cidsByContent.set(contentKey, cid);
        attachments.push({
          cid,
          content: base64Data,
          encoding: 'base64',
          contentType,
        });
      }
      return `<img ${pre}src="cid:${cid}"${post}>`;
    },
  );

  return { html: processedHtml, attachments };
}
