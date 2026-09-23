/**
 * 浏览器端文件下载工具。
 */

/**
 * 触发浏览器下载一个 Blob。
 *
 * 实现方式：基于 Blob 创建临时对象 URL，挂到隐藏的临时 `<a>` 上并触发点击，
 * 下载触发后立即移除 `<a>` 并调用 `URL.revokeObjectURL` 释放对象 URL，
 * 避免内存泄漏（对象 URL 会一直占用内存直到被显式释放）。
 *
 * @param blob 待下载的二进制内容
 * @param filename 下载文件名（建议包含扩展名）
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
