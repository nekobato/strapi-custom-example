import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from 'dotenv';
import { findAssetFile, formatFileSize, getMimeTypeFromExtension } from './file-utils';

// 環境変数を読み込み
config({ path: '.env' });

interface ContentfulAsset {
  sys: {
    id: string;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
  };
  fields: {
    title?: Record<string, string>;
    description?: Record<string, string>;
    file: Record<string, {
      url: string;
      details: {
        size: number;
        image?: {
          width: number;
          height: number;
        };
      };
      fileName: string;
      contentType: string;
    }>;
  };
}

interface AssetMigrationResult {
  contentfulId: string;
  strapiId: string | null;
  success: boolean;
  error?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  title?: string;
  uploadedAt: string;
}

interface MigrationOptions {
  fileType?: 'images' | 'videos' | 'documents' | 'all';
  dryRun?: boolean;
  parallel?: number;
  retries?: number;
}

interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  byType: Record<string, { success: number; failed: number }>;
}

class ContentfulAssetsToStrapiMigrator {
  private strapiUrl: string;
  private strapiToken: string;
  private backupPath: string;
  private options: MigrationOptions;
  private migrationLog: any[] = [];
  private results: AssetMigrationResult[] = [];
  private stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    byType: {}
  };

  constructor(options: MigrationOptions = {}) {
    this.strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    this.strapiToken = process.env.STRAPI_TOKEN || '';
    this.backupPath = path.join(__dirname, '../backup');
    this.options = {
      fileType: 'all',
      dryRun: process.env.DRY_RUN === 'true',
      parallel: 3,
      retries: 2,
      ...options
    };

    if (!this.strapiToken && !this.options.dryRun) {
      throw new Error('STRAPI_TOKEN is required when not running in dry-run mode');
    }
  }

  private log(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    this.migrationLog.push({
      timestamp,
      message,
      data: data || null
    });
  }

  private async loadContentfulAssets(): Promise<ContentfulAsset[]> {
    const exportFilePath = path.join(this.backupPath, 'contentful-export-kxe5qiticei6-master-2025-07-29T13-53-20.json');
    
    try {
      const content = await fs.readFile(exportFilePath, 'utf-8');
      const exportData = JSON.parse(content);
      return exportData.assets || [];
    } catch (error) {
      this.log('Error loading Contentful export file:', error);
      throw error;
    }
  }

  private shouldProcessAsset(asset: ContentfulAsset): boolean {
    if (this.options.fileType === 'all') return true;

    const locale = Object.keys(asset.fields.file)[0] || 'en-US';
    const fileData = asset.fields.file[locale];
    if (!fileData) return false;

    const contentType = fileData.contentType.toLowerCase();
    
    switch (this.options.fileType) {
      case 'images':
        return contentType.startsWith('image/');
      case 'videos':
        return contentType.startsWith('video/');
      case 'documents':
        return contentType === 'application/pdf' || 
               contentType.includes('document') ||
               contentType.includes('text/') ||
               contentType.includes('application/');
      default:
        return true;
    }
  }

  private updateStats(result: AssetMigrationResult) {
    this.stats.total++;
    if (result.success) {
      this.stats.success++;
    } else {
      this.stats.failed++;
    }

    const type = this.getFileTypeCategory(result.contentType);
    if (!this.stats.byType[type]) {
      this.stats.byType[type] = { success: 0, failed: 0 };
    }
    
    if (result.success) {
      this.stats.byType[type].success++;
    } else {
      this.stats.byType[type].failed++;
    }
  }

  private getFileTypeCategory(contentType: string): string {
    if (contentType.startsWith('image/')) return 'images';
    if (contentType.startsWith('video/')) return 'videos';
    if (contentType === 'application/pdf') return 'pdf';
    if (contentType.startsWith('application/')) return 'documents';
    return 'other';
  }

  private async uploadAssetWithRetry(asset: ContentfulAsset, retries = 0): Promise<AssetMigrationResult> {
    const maxRetries = this.options.retries || 2;
    const locale = Object.keys(asset.fields.file)[0] || 'en-US';
    const fileData = asset.fields.file[locale];
    
    const result: AssetMigrationResult = {
      contentfulId: asset.sys.id,
      strapiId: null,
      success: false,
      fileName: fileData?.fileName || 'unknown',
      fileSize: fileData?.details?.size || 0,
      contentType: fileData?.contentType || 'unknown',
      uploadedAt: new Date().toISOString()
    };

    // タイトル情報を追加
    if (asset.fields.title) {
      const titleLocale = Object.keys(asset.fields.title)[0];
      if (asset.fields.title[titleLocale]) {
        result.title = asset.fields.title[titleLocale];
      }
    }

    if (!fileData) {
      result.error = 'No file data found';
      return result;
    }

    try {
      const strapiId = await this.uploadAsset(asset);
      if (strapiId) {
        result.success = true;
        result.strapiId = strapiId;
      } else {
        result.error = 'Upload failed - no ID returned';
      }
      return result;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      
      if (retries < maxRetries) {
        this.log(`Retry ${retries + 1}/${maxRetries} for asset ${asset.sys.id}: ${errorMessage}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
        return this.uploadAssetWithRetry(asset, retries + 1);
      } else {
        result.error = errorMessage;
        this.log(`Failed to upload asset ${asset.sys.id} after ${maxRetries} retries: ${errorMessage}`);
        return result;
      }
    }
  }

  private async uploadAsset(asset: ContentfulAsset): Promise<string | null> {
    const locale = Object.keys(asset.fields.file)[0] || 'en-US';
    const fileData = asset.fields.file[locale];
    
    if (!fileData) {
      this.log(`No file data found for asset ${asset.sys.id}`);
      return null;
    }

    // ファイルパスを決定
    const searchDirs = [
      path.join(this.backupPath, 'images.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'videos.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'downloads.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'assets.ctfassets.net/kxe5qiticei6')
    ];

    const fileSearchResult = await findAssetFile(asset.sys.id, fileData.fileName, searchDirs);
    
    if (!fileSearchResult.found || !fileSearchResult.filePath) {
      throw new Error(`File not found: ${fileData.fileName}`);
    }

    if (this.options.dryRun) {
      this.log(`DRY RUN: Would upload asset ${asset.sys.id} from ${fileSearchResult.filePath}`);
      this.log(`  Original filename: ${fileData.fileName}`);
      this.log(`  Found filename: ${fileSearchResult.actualFileName}`);
      this.log(`  Size: ${formatFileSize(fileData.details.size)}`);
      this.log(`  Type: ${fileData.contentType}`);
      
      // タイトルと説明の情報もログ出力
      if (asset.fields.title) {
        const titleLocales = Object.keys(asset.fields.title);
        titleLocales.forEach(loc => {
          if (asset.fields.title?.[loc]) {
            this.log(`  Title (${loc}): ${asset.fields.title[loc]}`);
          }
        });
      }
      
      if (asset.fields.description) {
        const descLocales = Object.keys(asset.fields.description);
        descLocales.forEach(loc => {
          if (asset.fields.description?.[loc]) {
            this.log(`  Description (${loc}): ${asset.fields.description[loc].substring(0, 100)}...`);
          }
        });
      }
      
      return 'dummy-upload-id';
    }

    // ファイルをFormDataとしてアップロード
    const form = new FormData();
    const fileStream = await fs.readFile(fileSearchResult.filePath);
    
    // MIMEタイプを推定
    const contentType = fileData.contentType || getMimeTypeFromExtension(fileData.fileName);
    
    form.append('files', fileStream, {
      filename: fileData.fileName,
      contentType: contentType,
    });

    // メタデータ情報を準備
    const fileInfo: any = { contentfulId: asset.sys.id };
    
    if (asset.fields.title) {
      const titleLocale = Object.keys(asset.fields.title)[0];
      if (asset.fields.title[titleLocale]) {
        fileInfo.name = asset.fields.title[titleLocale];
        fileInfo.alternativeText = asset.fields.title[titleLocale];
      }
    }
    
    if (asset.fields.description) {
      const descLocale = Object.keys(asset.fields.description)[0];
      if (asset.fields.description[descLocale]) {
        fileInfo.caption = asset.fields.description[descLocale];
      }
    }

    if (Object.keys(fileInfo).length > 1) { // contentfulId以外にデータがある場合
      form.append('fileInfo', JSON.stringify(fileInfo));
    }

    const uploadResponse = await axios.post(`${this.strapiUrl}/api/upload`, form, {
      headers: {
        'Authorization': `Bearer ${this.strapiToken}`,
        ...form.getHeaders(),
      },
    });

    const uploadedFile = uploadResponse.data[0];
    this.log(`✅ Uploaded: ${asset.sys.id} -> Strapi ID: ${uploadedFile.id} (${fileData.fileName})`);
    
    // メタデータを更新
    if (Object.keys(fileInfo).length > 1) {
      try {
        await axios.put(`${this.strapiUrl}/api/upload/files/${uploadedFile.id}`, fileInfo, {
          headers: {
            'Authorization': `Bearer ${this.strapiToken}`,
            'Content-Type': 'application/json',
          },
        });
        this.log(`📝 Updated metadata for asset ${asset.sys.id}`);
      } catch (error) {
        this.log(`⚠️  Warning: Could not update metadata for asset ${asset.sys.id}`);
      }
    }
    
    return uploadedFile.id;
  }

  private async processAssetsInBatches(assets: ContentfulAsset[]): Promise<void> {
    const batchSize = this.options.parallel || 3;
    const batches: ContentfulAsset[][] = [];
    
    for (let i = 0; i < assets.length; i += batchSize) {
      batches.push(assets.slice(i, i + batchSize));
    }

    let processedCount = 0;
    for (const [batchIndex, batch] of batches.entries()) {
      this.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} assets)`);
      
      const batchPromises = batch.map(async (asset) => {
        const result = await this.uploadAssetWithRetry(asset);
        this.results.push(result);
        this.updateStats(result);
        processedCount++;
        
        const progress = ((processedCount / assets.length) * 100).toFixed(1);
        if (result.success) {
          this.log(`[${progress}%] ✅ ${result.fileName} (${formatFileSize(result.fileSize)})`);
        } else {
          this.log(`[${progress}%] ❌ ${result.fileName}: ${result.error}`);
        }
      });

      await Promise.all(batchPromises);
    }
  }

  private async saveResults(): Promise<void> {
    const timestamp = Date.now();
    const basePath = __dirname;

    // アセットマッピングファイルを保存
    const assetMapping: Record<string, string> = {};
    const failedAssets: AssetMigrationResult[] = [];

    for (const result of this.results) {
      if (result.success && result.strapiId) {
        assetMapping[result.contentfulId] = result.strapiId;
      } else {
        failedAssets.push(result);
      }
    }

    // マッピングファイル
    const mappingPath = path.join(basePath, `asset-mapping-${timestamp}.json`);
    await fs.writeFile(mappingPath, JSON.stringify(assetMapping, null, 2));
    this.log(`💾 Asset mapping saved: ${mappingPath}`);

    // 失敗したアセット
    if (failedAssets.length > 0) {
      const failedPath = path.join(basePath, `failed-assets-${timestamp}.json`);
      await fs.writeFile(failedPath, JSON.stringify(failedAssets, null, 2));
      this.log(`📋 Failed assets list saved: ${failedPath}`);
    }

    // 詳細ログ
    const logPath = path.join(basePath, `asset-migration-log-${timestamp}.json`);
    await fs.writeFile(logPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      options: this.options,
      stats: this.stats,
      results: this.results,
      log: this.migrationLog
    }, null, 2));
    this.log(`📊 Migration log saved: ${logPath}`);
  }

  private printStats(): void {
    console.log('\n📊 Migration Statistics:');
    console.log(`Total: ${this.stats.total}`);
    console.log(`✅ Success: ${this.stats.success}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    
    if (Object.keys(this.stats.byType).length > 0) {
      console.log('\nBy file type:');
      Object.entries(this.stats.byType).forEach(([type, stats]) => {
        console.log(`  ${type}: ✅ ${stats.success} / ❌ ${stats.failed}`);
      });
    }
    
    const successRate = this.stats.total > 0 ? ((this.stats.success / this.stats.total) * 100).toFixed(1) : '0';
    console.log(`\n🎯 Success rate: ${successRate}%`);
  }

  async migrate(): Promise<void> {
    try {
      this.log('🚀 Starting Contentful assets migration to Strapi...');
      this.log(`Options: ${JSON.stringify(this.options)}`);
      
      // Contentfulアセットを読み込み
      const allAssets = await this.loadContentfulAssets();
      this.log(`📁 Loaded ${allAssets.length} assets from Contentful export`);

      // フィルタリング
      const assetsToProcess = allAssets.filter(asset => this.shouldProcessAsset(asset));
      this.stats.skipped = allAssets.length - assetsToProcess.length;
      
      this.log(`🎯 Processing ${assetsToProcess.length} assets (${this.stats.skipped} skipped based on file type filter)`);

      if (assetsToProcess.length === 0) {
        this.log('⚠️  No assets to process. Exiting.');
        return;
      }

      // バッチ処理でアップロード
      await this.processAssetsInBatches(assetsToProcess);

      // 結果を保存
      await this.saveResults();

      // 統計を表示
      this.printStats();

      this.log('🎉 Asset migration completed!');

    } catch (error) {
      this.log('💥 Migration failed:', error);
      throw error;
    }
  }
}

// コマンドライン引数の解析
function parseCommandLineArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      const type = arg.split('=')[1] as MigrationOptions['fileType'];
      if (['images', 'videos', 'documents', 'all'].includes(type || '')) {
        options.fileType = type;
      }
    } else if (arg.startsWith('--parallel=')) {
      options.parallel = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--retries=')) {
      options.retries = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

// 実行
async function main() {
  try {
    const options = parseCommandLineArgs();
    const migrator = new ContentfulAssetsToStrapiMigrator(options);
    await migrator.migrate();
  } catch (error) {
    console.error('💥 Asset migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}