import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '@/constant';
import {
  copyR2Object,
  deleteR2Object,
  getR2ObjectBuffer,
  getR2ObjectRange,
  isR2Configured,
  listR2Directories,
  listR2DirectoryContents,
  listR2Objects,
  putR2Object,
  r2ObjectExists,
  toUploadsKey,
} from '@/lib/cloudflare/r2';

/**
 * uploads 资源访问层：
 * - 配置了 R2 时读写 R2（key 形如 uploads/images/gallery/a.webp）
 * - 未配置 R2 时退回本地 uploads 目录，保证本地开发不依赖云端
 *
 * 对外只暴露「目录 → 文件列表 / 文件内容 / 删除」，
 * 具体走 R2 还是本地由环境变量决定。
 */

export interface UploadEntry {
  /** 文件名（不含目录） */
  name: string;
  /** R2 key（如 uploads/a.webp）或本地绝对路径 */
  key: string;
  size: number;
  lastModified: Date;
}

/** 本地绝对路径 → R2 key */
function localPathToKey(localPath: string): string {
  const relative = path.relative(UPLOADS_DIR, localPath);
  return toUploadsKey(relative.split(path.sep).join('/'));
}

/**
 * 是否是本地磁盘绝对路径。
 * 注意 Windows 下 `/uploads/a.webp` 也会被 path.isAbsolute 判为 true，
 * 需要先排除这种逻辑路径。
 */
function isLocalAbsolutePath(target: string): boolean {
  const normalized = target.replace(/\\/g, '/');
  if (normalized.startsWith('/uploads/')) return false;
  return path.isAbsolute(target);
}

/**
 * R2 key → 本地绝对路径（未配置 R2 时使用）。
 * turbopackIgnore：抑制构建期文件系统追踪，避免把整个项目打进 standalone 产物；
 * 该分支只在本地开发（未配置 R2）时执行，生产不会读本地磁盘。
 */
function keyToLocalPath(key: string): string {
  if (isLocalAbsolutePath(key)) return key;
  return path.join(
    /*turbopackIgnore: true*/
    process.cwd(),
    key.replace(/^\/+/, '').split('/').join(path.sep)
  );
}

/** 目录绝对路径 → R2 前缀（带结尾斜杠） */
function dirToR2Prefix(dir: string): string {
  const relative = path.relative(UPLOADS_DIR, dir);
  const normalized = relative.split(path.sep).join('/').replace(/^\/+/, '');
  return normalized ? `${toUploadsKey(normalized)}/` : toUploadsKey('');
}

/** 生成可直接给前端用的 /uploads/... 逻辑路径 */
export function toUploadUrl(keyOrPath: string): string {
  const normalized = keyOrPath.replace(/\\/g, '/');
  if (!isLocalAbsolutePath(keyOrPath)) {
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  }
  const relative = path
    .relative(UPLOADS_DIR, keyOrPath)
    .split(path.sep)
    .join('/');
  return `/uploads/${relative}`;
}

function matchesExtension(name: string, extensions: string[]): boolean {
  if (name.startsWith('.') || name.startsWith('_')) return false;
  if (name.includes('/')) return false;
  if (extensions.length === 0) return true;
  return extensions.includes(path.extname(name).toLowerCase());
}

/** 列出目录下的文件（忽略隐藏文件、_ 前缀文件与子目录） */
export async function listUploadFiles(
  dir: string,
  extensions: string[] = []
): Promise<UploadEntry[]> {
  if (!isR2Configured()) {
    const entries = await fs.promises
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry): Promise<UploadEntry | null> => {
          const filePath = path.join(dir, entry.name);
          try {
            const stats = await fs.promises.stat(filePath);
            return {
              name: entry.name,
              key: filePath,
              size: stats.size,
              lastModified: stats.mtime,
            };
          } catch {
            return null;
          }
        })
    );
    return files
      .filter((file): file is UploadEntry => file !== null)
      .filter((file) => matchesExtension(file.name, extensions));
  }

  const prefix = dirToR2Prefix(dir);
  const objects = await listR2Objects(prefix);
  return objects
    .map((object) => ({
      name: object.key.slice(prefix.length),
      key: object.key,
      size: object.size,
      lastModified: object.lastModified,
    }))
    .filter((file) => matchesExtension(file.name, extensions));
}

