/**
 * 存储布局工具单测。
 * 覆盖：扩展名分组归一、相对路径拼接、以及路径穿越（`..` / 绝对路径）必须被拒绝。
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '../src/common/config/config.js';
import {
  extensionFolder,
  resolveStoredPath,
  storageRelativePath,
  toPosixPath,
} from '../src/common/file/storage-layout.js';

describe('extensionFolder', () => {
  it('去掉点并转小写', () => {
    expect(extensionFolder('.PNG')).toBe('png');
    expect(extensionFolder('.pdf')).toBe('pdf');
  });

  it('异常扩展名归入 other（目录名只允许字母数字）', () => {
    expect(extensionFolder('')).toBe('other');
    expect(extensionFolder('.')).toBe('other');
    expect(extensionFolder('.tar.gz')).toBe('other');
    expect(extensionFolder('..%2f')).toBe('other');
  });
});

describe('storageRelativePath', () => {
  it('始终以扩展名分组开头、使用 posix 分隔符', () => {
    expect(storageRelativePath('.jpg', '1730000000_ab12cd34.jpg')).toBe('jpg/1730000000_ab12cd34.jpg');
    expect(storageRelativePath('.TXT', 'a.txt')).toBe('txt/a.txt');
  });
});

describe('resolveStoredPath', () => {
  it('正常相对路径解析为上传目录内绝对路径', () => {
    const resolved = resolveStoredPath('png/a.png');
    expect(resolved).toBe(path.resolve(config.upload.dir, 'png/a.png'));
  });

  it('兼容历史平铺文件名', () => {
    const resolved = resolveStoredPath('1730000000_ab12cd34.png');
    expect(resolved).toBe(path.resolve(config.upload.dir, '1730000000_ab12cd34.png'));
  });

  it('路径穿越与绝对路径一律拒绝', () => {
    expect(resolveStoredPath('../secret.txt')).toBeNull();
    expect(resolveStoredPath('png/../../secret.txt')).toBeNull();
    expect(resolveStoredPath('..\\secret.txt')).toBeNull();
    expect(resolveStoredPath(path.resolve(config.upload.dir, '..', 'secret.txt'))).toBeNull();
  });

  /**
   * 这几条在 POSIX 与 Windows 上必须**行为一致**。
   * 曾经的实现把判断全交给 `path.resolve`，于是 `'..\\secret.txt'` 在 Linux 上只是
   * 合法文件名（不构成穿越）被放行、在 Windows 上却被拒——安全边界跟着部署平台变，
   * CI（ubuntu）上这条用例直接红了。
   */
  it('跨平台一致：反斜杠 / 绝对路径在两套平台语义下都被拒绝', () => {
    expect(resolveStoredPath('png\\a.png')).toBeNull(); // 反斜杠出现在任何位置
    expect(resolveStoredPath('/etc/passwd')).toBeNull(); // POSIX 绝对路径
    expect(resolveStoredPath('C:\\Windows\\win.ini')).toBeNull(); // Windows 绝对路径
    expect(resolveStoredPath('\\\\server\\share\\a.png')).toBeNull(); // UNC
  });
});

describe('toPosixPath', () => {
  it('反斜杠转正斜杠', () => {
    expect(toPosixPath('uploads\\png\\a.png')).toBe('uploads/png/a.png');
    expect(toPosixPath('uploads/png/a.png')).toBe('uploads/png/a.png');
  });
});
