import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from 'dotenv';
import { findAssetFile, formatFileSize, getMimeTypeFromExtension } from './file-utils';

// 環境変数を読み込み
config({ path: '.env' });

interface ContentfulExport {
  contentTypes: ContentfulContentType[];
  entries: ContentfulEntry[];
  assets: ContentfulAsset[];
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

  private async uploadAsset(asset: ContentfulAsset): Promise<string | null> {
    const locale = Object.keys(asset.fields.file)[0] || 'en-US';
    const fileData = asset.fields.file[locale];
    
    if (!fileData) {
      this.log(`No file data found for asset ${asset.sys.id}`);
      return null;
    }

    // ファイルパスを決定（新しいユーティリティ関数を使用）
    const searchDirs = [
      path.join(this.backupPath, 'images.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'videos.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'downloads.ctfassets.net/kxe5qiticei6'),
      path.join(this.backupPath, 'assets.ctfassets.net/kxe5qiticei6')
    ];

    const fileSearchResult = await findAssetFile(asset.sys.id, fileData.fileName, searchDirs);
    
    if (!fileSearchResult.found || !fileSearchResult.filePath) {
      this.log(`File not found for asset ${asset.sys.id} (${fileData.fileName})`);
      return null;
    }

    try {
      if (this.dryRun) {
        this.log(`DRY RUN: Would upload asset ${asset.sys.id} from ${fileSearchResult.filePath}`);
        this.log(`  Original filename: ${fileData.fileName}`);
        this.log(`  Found filename: ${fileSearchResult.actualFileName}`);
        this.log(`  Size: ${formatFileSize(fileData.details.size)}`);
        
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
      
      // MIMEタイプを推定（Contentfulのデータまたはファイル拡張子から）
      const contentType = fileData.contentType || getMimeTypeFromExtension(fileData.fileName);
      
      form.append('files', fileStream, {
        filename: fileData.fileName,
        contentType: contentType,
      });

      // タイトルと代替テキストの情報を追加
      const fileInfo: any = {};
      
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

      // Contentful IDも保存
      fileInfo.contentfulId = asset.sys.id;

      // ファイル情報をフォームデータに追加
      if (Object.keys(fileInfo).length > 0) {
        form.append('fileInfo', JSON.stringify(fileInfo));
      }

      const uploadResponse = await axios.post(`${this.strapiUrl}/api/upload`, form, {
        headers: {
          'Authorization': `Bearer ${this.strapiToken}`,
          ...form.getHeaders(),
        },
      });

      const uploadedFile = uploadResponse.data[0];
      this.log(`Uploaded asset ${asset.sys.id} -> Strapi ID: ${uploadedFile.id}`);
      
      // タイトルがある場合は追加でログ出力
      if (asset.fields.title) {
        const titleLocale = Object.keys(asset.fields.title)[0];
        if (asset.fields.title[titleLocale]) {
          this.log(`  Title: ${asset.fields.title[titleLocale]}`);
        }
      }
      
      // アップロード後にメタデータを更新
      if (Object.keys(fileInfo).length > 0) {
        try {
          await this.strapiRequest('PUT', `/upload/files/${uploadedFile.id}`, fileInfo);
          this.log(`Updated metadata for asset ${asset.sys.id}`);
        } catch (error) {
          this.log(`Warning: Could not update metadata for asset ${asset.sys.id}:`, error);
        }
      }
      
      return uploadedFile.id;
    } catch (error) {
      this.log(`Error uploading asset ${asset.sys.id}:`, error);
      return null;
    }
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
    const strapiSchema = {
      displayName: contentType.name,
      singularName: contentType.sys.id.toLowerCase(),
      pluralName: contentType.sys.id.toLowerCase() + 's',
      description: `Migrated from Contentful: ${contentType.name}`,
      collectionName: contentType.sys.id.toLowerCase(),
      attributes: {} as Record<string, any>,
    };

    // フィールドをマッピング
    for (const field of contentType.fields) {
      strapiSchema.attributes[field.id] = this.mapContentfulFieldToStrapi(field);
    }

    // Contentful IDの保存用フィールドを追加
    strapiSchema.attributes.contentfulId = {
      type: 'string',
      unique: true,
    };

    this.log(`Creating content type: ${contentType.name}`, strapiSchema);

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
    const contentTypeId = entry.sys.contentType.sys.id;
    
    // フィールドデータを変換
    const strapiData: Record<string, any> = {
      contentfulId: entry.sys.id,
    };

    for (const [fieldId, fieldValue] of Object.entries(entry.fields)) {
      if (!fieldValue) continue;

      // ロケール対応の値を取得
      let value = fieldValue;
      if (typeof fieldValue === 'object' && fieldValue['en-US']) {
        value = fieldValue['en-US'];
      }

      // リンク（関連）フィールドの処理
      if (value && typeof value === 'object' && value.sys) {
        if (value.sys.linkType === 'Asset') {
          // アセット参照をStrapi IDに変換
          const strapiAssetId = assetMapping.get(value.sys.id);
          if (strapiAssetId) {
            strapiData[fieldId] = strapiAssetId;
          }
        } else if (value.sys.linkType === 'Entry') {
          // エントリ参照は後で解決（まず contentfulId を保存）
          strapiData[fieldId] = {
            contentfulId: value.sys.id,
            contentType: value.sys.linkType,
          };
        }
      } else if (Array.isArray(value)) {
        // 配列の場合の処理
        strapiData[fieldId] = value.map(item => {
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
        strapiData[fieldId] = value;
      }
    }

    this.log(`Migrating entry ${entry.sys.id} to content type ${contentTypeId}`, strapiData);

    try {
      await this.strapiRequest('POST', `/${contentTypeId}`, { data: strapiData });
      this.log(`Successfully migrated entry ${entry.sys.id}`);
    } catch (error) {
      this.log(`Error migrating entry ${entry.sys.id}:`, error);
    }
  }

  async migrate(): Promise<void> {
    try {
      this.log('Starting Contentful to Strapi migration...');
      
      // Contentfulデータを読み込み
      const contentfulData = await this.loadContentfulData();
      this.log(`Loaded Contentful data: ${contentfulData.contentTypes.length} content types, ${contentfulData.entries.length} entries, ${contentfulData.assets.length} assets`);

      // アセットをアップロード
      this.log('Starting asset migration...');
      const assetMapping = new Map<string, string>();
      
      for (const asset of contentfulData.assets) {
        try {
          const strapiAssetId = await this.uploadAsset(asset);
          if (strapiAssetId) {
            assetMapping.set(asset.sys.id, strapiAssetId);
          }
        } catch (error) {
          this.log(`Error uploading asset ${asset.sys.id}:`, error);
        }
      }

      this.log(`Asset migration completed. ${assetMapping.size}/${contentfulData.assets.length} assets uploaded successfully.`);

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