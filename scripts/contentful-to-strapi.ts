import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from 'dotenv';
import { 
  getStrapiContentTypeId, 
  getStrapiFieldName, 
  shouldMigrateField, 
  applyFieldTransform,
  printMappings,
  validateMappings,
  findUnmappedContentTypes
} from './content-mapping';

// 環境変数を読み込み
config({ path: '.env' });

interface ContentfulExport {
  contentTypes: ContentfulContentType[];
  entries: ContentfulEntry[];
  locales: ContentfulLocale[];
}

interface ContentfulContentType {
  sys: {
    id: string;
    type: string;
  };
  name: string;
  displayField: string;
  fields: ContentfulField[];
}

interface ContentfulField {
  id: string;
  name: string;
  type: string;
  linkType?: string;
  required?: boolean;
  localized?: boolean;
  validations?: any[];
}

interface ContentfulEntry {
  sys: {
    id: string;
    contentType: {
      sys: {
        id: string;
      };
    };
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    locale?: string;
  };
  fields: Record<string, any>;
}


interface ContentfulLocale {
  code: string;
  name: string;
  default?: boolean;
}

class ContentfulToStrapiMigrator {
  private strapiUrl: string;
  private strapiToken: string;
  private backupPath: string;
  private dryRun: boolean;
  private migrationLog: any[] = [];

  constructor() {
    this.strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337';
    this.strapiToken = process.env.STRAPI_TOKEN || '';
    this.backupPath = path.join(__dirname, '../backup');
    this.dryRun = process.env.DRY_RUN === 'true';

    if (!this.strapiToken && !this.dryRun) {
      throw new Error('STRAPI_TOKEN is required when not running in dry-run mode');
    }
  }

  private log(message: string, data?: any) {
    console.log(`[${new Date().toISOString()}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      message,
      data: data || null
    });
  }

  private async strapiRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, data?: any, isFormData = false) {
    if (this.dryRun) {
      this.log(`DRY RUN: Would ${method} ${this.strapiUrl}/api${endpoint}`, data);
      return { data: { data: { id: Math.random().toString() } } };
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.strapiToken}`,
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await axios({
        method,
        url: `${this.strapiUrl}/api${endpoint}`,
        data,
        headers,
      });
      return response;
    } catch (error: any) {
      this.log(`Error making request to ${endpoint}:`, error.response?.data || error.message);
      throw error;
    }
  }

