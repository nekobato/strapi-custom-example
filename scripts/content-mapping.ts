/**
 * Content Type マッピング設定のスケルトン
 * 
 * このファイルをコピーして content-mapping.ts として使用してください。
 * 各 Content Type に対応するマッピングを追加してください。
 */

import { ContentTypeMapping, FieldTransformers } from './mapping-types';

/**
 * Content Type のマッピング設定
 * 
 * 設定例:
 * - contentfulId: Contentful での Content Type ID
 * - strapiId: Strapi での Content Type ID (通常は kebab-case)
 * - displayName: 表示名
 * - fieldMappings: フィールドのマッピング配列
 */
export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
  // ===========================================
  // News Content Type の例
  // ===========================================
  {
    contentfulId: 'news',
    strapiId: 'news-article',        // Strapi での実際の ID に変更
    displayName: 'News Article',
    fieldMappings: [
      // 基本的なフィールドマッピング
      { 
        contentfulField: 'title', 
        strapiField: 'headline'       // Strapi での実際のフィールド名に変更
      },
      { 
        contentfulField: 'content', 
        strapiField: 'body' 
      },
      { 
        contentfulField: 'publishedAt', 
        strapiField: 'publishDate' 
      },
      { 
        contentfulField: 'slug', 
        strapiField: 'slug' 
      },
      
      // 関連フィールド（Asset参照）
      { 
        contentfulField: 'featuredImage', 
        strapiField: 'thumbnail' 
      },
      
      // 関連フィールド（Entry参照）
      { 
        contentfulField: 'category', 
        strapiField: 'category' 
      },
      
      // カスタム変換が必要なフィールド
      { 
        contentfulField: 'status', 
        strapiField: 'publicationStatus',
        customTransform: FieldTransformers.toLowerCase
      },
      
      // 移行をスキップするフィールド
      { 
        contentfulField: 'internalNotes', 
        strapiField: 'notes',
        skipMigration: true
      }
    ]
  },

  // ===========================================
  // Category Content Type の例
  // ===========================================
  {
    contentfulId: 'category',
    strapiId: 'category',
    displayName: 'Category',
    fieldMappings: [
      { contentfulField: 'name', strapiField: 'name' },
      { contentfulField: 'slug', strapiField: 'slug' },
      { 
        contentfulField: 'description', 
        strapiField: 'description',
        customTransform: (value) => {
          // Rich Text を Plain Text に変換する例
          if (typeof value === 'object' && value.content) {
            return value.content.map((node: any) => 
              node.content?.map((c: any) => c.value).join('') || ''
            ).join(' ');
          }
          return value;
        }
      }
    ]
  },

  // ===========================================
  // 追加する Content Type のテンプレート
  // ===========================================
  // {
  //   contentfulId: 'your-contentful-type-id',
  //   strapiId: 'your-strapi-type-id',
  //   displayName: 'Your Content Type Name',
  //   fieldMappings: [
  //     // 基本マッピング
  //     { contentfulField: 'contentful-field', strapiField: 'strapi-field' },
  //     
  //     // カスタム変換付き
  //     { 
  //       contentfulField: 'contentful-field', 
  //       strapiField: 'strapi-field',
  //       customTransform: FieldTransformers.toLowerCase  // または独自の関数
  //     },
  //     
  //     // スキップするフィールド
  //     { 
  //       contentfulField: 'contentful-field', 
  //       strapiField: 'strapi-field',
  //       skipMigration: true
  //     }
  //   ]
  // },
];

/**
 * Content Type のマッピングを取得
 */
export function getContentTypeMapping(contentfulId: string): ContentTypeMapping | null {
  return CONTENT_TYPE_MAPPINGS.find(mapping => mapping.contentfulId === contentfulId) || null;
}

/**
 * Strapi Content Type ID を取得
 */
export function getStrapiContentTypeId(contentfulId: string): string {
  const mapping = getContentTypeMapping(contentfulId);
  return mapping ? mapping.strapiId : contentfulId;
}