/** 列出目录下的一级子目录 */
export async function listUploadSubdirectories(
  dir: string
): Promise<Array<{ name: string; dir: string }>> {
  if (!isR2Configured()) {
    const entries = await fs.promises
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        dir: path.join(dir, entry.name),
      }));
  }

  const names = await listR2Directories(dirToR2Prefix(dir));
  return names.map((name) => ({ name, dir: path.join(dir, name) }));
}

/** 读取文件内容，接受 R2 key 或本地绝对路径 */
export async function readUploadFile(key: string): Promise<Buffer> {
  if (!isR2Configured() || isLocalAbsolutePath(key)) {
    return fs.promises.readFile(/*turbopackIgnore: true*/ keyToLocalPath(key));
  }
  return getR2ObjectBuffer(toUploadsKey(key));
}

/**
 * 读取文件开头若干字节（图片宽高都在头部），避免为取尺寸下载整张图。
 * R2 走 Range 请求，本地只读文件头部。
 */
export async function readUploadFileHead(
  key: string,
  bytes = 64 * 1024
): Promise<Buffer> {
  if (!isR2Configured() || isLocalAbsolutePath(key)) {
    const handle = await fs.promises.open(
      /*turbopackIgnore: true*/ keyToLocalPath(key),
      'r'
    );
    try {
      const { size } = await handle.stat();
      const length = Math.min(bytes, size);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, 0);
      return buffer;
    } finally {
      await handle.close();
    }
  }

  return getR2ObjectRange(toUploadsKey(key), 0, bytes - 1);
}

/** 删除文件，接受 R2 key 或本地绝对路径 */
export async function deleteUploadFile(key: string): Promise<void> {
  if (!isR2Configured() || isLocalAbsolutePath(key)) {
    await fs.promises.unlink(keyToLocalPath(key));
    return;
  }
  await deleteR2Object(toUploadsKey(key));
}

/** 把逻辑路径 / 本地路径统一成 R2 key */
export function resolveUploadKey(pathname: string): string {
  if (isLocalAbsolutePath(pathname)) return localPathToKey(pathname);
  return toUploadsKey(pathname);
}

export interface UploadDirEntry extends UploadEntry {
  type: 'file' | 'directory';
  /** 小写扩展名，不含点；目录为空串 */
  extension: string;
}

/** 列出目录下的文件与一级子目录（不过滤隐藏文件，供文件管理器使用） */
export async function listUploadEntries(
  dir: string
): Promise<UploadDirEntry[]> {
  if (!isR2Configured()) {
    const dirents = await fs.promises
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
    const entries = await Promise.all(
      dirents.map(async (entry): Promise<UploadDirEntry | null> => {
        const fullPath = path.join(dir, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          const isDirectory = entry.isDirectory();
          return {
            name: entry.name,
            key: fullPath,
            size: stats.size,
            lastModified: stats.mtime,
            type: isDirectory ? 'directory' : 'file',
            extension: isDirectory
              ? ''
              : path.extname(entry.name).replace(/^\./, '').toLowerCase(),
          };
        } catch {
          return null;
        }
      })
    );
    return entries.filter((entry): entry is UploadDirEntry => entry !== null);
  }

  const prefix = dirToR2Prefix(dir);
  const { files, directories } = await listR2DirectoryContents(prefix);
  const entries: UploadDirEntry[] = [];

  for (const file of files) {
    const name = file.key.slice(prefix.length);
    if (!name) continue;
    entries.push({
      name,
      key: file.key,
      size: file.size,
      lastModified: file.lastModified,
      type: 'file',
      extension: path.extname(name).replace(/^\./, '').toLowerCase(),
    });
  }

  for (const directoryPrefix of directories) {
    const name = directoryPrefix.slice(prefix.length).replace(/\/$/, '');
    if (!name) continue;
    entries.push({
      name,
      key: `${prefix}${name}`,
      size: 0,
      // delimiter 列表不返回子目录时间，页面里对目录不展示更新时间
      lastModified: new Date(0),
      type: 'directory',
      extension: '',
    });
  }

  return entries;
}

