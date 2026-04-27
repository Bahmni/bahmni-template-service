let cidCounter = 0;

export function process(html) {
  const attachments = [];
  const regex = /<img\s+([^>]*)src="data:([^;]+);base64,([^"]+)"([^>]*)>/g;

  const processedHtml = html.replace(regex, (match, pre, contentType, base64Data, post) => {
    cidCounter++;
    const cid = `img-${cidCounter}-${Date.now()}`;
    attachments.push({
      cid,
      content: base64Data,
      encoding: 'base64',
      contentType,
    });
    return `<img ${pre}src="cid:${cid}"${post}>`;
  });

  return { html: processedHtml, attachments };
}
