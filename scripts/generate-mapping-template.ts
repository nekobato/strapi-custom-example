import fs from 'fs/promises';
import path from 'path';

/**
 * Contentful export から Content Type マッピングのテンプレートを生成
 */

interface ContentfulExport {
  contentTypes: any[];
  entries: any[];
  assets: any[];
  locales: any[];
}

class MappingTemplateGenerator {
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

  async generateTemplate(): Promise<void> {
    console.log('Loading Contentful data...');
    const data = await this.loadContentfulData();

    console.log('Generating mapping template...');
    
    let template = `/**
 * Contentful から Strapi への Content Type とフィールド名のマッピング設定
 * 
 * 自動生成されたテンプレートです。必要に応じて編集してください。
 */

export interface ContentTypeMapping {
  contentfulId: string;
  strapiId: string;
  displayName: string;
  fieldMappings: FieldMapping[];
}

export interface FieldMapping {
  contentfulField: string;
  strapiField: string;
  fieldType?: string;
  skipMigration?: boolean;
  customTransform?: (value: any) => any;
}

/**
 * Content Type のマッピング設定
 */
export const CONTENT_TYPE_MAPPINGS: ContentTypeMapping[] = [
`;

    // 各Content Typeのマッピングテンプレートを生成
    for (const contentType of data.contentTypes) {
      const strapiId = this.toKebabCase(contentType.sys.id);
      
      template += `  // ${contentType.name}
  {
    contentfulId: '${contentType.sys.id}',
    strapiId: '${strapiId}', // TODO: Strapiでの正しいIDに変更してください
    displayName: '${contentType.name}',
    fieldMappings: [
`;

      // フィールドマッピングのテンプレート
      for (const field of contentType.fields) {
        const strapiFieldName = this.toCamelCase(field.id);
        const fieldTypeComment = field.linkType ? ` // ${field.type}(${field.linkType})` : ` // ${field.type}`;
        
        template += `      { contentfulField: '${field.id}', strapiField: '${strapiFieldName}' },${fieldTypeComment}
`;
      }

      template += `    ]
  },

`;
    }

    template += `];

// 以下は自動生成されたヘルパー関数です（編集不要）
export function getContentTypeMapping(contentfulId: string): ContentTypeMapping | null {
  return CONTENT_TYPE_MAPPINGS.find(mapping => mapping.contentfulId === contentfulId) || null;
}

export function getStrapiContentTypeId(contentfulId: string): string {
  const mapping = getContentTypeMapping(contentfulId);
  return mapping ? mapping.strapiId : contentfulId;
}

export function getFieldMapping(contentfulId: string, contentfulField: string): FieldMapping | null {
  const mapping = getContentTypeMapping(contentfulId);
  if (!mapping) return null;
  
  return mapping.fieldMappings.find(field => field.contentfulField === contentfulField) || null;
}

export function getStrapiFieldName(contentfulId: string, contentfulField: string): string {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  return fieldMapping ? fieldMapping.strapiField : contentfulField;
}

export function shouldMigrateField(contentfulId: string, contentfulField: string): boolean {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  return fieldMapping ? !fieldMapping.skipMigration : true;
}

export function applyFieldTransform(contentfulId: string, contentfulField: string, value: any): any {
  const fieldMapping = getFieldMapping(contentfulId, contentfulField);
  if (fieldMapping && fieldMapping.customTransform) {
    return fieldMapping.customTransform(value);
  }
  return value;
}

export function validateMappings(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const strapiIds = new Set<string>();
  
  for (const mapping of CONTENT_TYPE_MAPPINGS) {
    if (strapiIds.has(mapping.strapiId)) {
      errors.push(\`Duplicate Strapi ID: \${mapping.strapiId}\`);
    }
    strapiIds.add(mapping.strapiId);
    
    if (!mapping.contentfulId || !mapping.strapiId) {
      errors.push(\`Missing required fields in mapping: \${JSON.stringify(mapping)}\`);
    }
    
    const strapiFields = new Set<string>();
    for (const fieldMapping of mapping.fieldMappings) {
      if (!fieldMapping.contentfulField || !fieldMapping.strapiField) {
        errors.push(\`Missing field names in mapping for \${mapping.contentfulId}\`);
      }
      
      if (strapiFields.has(fieldMapping.strapiField)) {
        errors.push(\`Duplicate Strapi field: \${fieldMapping.strapiField} in \${mapping.contentfulId}\`);
      }
      strapiFields.add(fieldMapping.strapiField);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function printMappings(): void {
  console.log('\\n=== Content Type Mappings ===\\n');
  
  if (CONTENT_TYPE_MAPPINGS.length === 0) {
    console.log('No mappings configured. Please add mappings to content-mapping.ts');
    return;
  }
  
  for (const mapping of CONTENT_TYPE_MAPPINGS) {
    console.log(\`\${mapping.contentfulId} → \${mapping.strapiId} (\${mapping.displayName})\`);
    console.log('  Field Mappings:');
    
    if (mapping.fieldMappings.length === 0) {
      console.log('    No field mappings configured');
    } else {
      for (const field of mapping.fieldMappings) {
        const skipText = field.skipMigration ? ' [SKIP]' : '';
        const transformText = field.customTransform ? ' [TRANSFORM]' : '';
        console.log(\`    \${field.contentfulField} → \${field.strapiField}\${skipText}\${transformText}\`);
      }
    }
    console.log('');
  }
  
  const validation = validateMappings();
  if (!validation.valid) {
    console.log('⚠️  Mapping Validation Errors:');
    validation.errors.forEach(error => console.log(\`  - \${error}\`));
  } else {
    console.log('✅ All mappings are valid');
  }
}

export function findUnmappedContentTypes(contentTypes: any[]): string[] {
  const mappedTypes = new Set(CONTENT_TYPE_MAPPINGS.map(m => m.contentfulId));
  return contentTypes
    .map(ct => ct.sys.id)
    .filter(id => !mappedTypes.has(id));
}
`;

    // ファイルに保存
    const outputPath = path.join(__dirname, 'content-mapping-template.ts');
    await fs.writeFile(outputPath, template);

    console.log(`✅ Template generated: ${outputPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the generated template');
    console.log('2. Update strapiId values to match your Strapi naming convention');
    console.log('3. Update field mappings as needed');
    console.log('4. Replace content-mapping.ts with the template (after backup)');
    console.log('');
    
    // 統計情報
    console.log('Template Statistics:');
    console.log(`  Content Types: ${data.contentTypes.length}`);
    console.log(`  Total Fields: ${data.contentTypes.reduce((acc, ct) => acc + ct.fields.length, 0)}`);
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }
}

// 実行
async function main() {
  try {
    const generator = new MappingTemplateGenerator();
    await generator.generateTemplate();
  } catch (error) {
    console.error('Template generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}