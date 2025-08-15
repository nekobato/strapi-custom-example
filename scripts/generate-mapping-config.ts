import fs from 'fs/promises';
import path from 'path';
import { ContentfulContentType } from './mapping-types';

/**
 * Contentful export データからマッピング設定用の情報を抽出し、
 * 設定しやすい形で出力するスクリプト
 */

interface ContentfulExport {
  contentTypes: ContentfulContentType[];
  entries: any[];
  assets: any[];
  locales: any[];
}

interface ContentTypeInfo {
  contentfulId: string;
  name: string;
  displayField: string;
  fields: {
    id: string;
    name: string;
    type: string;
    linkType?: string;
    required: boolean;
  }[];
}

class MappingConfigGenerator {
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

  /**
   * Content Type情報をJSON形式で出力
   */
  async generateContentTypeInfo(): Promise<void> {
    console.log('Loading Contentful data...');
    const data = await this.loadContentfulData();

    const contentTypeInfos: ContentTypeInfo[] = data.contentTypes.map(ct => ({
      contentfulId: ct.sys.id,
      name: ct.name,
      displayField: ct.displayField,
      fields: ct.fields.map(field => ({
        id: field.id,
        name: field.name,
        type: field.type,
        linkType: field.linkType,
        required: field.required || false
      }))
    }));

    // JSONファイルとして出力
    const outputPath = path.join(__dirname, 'contentful-content-types.json');
    await fs.writeFile(outputPath, JSON.stringify(contentTypeInfos, null, 2));

    console.log(`✅ Content type information saved: ${outputPath}`);
    console.log('');
    console.log('Content Types found:');
    
    contentTypeInfos.forEach(ct => {
      console.log(`\n📋 ${ct.name} (${ct.contentfulId})`);
      console.log(`   Display Field: ${ct.displayField}`);
      console.log(`   Fields (${ct.fields.length}):`);
      
      ct.fields.forEach(field => {
        const typeInfo = field.linkType ? `${field.type}(${field.linkType})` : field.type;
        const requiredFlag = field.required ? ' *' : '';
        console.log(`     - ${field.id}: ${field.name} [${typeInfo}]${requiredFlag}`);
      });
    });

    console.log('\n📝 Next steps:');
    console.log('1. Review the generated contentful-content-types.json');
    console.log('2. Copy mapping-skeleton.ts to content-mapping.ts');
    console.log('3. Update the CONTENT_TYPE_MAPPINGS with your actual Strapi IDs');
    console.log('4. Update field mappings as needed');
  }

  /**
   * マッピング設定のヘルプを表示
   */
  printMappingHelp(): void {
    console.log('\n=== Mapping Configuration Help ===\n');
    
    console.log('1. Content Type Mapping:');
    console.log('   - contentfulId: Contentful での Content Type ID');
    console.log('   - strapiId: Strapi での Content Type ID (通常 kebab-case)');
    console.log('   - displayName: 表示名');
    console.log('');
    
    console.log('2. Field Mapping Options:');
    console.log('   - contentfulField: Contentful でのフィールド ID');
    console.log('   - strapiField: Strapi でのフィールド ID');
    console.log('   - skipMigration: true にするとそのフィールドをスキップ');
    console.log('   - customTransform: 値を変換する関数');
    console.log('');
    
    console.log('3. Available Field Transformers:');
    console.log('   - FieldTransformers.toLowerCase');
    console.log('   - FieldTransformers.toUpperCase');
    console.log('   - FieldTransformers.booleanToStatus');
    console.log('   - FieldTransformers.dateToISO');
    console.log('   - FieldTransformers.arrayToString');
    console.log('   - FieldTransformers.richTextToHtml');
    console.log('');
    
    console.log('4. Custom Transform Function Example:');
    console.log('   customTransform: (value) => {');
    console.log('     if (typeof value === "string") {');
    console.log('       return value.trim().toLowerCase();');
    console.log('     }');
    console.log('     return value;');
    console.log('   }');
    console.log('');
    
    console.log('5. Field Type Mapping:');
    console.log('   Contentful → Strapi');
    console.log('   - Symbol → string');
    console.log('   - Text → text');
    console.log('   - RichText → richtext');
    console.log('   - Integer → integer');
    console.log('   - Number → decimal');
    console.log('   - Date → datetime');
    console.log('   - Boolean → boolean');
    console.log('   - Link(Asset) → media');
    console.log('   - Link(Entry) → relation');
    console.log('   - Object/Array → json');
  }
}

// 実行
async function main() {
  try {
    const generator = new MappingConfigGenerator();
    await generator.generateContentTypeInfo();
    generator.printMappingHelp();
  } catch (error) {
    console.error('Config generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}