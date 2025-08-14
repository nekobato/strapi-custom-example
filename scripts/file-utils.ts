import fs from 'fs/promises';
import path from 'path';

export interface FileSearchResult {
  found: boolean;
  filePath?: string;
  actualFileName?: string;
}

/**
 * 複数のディレクトリでファイルを検索する
 */
export async function findAssetFile(
  assetId: string,
  expectedFileName: string,
  searchDirectories: string[]
): Promise<FileSearchResult> {
  
  for (const searchDir of searchDirectories) {
    const assetDir = path.join(searchDir, assetId);
    
    try {
      const subdirs = await fs.readdir(assetDir);
      
      for (const subdir of subdirs) {
        const subdirPath = path.join(assetDir, subdir);
        
        try {
          const files = await fs.readdir(subdirPath);
          
          // 完全一致を最初に試行
          let matchingFile = files.find(file => file === expectedFileName);
          
          // 大文字小文字を無視して検索
          if (!matchingFile) {
            matchingFile = files.find(file => 
              file.toLowerCase() === expectedFileName.toLowerCase()
            );
          }
          
          // ファイル拡張子を無視して検索
          if (!matchingFile) {
            const expectedBaseName = path.parse(expectedFileName).name.toLowerCase();
            matchingFile = files.find(file => {
              const baseName = path.parse(file).name.toLowerCase();
              return baseName === expectedBaseName;
            });
          }
          
          // 部分一致で検索（ファイル名にタイムスタンプなどが付加されている場合）
          if (!matchingFile) {
            matchingFile = files.find(file => {
              const fileName = file.toLowerCase();
              const expected = expectedFileName.toLowerCase();
              return fileName.includes(expected) || expected.includes(fileName);
            });
          }
          
          if (matchingFile) {
            return {
              found: true,
              filePath: path.join(subdirPath, matchingFile),
              actualFileName: matchingFile
            };
          }
        } catch (error) {
          // サブディレクトリの読み込みに失敗した場合はスキップ
          continue;
        }
      }
    } catch (error) {
      // アセットディレクトリが存在しない場合はスキップ
      continue;
    }
  }
  
  return { found: false };
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * ファイルの MIME タイプを拡張子から推定
 */
export function getMimeTypeFromExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // 画像
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    
    // 動画
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    
    // ドキュメント
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // アーカイブ
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    
    // テキスト
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * ディレクトリ内のファイル統計を取得
 */
export async function getDirectoryStats(dirPath: string): Promise<{
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
}> {
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    fileTypes: {} as Record<string, number>
  };
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.isDirectory()) {
        const subStats = await getDirectoryStats(path.join(dirPath, item.name));
        stats.totalFiles += subStats.totalFiles;
        stats.totalSize += subStats.totalSize;
        
        // ファイルタイプをマージ
        for (const [type, count] of Object.entries(subStats.fileTypes)) {
          stats.fileTypes[type] = (stats.fileTypes[type] || 0) + count;
        }
      } else {
        const filePath = path.join(dirPath, item.name);
        const fileStat = await fs.stat(filePath);
        const ext = path.extname(item.name).toLowerCase();
        
        stats.totalFiles++;
        stats.totalSize += fileStat.size;
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
      }
    }
  } catch (error) {
    // ディレクトリにアクセスできない場合はスキップ
  }
  
  return stats;
}

/**
 * バックアップディレクトリの分析
 */
export async function analyzeBackupDirectory(backupPath: string): Promise<void> {
  console.log('=== Backup Directory Analysis ===\n');
  
  const directories = [
    'images.ctfassets.net/kxe5qiticei6',
    'videos.ctfassets.net/kxe5qiticei6', 
    'downloads.ctfassets.net/kxe5qiticei6',
    'assets.ctfassets.net/kxe5qiticei6'
  ];
  
  for (const dir of directories) {
    const dirPath = path.join(backupPath, dir);
    console.log(`Analyzing ${dir}...`);
    
    try {
      const stats = await getDirectoryStats(dirPath);
      
      console.log(`  Files: ${stats.totalFiles}`);
      console.log(`  Total Size: ${formatFileSize(stats.totalSize)}`);
      console.log(`  File Types:`);
      
      const sortedTypes = Object.entries(stats.fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10); // トップ10のみ表示
        
      for (const [ext, count] of sortedTypes) {
        console.log(`    ${ext || 'no extension'}: ${count} files`);
      }
      
    } catch (error) {
      console.log(`  Error: Directory not found or inaccessible`);
    }
    
    console.log('');
  }
  
  console.log('=== End Analysis ===\n');
}