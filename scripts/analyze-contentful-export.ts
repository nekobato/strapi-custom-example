import fs from 'fs/promises';
import path from 'path';

interface ContentfulExport {
  contentTypes: any[];
  entries: any[];
  assets: any[];
  locales: any[];
}

class ContentfulExportAnalyzer {
  private backupPath: string;

  constructor() {
    this.backupPath = path.join(__dirname, '../backup');
  }

  private async loadContentfulData(): Promise<ContentfulExport> {
    const exportFilePath = path.join(this.backupPath, 'contentful-export-kxe5qiticei6-master-2025-07-29T13-53-20.json');
    
    try {
      const content = await fs.readFile(exportFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading Contentful export file:', error);
      throw error;
    }
  }

  async analyze(): Promise<void> {
    console.log('Loading Contentful export data...');
    const data = await this.loadContentfulData();

    console.log('\n=== Contentful Export Analysis ===\n');

    // 基本統計
    console.log('Basic Statistics:');
    console.log(`  Content Types: ${data.contentTypes.length}`);
    console.log(`  Entries: ${data.entries.length}`);
    console.log(`  Assets: ${data.assets.length}`);
    console.log(`  Locales: ${data.locales.length}`);

    // ロケール情報
    console.log('\nLocales:');
    data.locales.forEach(locale => {
      console.log(`  ${locale.code} - ${locale.name} ${locale.default ? '(default)' : ''}`);
    });

    // コンテンツタイプ分析
    console.log('\nContent Types:');
    data.contentTypes.forEach(contentType => {
      console.log(`  ${contentType.sys.id}: ${contentType.name}`);
      console.log(`    Display Field: ${contentType.displayField}`);
      console.log(`    Fields: ${contentType.fields.length}`);
      
      // フィールドタイプの統計
      const fieldTypes = contentType.fields.reduce((acc: Record<string, number>, field: any) => {
        const type = field.linkType ? `${field.type}(${field.linkType})` : field.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      console.log(`    Field Types: ${Object.entries(fieldTypes).map(([type, count]) => `${type}:${count}`).join(', ')}`);
    });

    // エントリ分析
    console.log('\nEntries by Content Type:');
    const entriesByType = data.entries.reduce((acc: Record<string, number>, entry) => {
      const contentType = entry.sys.contentType.sys.id;
      acc[contentType] = (acc[contentType] || 0) + 1;
      return acc;
    }, {});

    Object.entries(entriesByType)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count} entries`);
      });

    // アセット分析
    console.log('\nAsset Analysis:');
    await this.analyzeAssets(data.assets);

    // サンプルデータ表示
    console.log('\nSample Data:');
    await this.showSampleData(data);
  }

  private async analyzeAssets(assets: any[]): Promise<void> {
    const assetStats = {
      totalSize: 0,
      byType: {} as Record<string, number>,
      byExtension: {} as Record<string, number>,
      withTitle: 0,
      withDescription: 0,
      missingFile: 0
    };

    assets.forEach(asset => {
      const locales = Object.keys(asset.fields.file || {});
      const firstLocale = locales[0];
      
      if (!firstLocale) {
        assetStats.missingFile++;
        return;
      }

      const fileData = asset.fields.file[firstLocale];
      if (fileData) {
        assetStats.totalSize += fileData.details.size;
        
        const contentType = fileData.contentType.split('/')[0];
        assetStats.byType[contentType] = (assetStats.byType[contentType] || 0) + 1;
        
        const ext = path.extname(fileData.fileName).toLowerCase();
        assetStats.byExtension[ext] = (assetStats.byExtension[ext] || 0) + 1;
      }

      if (asset.fields.title) {
        assetStats.withTitle++;
      }
      
      if (asset.fields.description) {
        assetStats.withDescription++;
      }
    });

    console.log(`  Total Assets: ${assets.length}`);
    console.log(`  Total Size: ${this.formatFileSize(assetStats.totalSize)}`);
    console.log(`  With Title: ${assetStats.withTitle} (${((assetStats.withTitle / assets.length) * 100).toFixed(1)}%)`);
    console.log(`  With Description: ${assetStats.withDescription} (${((assetStats.withDescription / assets.length) * 100).toFixed(1)}%)`);
    console.log(`  Missing File Data: ${assetStats.missingFile}`);

    console.log('\n  By Content Type:');
    Object.entries(assetStats.byType)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([type, count]) => {
        console.log(`    ${type}: ${count} assets`);
      });

    console.log('\n  By File Extension:');
    Object.entries(assetStats.byExtension)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10) // トップ10のみ
      .forEach(([ext, count]) => {
        console.log(`    ${ext || 'no extension'}: ${count} files`);
      });
  }

  private async showSampleData(data: ContentfulExport): Promise<void> {
    // サンプルアセット
    const sampleAsset = data.assets.find(asset => asset.fields.title);
    if (sampleAsset) {
      console.log('\nSample Asset with Title:');
      console.log(`  ID: ${sampleAsset.sys.id}`);
      
      const locales = Object.keys(sampleAsset.fields.title || {});
      locales.forEach(locale => {
        if (sampleAsset.fields.title?.[locale]) {
          console.log(`  Title (${locale}): ${sampleAsset.fields.title[locale]}`);
        }
      });

      if (sampleAsset.fields.description) {
        const descLocales = Object.keys(sampleAsset.fields.description);
        descLocales.forEach(locale => {
          if (sampleAsset.fields.description?.[locale]) {
            console.log(`  Description (${locale}): ${sampleAsset.fields.description[locale].substring(0, 100)}...`);
          }
        });
      }

      const fileLocales = Object.keys(sampleAsset.fields.file || {});
      if (fileLocales.length > 0) {
        const fileData = sampleAsset.fields.file[fileLocales[0]];
        console.log(`  File: ${fileData.fileName} (${fileData.contentType})`);
        console.log(`  Size: ${this.formatFileSize(fileData.details.size)}`);
        if (fileData.details.image) {
          console.log(`  Dimensions: ${fileData.details.image.width}x${fileData.details.image.height}`);
        }
      }
    }

    // サンプルエントリ
    const sampleEntry = data.entries[0];
    if (sampleEntry) {
      console.log('\nSample Entry:');
      console.log(`  ID: ${sampleEntry.sys.id}`);
      console.log(`  Content Type: ${sampleEntry.sys.contentType.sys.id}`);
      console.log(`  Fields: ${Object.keys(sampleEntry.fields).join(', ')}`);
      
      // フィールドの値を表示（最初の3つのみ）
      const fieldEntries = Object.entries(sampleEntry.fields).slice(0, 3);
      fieldEntries.forEach(([fieldName, fieldValue]: [string, any]) => {
        if (typeof fieldValue === 'object' && fieldValue !== null) {
          const locales = Object.keys(fieldValue);
          if (locales.length > 0) {
            const value = fieldValue[locales[0]];
            if (typeof value === 'string') {
              console.log(`    ${fieldName}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
            } else if (value && typeof value === 'object' && value.sys) {
              console.log(`    ${fieldName}: [Link to ${value.sys.linkType}: ${value.sys.id}]`);
            } else {
              console.log(`    ${fieldName}: [${typeof value}]`);
            }
          }
        }
      });
    }
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // アセット情報を詳細に出力
  async analyzeAssetTitles(): Promise<void> {
    console.log('\n=== Asset Title Analysis ===\n');
    
    const data = await this.loadContentfulData();
    const assetsWithTitles = data.assets.filter(asset => asset.fields.title);
    
    console.log(`Assets with titles: ${assetsWithTitles.length}/${data.assets.length}`);
    
    // 言語別統計
    const localeStats: Record<string, number> = {};
    const titleLengthStats: number[] = [];
    
    assetsWithTitles.forEach(asset => {
      const titleLocales = Object.keys(asset.fields.title || {});
      titleLocales.forEach(locale => {
        localeStats[locale] = (localeStats[locale] || 0) + 1;
        const title = asset.fields.title[locale];
        if (title) {
          titleLengthStats.push(title.length);
        }
      });
    });
    
    console.log('\nTitles by Locale:');
    Object.entries(localeStats)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .forEach(([locale, count]) => {
        console.log(`  ${locale}: ${count} titles`);
      });
    
    if (titleLengthStats.length > 0) {
      const avgLength = titleLengthStats.reduce((a, b) => a + b, 0) / titleLengthStats.length;
      const maxLength = Math.max(...titleLengthStats);
      const minLength = Math.min(...titleLengthStats);
      
      console.log('\nTitle Length Statistics:');
      console.log(`  Average: ${avgLength.toFixed(1)} characters`);
      console.log(`  Min: ${minLength} characters`);
      console.log(`  Max: ${maxLength} characters`);
    }
    
    // サンプルタイトル表示
    console.log('\nSample Asset Titles:');
    assetsWithTitles.slice(0, 5).forEach((asset, index) => {
      console.log(`  ${index + 1}. ID: ${asset.sys.id}`);
      const titleLocales = Object.keys(asset.fields.title || {});
      titleLocales.forEach(locale => {
        const title = asset.fields.title?.[locale];
        if (title) {
          console.log(`     Title (${locale}): ${title}`);
        }
      });
      
      const fileLocales = Object.keys(asset.fields.file || {});
      if (fileLocales.length > 0) {
        const fileData = asset.fields.file[fileLocales[0]];
        console.log(`     File: ${fileData.fileName}`);
      }
    });
  }
}

// 実行
async function main() {
  try {
    const analyzer = new ContentfulExportAnalyzer();
    await analyzer.analyze();
    await analyzer.analyzeAssetTitles();
  } catch (error) {
    console.error('Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}