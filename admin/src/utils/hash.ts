/**
 * 浏览器端文件内容哈希工具。
 * 使用 WebCrypto SubtleCrypto（需安全上下文：HTTPS 或 localhost）。
 */

/**
 * 计算文件内容的 SHA-256 十六进制摘要。
 * 注意：需将文件整体读入内存，适用于当前上传上限（≤10MB）的场景；
 * 若未来放开大文件上传，应改为分片流式计算。
 * @param file 文件对象
 */
export async function sha256Hex(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