/**
 * フィールドマッピングを取得
 */
export function getFieldMapping(contentfulId: string, contentfulField: string) {
  const mapping = getContentTypeMapping(contentfulId);
  if (!mapping) return null;
  
  return mapping.fieldMappings.find(field => field.contentfulField === contentfulField) || null;
}

/**
 * Strapi フィールド名を取得
 */
export function getStrapiFieldName(contentfulId: string, contentfulField: string): string {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  return fieldMapping ? fieldMapping.strapiField : contentfulField;
}

/**
 * フィールドが migration 対象かチェック
 */
export function shouldMigrateField(contentfulId: string, contentfulField: string): boolean {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  return fieldMapping ? !fieldMapping.skipMigration : true;
}

/**
 * カスタム変換を適用
 */
export function applyFieldTransform(contentfulId: string, contentfulField: string, value: any): any {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  if (fieldMapping && fieldMapping.customTransform) {
    try {
      return fieldMapping.customTransform(value);
    } catch (error) {
      console.error(`Error applying transform for ${contentfulId}.${contentfulField}:`, error);
      return value;
    }
  }
  return value;
}

/**
 * マッピング設定の検証
 */
export function validateMappings(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const strapiIds = new Set<string>();
  
  for (const mapping of CONTENT_TYPE_MAPPINGS) {
    // 重複チェック
    if (strapiIds.has(mapping.strapiId)) {
      errors.push(`Duplicate Strapi ID: ${mapping.strapiId}`);
    }
    strapiIds.add(mapping.strapiId);
    
    // 必須フィールドチェック
    if (!mapping.contentfulId || !mapping.strapiId) {
      errors.push(`Missing required fields in mapping: ${JSON.stringify(mapping)}`);
    }
    
    // フィールドマッピングの検証
    const strapiFields = new Set<string>();
    for (const fieldMapping of mapping.fieldMappings) {
      if (!fieldMapping.contentfulField || !fieldMapping.strapiField) {
        errors.push(`Missing field names in mapping for ${mapping.contentfulId}`);
      }
      
      if (strapiFields.has(fieldMapping.strapiField)) {
        errors.push(`Duplicate Strapi field: ${fieldMapping.strapiField} in ${mapping.contentfulId}`);
      }
      strapiFields.add(fieldMapping.strapiField);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * マッピング設定を表示
 */
export function printMappings(): void {
  console.log('\n=== Content Type Mappings ===\n');
  
  if (CONTENT_TYPE_MAPPINGS.length === 0) {
    console.log('No mappings configured. Please add mappings to content-mapping.ts');
    return;
  }
  
  for (const mapping of CONTENT_TYPE_MAPPINGS) {
    console.log(`${mapping.contentfulId} → ${mapping.strapiId} (${mapping.displayName})`);
    console.log('  Field Mappings:');
    
    if (mapping.fieldMappings.length === 0) {
      console.log('    No field mappings configured');
    } else {
      for (const field of mapping.fieldMappings) {
        const skipText = field.skipMigration ? ' [SKIP]' : '';
        const transformText = field.customTransform ? ' [TRANSFORM]' : '';
        console.log(`    ${field.contentfulField} → ${field.strapiField}${skipText}${transformText}`);
      }
    }
    console.log('');
  }
  
  // 検証結果も表示
  const validation = validateMappings();
  if (!validation.valid) {
    console.log('⚠️  Mapping Validation Errors:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log('✅ All mappings are valid');
  }
}

/**
 * 設定されていないContent Typeを検出
 */
export function findUnmappedContentTypes(contentTypes: any[]): string[] {
  const mappedTypes = new Set(CONTENT_TYPE_MAPPINGS.map(m => m.contentfulId));
  return contentTypes
    .map(ct => ct.sys.id)
    .filter(id => !mappedTypes.has(id));
}