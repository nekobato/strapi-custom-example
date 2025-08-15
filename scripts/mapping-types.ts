/**
 * マッピング設定のための型定義
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

export interface ContentfulField {
  id: string;
  name: string;
  type: string;
  linkType?: string;
  required?: boolean;
  localized?: boolean;
}

export interface ContentfulContentType {
  sys: { id: string };
  name: string;
  displayField: string;
  fields: ContentfulField[];
}

/**
 * カスタム変換関数のヘルパー
 */
export class FieldTransformers {
  /**
   * 文字列を小文字に変換
   */
  static toLowerCase(value: any): string {
    return typeof value === 'string' ? value.toLowerCase() : value;
  }

  /**
   * 文字列を大文字に変換
   */
  static toUpperCase(value: any): string {
    return typeof value === 'string' ? value.toUpperCase() : value;
  }

  /**
   * ブール値を文字列に変換
   */
  static booleanToStatus(value: any): string {
    return value ? 'published' : 'draft';
  }

  /**
   * Date文字列をISO形式に変換
   */
  static dateToISO(value: any): string {
    if (!value) return value;
    return new Date(value).toISOString();
  }

  /**
   * 配列を文字列（カンマ区切り）に変換
   */
  static arrayToString(value: any): string {
    return Array.isArray(value) ? value.join(',') : value;
  }

  /**
   * Rich Textの簡単なHTML変換
   */
  static richTextToHtml(value: any): string {
    // 簡単な例 - 実際のRich Text構造に応じて調整が必要
    if (typeof value === 'object' && value.content) {
      return value.content.map((node: any) => {
        if (node.nodeType === 'paragraph') {
          return `<p>${node.content.map((c: any) => c.value).join('')}</p>`;
        }
        return '';
      }).join('');
    }
    return value;
  }

  /**
   * カスタム変換関数の例
   */
  static customExample(value: any): any {
    // ここにカスタムロジックを実装
    return value;
  }
}