/*
 * This Source Code Form is subject to the terms of the Mozilla Public License,
 * v. 2.0. If a copy of the MPL was not distributed with this file, You can
 * obtain one at https://www.bahmni.org/license/mplv2hd.
 *
 * Copyright 2026. Thoughtworks. Thoughtworks is a registered trademark
 * and the Thoughtworks graphic logo is a trademark of Thoughtworks Inc.
 */

import { processEmail } from '@src/email/emailPostprocessor';

jest.mock('juice', () => ({
  __esModule: true,
  default: jest.fn((html: string) => html),
}));
const mockJuice = jest.requireMock('juice');

describe('processEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJuice.default.mockImplementation((html: string) => html);
  });

  it('passes html through juice for CSS inlining', async () => {
    const html =
      '<html><head><style>.foo{color:red}</style></head><body></body></html>';

    await processEmail(html);

    expect(mockJuice.default).toHaveBeenCalledWith(html, {
      applyWidthAttributes: true,
      applyAttributesTableElements: true,
    });
  });

  it('inlines CSS by using the output of juice, not the original html', async () => {
    const original =
      '<html><head><style>.foo{color:red}</style></head><body><p class="foo"></p></body></html>';
    const inlined =
      '<html><head></head><body><p class="foo" style="color:red;"></p></body></html>';
    mockJuice.default.mockReturnValue(inlined);

    const result = await processEmail(original);

    expect(result.html).toBe(inlined);
  });

  it('extracts base64 images and replaces with cid references', async () => {
    const html =
      '<p>Hello</p><img src="data:image/png;base64,AAAA" alt="logo"><img src="data:image/png;base64,BBBB" alt="qr">';

    const result = await processEmail(html);

    expect(result.attachments).toHaveLength(2);
    expect(result.html).not.toContain('data:image/png;base64');
    expect(result.html).toContain('cid:');
    expect(result.attachments[0].content).toBe('AAAA');
    expect(result.attachments[0].contentType).toBe('image/png');
    expect(result.attachments[0].encoding).toBe('base64');
    expect(result.attachments[1].content).toBe('BBBB');
  });

  it('leaves HTML without images with empty attachments', async () => {
    const html = '<p>No images here</p>';

    const result = await processEmail(html);

    expect(result.attachments).toHaveLength(0);
  });

  it('assigns a unique cid to each image', async () => {
    const html =
      '<img src="data:image/png;base64,AA"><img src="data:image/png;base64,BB">';

    const result = await processEmail(html);

    expect(result.attachments[0].cid).not.toBe(result.attachments[1].cid);
  });

  it('rewrites img src to cid reference in processed html', async () => {
    const html = '<img src="data:image/jpeg;base64,XYZ" alt="photo">';

    const result = await processEmail(html);

    const expectedCid = result.attachments[0].cid;
    expect(result.html).toContain(`src="cid:${expectedCid}"`);
  });

  it('deduplicates identical images so they are attached once and share the same cid', async () => {
    const html =
      '<img src="data:image/png;base64,LOGO"><p></p><img src="data:image/png;base64,LOGO">';

    const result = await processEmail(html);

    expect(result.attachments).toHaveLength(1);
    const cid = result.attachments[0].cid;
    expect(result.html).toBe(
      `<img src="cid:${cid}"><p></p><img src="cid:${cid}">`,
    );
  });
});