/** 文件是否存在 */
export async function uploadFileExists(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    try {
      return (
        await fs.promises.stat(/*turbopackIgnore: true*/ keyToLocalPath(key))
      ).isFile();
    } catch {
      return false;
    }
  }
  return r2ObjectExists(toUploadsKey(key));
}

/** 是否是目录（R2 通过前缀判断） */
export async function isUploadDirectory(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    try {
      return (
        await fs.promises.stat(/*turbopackIgnore: true*/ keyToLocalPath(key))
      ).isDirectory();
    } catch {
      return false;
    }
  }

  const target = toUploadsKey(key).replace(/\/+$/, '');
  const prefix = `${target}/`;
  if (await r2ObjectExists(prefix)) return true;
  const [objects, directories] = await Promise.all([
    listR2Objects(prefix),
    listR2Directories(prefix),
  ]);
  return objects.length > 0 || directories.length > 0;
}

/** 写入文件（自动创建父目录 / R2 前缀） */
export async function putUploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<string> {
  const target = resolveUploadKey(key);
  if (!isR2Configured()) {
    const localPath = keyToLocalPath(target);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await fs.promises.writeFile(localPath, body);
    return target;
  }
  await putR2Object(target, body, contentType);
  return target;
}

/** 复制文件（用于重命名） */
export async function copyUploadFile(
  sourceKey: string,
  targetKey: string
): Promise<string> {
  const source = resolveUploadKey(sourceKey);
  const target = resolveUploadKey(targetKey);

  if (!isR2Configured()) {
    const targetPath = keyToLocalPath(target);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(keyToLocalPath(source), targetPath);
    return target;
  }

  await copyR2Object(source, target);
  return target;
}

/** 创建目录：R2 用 0 字节占位对象末尾带 / */
export async function createUploadDirectory(key: string): Promise<string> {
  const target = resolveUploadKey(key).replace(/\/+$/, '');
  if (!isR2Configured()) {
    await fs.promises.mkdir(keyToLocalPath(target), { recursive: true });
    return target;
  }
  await putR2Object(`${target}/`, Buffer.alloc(0), 'application/x-directory');
  return target;
}

/** 删除目录及其下所有对象 */
export async function deleteUploadDirectory(key: string): Promise<void> {
  const target = resolveUploadKey(key).replace(/\/+$/, '');
  if (!isR2Configured()) {
    await fs.promises.rm(keyToLocalPath(target), {
      recursive: true,
      force: true,
    });
    return;
  }

  const prefix = `${target}/`;
  const objects = await listR2Objects(prefix);
  await Promise.all([
    deleteR2Object(prefix),
    ...objects.map((object) => deleteR2Object(object.key)),
  ]);
}

/**
 * 重命名文件或目录。
 * R2 没有原子 rename，目录通过逐个复制到新前缀后删除旧前缀实现。
 */
export async function renameUploadEntry(
  sourceKey: string,
  newName: string
): Promise<string> {
  const source = resolveUploadKey(sourceKey).replace(/\/+$/, '');
  const parent = source.slice(0, source.lastIndexOf('/'));
  const target = `${parent}/${newName}`;

  if (!isR2Configured()) {
    await fs.promises.rename(keyToLocalPath(source), keyToLocalPath(target));
    return target;
  }

  if (await isUploadDirectory(source)) {
    const prefix = `${source}/`;
    const objects = await listR2Objects(prefix);
    await Promise.all(
      objects.map((object) =>
        copyR2Object(object.key, `${target}/${object.key.slice(prefix.length)}`)
      )
    );
    await deleteUploadDirectory(source);
    return target;
  }

  await copyR2Object(source, target);
  await deleteR2Object(source);
  return target;
}
