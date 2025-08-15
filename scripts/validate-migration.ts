import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from 'dotenv';
import { getStrapiContentTypeId, printMappings } from './content-mapping';

// 環境変数を読み込み
config({ path: '.env' });

interface ValidationResult {
  contentTypes: {
    total: number;
    migrated: number;
    missing: string[];
  };
  entries: {
    total: number;
    migrated: number;
    missing: string[];
  };
  assets: {
    total: number;
    migrated: number;
    missing: string[];
  };
  errors: string[];
}

class MigrationValidator {
  private strapiUrl: string;
  private strapiToken: string;
  private backupPath: string;

  constructor() {
    this.strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    this.strapiToken = process.env.STRAPI_TOKEN || '';
    this.backupPath = path.join(__dirname, '../backup');

    if (!this.strapiToken) {
      throw new Error('STRAPI_TOKEN is required for validation');
    }
  }

  private async strapiRequest(endpoint: string): Promise<any> {
    try {
      const response = await axios.get(`${this.strapiUrl}/api${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${this.strapiToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error making request to ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  private async loadContentfulData(): Promise<any> {
    const exportFilePath = path.join(this.backupPath, 'contentful-export-kxe5qiticei6-master-2025-07-29T13-53-20.json');
    
    try {
      const content = await fs.readFile(exportFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading Contentful export file:', error);
      throw error;
    }
  }

  async validate(): Promise<ValidationResult> {
    const result: ValidationResult = {
      contentTypes: { total: 0, migrated: 0, missing: [] },
      entries: { total: 0, migrated: 0, missing: [] },
      assets: { total: 0, migrated: 0, missing: [] },
      errors: [],
    };

    try {
      console.log('Checking content type mappings...');
      printMappings();
      
      console.log('Loading Contentful data...');
      const contentfulData = await this.loadContentfulData();

      console.log('Validating content types...');
      await this.validateContentTypes(contentfulData.contentTypes, result);

      console.log('Validating entries...');
      await this.validateEntries(contentfulData.entries, result);

      console.log('Validating assets...');
      await this.validateAssets(contentfulData.assets, result);

      console.log('Validation completed!');
      this.printValidationReport(result);

      return result;
    } catch (error: any) {
      result.errors.push(`Validation failed: ${error.message}`);
      throw error;
    }
  }

  private async validateContentTypes(contentTypes: any[], result: ValidationResult): Promise<void> {
    result.contentTypes.total = contentTypes.length;

    for (const contentType of contentTypes) {
      try {
        // マッピングを考慮したStrapi Content Type IDを取得
        const strapiContentTypeId = getStrapiContentTypeId(contentType.sys.id);
        
        // Strapiでコンテンツタイプの存在確認
        await this.strapiRequest(`/content-type-builder/content-types/${strapiContentTypeId}`);
        result.contentTypes.migrated++;
      } catch (error: any) {
        if (error.response?.status === 404) {
          result.contentTypes.missing.push(`${contentType.sys.id} → ${getStrapiContentTypeId(contentType.sys.id)}`);
        } else {
          result.errors.push(`Error checking content type ${contentType.sys.id}: ${error.message}`);
        }
      }
    }
  }

  private async validateEntries(entries: any[], result: ValidationResult): Promise<void> {
    result.entries.total = entries.length;

    // コンテンツタイプ別にエントリをグループ化
    const entriesByType = entries.reduce((acc, entry) => {
      const contentfulContentType = entry.sys.contentType.sys.id;
      const strapiContentType = getStrapiContentTypeId(contentfulContentType);
      
      if (!acc[strapiContentType]) {
        acc[strapiContentType] = [];
      }
      acc[strapiContentType].push(entry);
      return acc;
    }, {});

    for (const [strapiContentType, typeEntries] of Object.entries(entriesByType)) {
      try {
        const strapiEntries = await this.strapiRequest(`/${strapiContentType}`);
        const strapiContentfulIds = new Set(
          strapiEntries.data?.map((entry: any) => entry.attributes.contentfulId) || []
        );

        for (const entry of typeEntries as any[]) {
          if (strapiContentfulIds.has(entry.sys.id)) {
            result.entries.migrated++;
          } else {
            const contentfulContentType = entry.sys.contentType.sys.id;
            result.entries.missing.push(`${contentfulContentType}→${strapiContentType}:${entry.sys.id}`);
          }
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          // コンテンツタイプが存在しない場合、そのエントリはすべて欠落扱い
          for (const entry of typeEntries as any[]) {
            const contentfulContentType = entry.sys.contentType.sys.id;
            result.entries.missing.push(`${contentfulContentType}→${strapiContentType}:${entry.sys.id}`);
          }
        } else {
          result.errors.push(`Error checking entries for ${strapiContentType}: ${error.message}`);
        }
      }
    }
  }

  private async validateAssets(assets: any[], result: ValidationResult): Promise<void> {
    result.assets.total = assets.length;

    try {
      const strapiAssets = await this.strapiRequest('/upload/files');
      const strapiAssetNames = new Set(
        strapiAssets.map((asset: any) => asset.name)
      );

      for (const asset of assets) {
        const locale = Object.keys(asset.fields.file)[0] || 'en-US';
        const fileData = asset.fields.file[locale];
        
        if (fileData && strapiAssetNames.has(fileData.fileName)) {
          result.assets.migrated++;
        } else {
          result.assets.missing.push(`${asset.sys.id}:${fileData?.fileName || 'unknown'}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Error checking assets: ${error.message}`);
    }
  }

  private printValidationReport(result: ValidationResult): void {
    console.log('\n=== Migration Validation Report ===');
    
    console.log('\nContent Types:');
    console.log(`  Total: ${result.contentTypes.total}`);
    console.log(`  Migrated: ${result.contentTypes.migrated}`);
    console.log(`  Missing: ${result.contentTypes.missing.length}`);
    if (result.contentTypes.missing.length > 0) {
      console.log(`    ${result.contentTypes.missing.join(', ')}`);
    }

    console.log('\nEntries:');
    console.log(`  Total: ${result.entries.total}`);
    console.log(`  Migrated: ${result.entries.migrated}`);
    console.log(`  Missing: ${result.entries.missing.length}`);
    if (result.entries.missing.length > 0 && result.entries.missing.length <= 10) {
      console.log(`    ${result.entries.missing.slice(0, 10).join(', ')}`);
      if (result.entries.missing.length > 10) {
        console.log(`    ... and ${result.entries.missing.length - 10} more`);
      }
    }

    console.log('\nAssets:');
    console.log(`  Total: ${result.assets.total}`);
    console.log(`  Migrated: ${result.assets.migrated}`);
    console.log(`  Missing: ${result.assets.missing.length}`);
    if (result.assets.missing.length > 0 && result.assets.missing.length <= 10) {
      console.log(`    ${result.assets.missing.slice(0, 10).join(', ')}`);
      if (result.assets.missing.length > 10) {
        console.log(`    ... and ${result.assets.missing.length - 10} more`);
      }
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    console.log('\n=== End Report ===\n');

    // 成功率を計算
    const contentTypeSuccess = (result.contentTypes.migrated / result.contentTypes.total) * 100;
    const entrySuccess = (result.entries.migrated / result.entries.total) * 100;
    const assetSuccess = (result.assets.migrated / result.assets.total) * 100;

    console.log('Migration Success Rates:');
    console.log(`  Content Types: ${contentTypeSuccess.toFixed(1)}%`);
    console.log(`  Entries: ${entrySuccess.toFixed(1)}%`);
    console.log(`  Assets: ${assetSuccess.toFixed(1)}%`);
  }
}

// 実行
async function main() {
  try {
    const validator = new MigrationValidator();
    await validator.validate();
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}