  private async loadContentfulData(): Promise<ContentfulExport> {
    const exportFilePath = path.join(this.backupPath, 'contentful-export-kxe5qiticei6-master-2025-07-29T13-53-20.json');
    
    try {
      const content = await fs.readFile(exportFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.log('Error loading Contentful export file:', error);
      throw error;
    }
  }

  private async loadAssetMapping(): Promise<Map<string, string>> {
    const assetMapping = new Map<string, string>();
    
    try {
      // 最新のアセットマッピングファイルを探す
      const files = await fs.readdir(__dirname);
      const mappingFiles = files.filter(file => file.startsWith('asset-mapping-') && file.endsWith('.json'));
      
      if (mappingFiles.length === 0) {
        this.log('No asset mapping file found. Asset references will be skipped.');
        this.log('Run asset migration first: npm run migrate:assets');
        return assetMapping;
      }
      
      // 最新のファイルを選択（ファイル名のタイムスタンプでソート）
      mappingFiles.sort((a, b) => b.localeCompare(a));
      const latestMappingFile = mappingFiles[0];
      
      const mappingPath = path.join(__dirname, latestMappingFile);
      const content = await fs.readFile(mappingPath, 'utf-8');
      const mappingData = JSON.parse(content);
      
      Object.entries(mappingData).forEach(([contentfulId, strapiId]) => {
        assetMapping.set(contentfulId, strapiId as string);
      });
      
      this.log(`Loaded asset mapping from: ${latestMappingFile} (${assetMapping.size} assets)`);
      
    } catch (error) {
      this.log('Warning: Could not load asset mapping file:', error);
      this.log('Asset references will be skipped. Run asset migration first: npm run migrate:assets');
    }
    
    return assetMapping;
  }


  private mapContentfulFieldToStrapi(field: ContentfulField): any {
    const strapiField: any = {
      type: this.mapFieldType(field.type, field.linkType),
      required: field.required || false,
    };

    // バリデーションの設定
    if (field.validations) {
      for (const validation of field.validations) {
        if (validation.in) {
          strapiField.enum = validation.in;
        }
        if (validation.size) {
          strapiField.minLength = validation.size.min;
          strapiField.maxLength = validation.size.max;
        }
        if (validation.range) {
          strapiField.min = validation.range.min;
          strapiField.max = validation.range.max;
        }
      }
    }

    return strapiField;
  }

  private mapFieldType(contentfulType: string, linkType?: string): string {
    switch (contentfulType) {
      case 'Symbol':
        return 'string';
      case 'Text':
        return 'text';
      case 'RichText':
        return 'richtext';
      case 'Integer':
        return 'integer';
      case 'Number':
        return 'decimal';
      case 'Date':
        return 'datetime';
      case 'Boolean':
        return 'boolean';
      case 'Location':
        return 'json'; // Strapi doesn't have native location type
      case 'Object':
        return 'json';
      case 'Array':
        return 'json';
      case 'Link':
        if (linkType === 'Asset') {
          return 'media';
        } else if (linkType === 'Entry') {
          return 'relation';
        }
        return 'json';
      default:
        return 'json';
    }
  }

  private async createStrapiContentType(contentType: ContentfulContentType): Promise<void> {
    const strapiContentTypeId = getStrapiContentTypeId(contentType.sys.id);
    
    const strapiSchema = {
      displayName: contentType.name,
      singularName: strapiContentTypeId,
      pluralName: strapiContentTypeId + 's',
      description: `Migrated from Contentful: ${contentType.name}`,
      collectionName: strapiContentTypeId,
      attributes: {} as Record<string, any>,
    };

    // フィールドをマッピング
    for (const field of contentType.fields) {
      // マッピング設定でスキップ対象かチェック
      if (!shouldMigrateField(contentType.sys.id, field.id)) {
        this.log(`Skipping field ${field.id} for content type ${contentType.sys.id} (configured to skip)`);
        continue;
      }

      const strapiFieldName = getStrapiFieldName(contentType.sys.id, field.id);
      strapiSchema.attributes[strapiFieldName] = this.mapContentfulFieldToStrapi(field);
    }

    // Contentful IDの保存用フィールドを追加
    strapiSchema.attributes.contentfulId = {
      type: 'string',
      unique: true,
    };

    this.log(`Creating content type: ${contentType.name} (${contentType.sys.id} → ${strapiContentTypeId})`, strapiSchema);

    try {
      await this.strapiRequest('POST', '/content-type-builder/content-types', {
        contentType: strapiSchema,
      });
      
      this.log(`Created content type: ${contentType.name}`);
    } catch (error: any) {
      if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('already exists')) {
        this.log(`Content type ${contentType.name} already exists, skipping creation`);
      } else {
        throw error;
      }
    }
  }

  private async migrateEntry(entry: ContentfulEntry, assetMapping: Map<string, string>): Promise<void> {
    const contentfulContentTypeId = entry.sys.contentType.sys.id;
    const strapiContentTypeId = getStrapiContentTypeId(contentfulContentTypeId);
    
    // フィールドデータを変換
    const strapiData: Record<string, any> = {
      contentfulId: entry.sys.id,
    };

    for (const [contentfulFieldId, fieldValue] of Object.entries(entry.fields)) {
      if (!fieldValue) continue;

      // マッピング設定でスキップ対象かチェック
      if (!shouldMigrateField(contentfulContentTypeId, contentfulFieldId)) {
        this.log(`Skipping field ${contentfulFieldId} for entry ${entry.sys.id} (configured to skip)`);
        continue;
      }

      const strapiFieldId = getStrapiFieldName(contentfulContentTypeId, contentfulFieldId);

      // ロケール対応の値を取得
      let value = fieldValue;
      if (typeof fieldValue === 'object' && fieldValue['en-US']) {
        value = fieldValue['en-US'];
      }

      // カスタム変換を適用
      value = applyFieldTransform(contentfulContentTypeId, contentfulFieldId, value);

      // リンク（関連）フィールドの処理
      if (value && typeof value === 'object' && value.sys) {
        if (value.sys.linkType === 'Asset') {
          // アセット参照をStrapi IDに変換
          const strapiAssetId = assetMapping.get(value.sys.id);
          if (strapiAssetId) {
            strapiData[strapiFieldId] = strapiAssetId;
          }
        } else if (value.sys.linkType === 'Entry') {
          // エントリ参照は後で解決（まず contentfulId を保存）
          strapiData[strapiFieldId] = {
            contentfulId: value.sys.id,
            contentType: value.sys.linkType,
          };
        }
      } else if (Array.isArray(value)) {
        // 配列の場合の処理
        strapiData[strapiFieldId] = value.map(item => {
          if (item && typeof item === 'object' && item.sys) {
            if (item.sys.linkType === 'Asset') {
              return assetMapping.get(item.sys.id);
            } else if (item.sys.linkType === 'Entry') {
              return {
                contentfulId: item.sys.id,
                contentType: item.sys.linkType,
              };
            }
          }
          return item;
        });
      } else {
        strapiData[strapiFieldId] = value;
      }
    }

    this.log(`Migrating entry ${entry.sys.id} to content type ${contentfulContentTypeId} → ${strapiContentTypeId}`, strapiData);

    try {
      await this.strapiRequest('POST', `/${strapiContentTypeId}`, { data: strapiData });
      this.log(`Successfully migrated entry ${entry.sys.id}`);
    } catch (error) {
      this.log(`Error migrating entry ${entry.sys.id}:`, error);
    }
  }

  async migrate(): Promise<void> {
    try {
      this.log('Starting Contentful to Strapi migration...');
      
      // マッピング設定の検証と表示
      const validation = validateMappings();
      if (!validation.valid) {
        this.log('Mapping validation failed:', validation.errors);
        throw new Error('Invalid mapping configuration');
      }
      
      printMappings();
      
      // Contentfulデータを読み込み
      const contentfulData = await this.loadContentfulData();
      this.log(`Loaded Contentful data: ${contentfulData.contentTypes.length} content types, ${contentfulData.entries.length} entries`);

      // マッピングされていないContent Typeを検出
      const unmappedTypes = findUnmappedContentTypes(contentfulData.contentTypes);
      if (unmappedTypes.length > 0) {
        this.log(`Warning: Found unmapped content types: ${unmappedTypes.join(', ')}`);
        this.log('These will use default naming. Consider adding mappings to content-mapping.ts');
      }

      // アセットマッピングを読み込み（事前にアセット移行が完了している前提）
      const assetMapping = await this.loadAssetMapping();

      // コンテンツタイプを作成
      this.log('Starting content type migration...');
      for (const contentType of contentfulData.contentTypes) {
        try {
          await this.createStrapiContentType(contentType);
        } catch (error) {
          this.log(`Error creating content type ${contentType.name}:`, error);
        }
      }

      // エントリを移行
      this.log('Starting entry migration...');
      for (const entry of contentfulData.entries) {
        try {
          await this.migrateEntry(entry, assetMapping);
        } catch (error) {
          this.log(`Error migrating entry ${entry.sys.id}:`, error);
        }
      }

      // 移行ログを保存
      const logPath = path.join(__dirname, `migration-log-${Date.now()}.json`);
      await fs.writeFile(logPath, JSON.stringify(this.migrationLog, null, 2));
      this.log(`Migration completed. Log saved to: ${logPath}`);

    } catch (error) {
      this.log('Migration failed:', error);
      throw error;
    }
  }
}

// 実行
async function main() {
  try {
    const migrator = new ContentfulToStrapiMigrator();
    await migrator.migrate();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}