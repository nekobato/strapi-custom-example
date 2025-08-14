/**
 * Lexical Populate Client Utility
 * クライアント側で populate 機能を使用するためのユーティリティ
 */

import { useFetchClient } from '@strapi/strapi/admin';

export interface PopulateOptions {
  lexicalField?: string;
  populate?: boolean;
}

export interface PopulateBulkOptions extends PopulateOptions {
  documentIds: string[];
}

export interface PopulateResponse<T = any> {
  data: T;
  meta?: {
    references?: {
      media: number;
      entries: number;
    };
  };
}

export interface PopulateBulkResponse<T = any> {
  data: T[];
  meta?: {
    total: number;
    references?: {
      media: number;
      entries: number;
    };
  };
}

/**
 * Lexical フィールドの populate を行うカスタムフック
 */
export function useLexicalPopulate() {
  const { get, post } = useFetchClient();

  /**
   * 単一エンティティの Lexical フィールドを populate
   */
  const populateEntity = async <T = any>(
    contentType: string,
    documentId: string,
    options: PopulateOptions = {}
  ): Promise<PopulateResponse<T>> => {
    const { lexicalField = 'content', populate = true } = options;
    
    const response = await get(`/lexical/populate/${contentType}/${documentId}`, {
      params: {
        lexicalField,
        populate,
      },
    });

    return response.data;
  };

  /**
   * 複数エンティティの Lexical フィールドを一括 populate
   */
  const populateBulk = async <T = any>(
    contentType: string,
    options: PopulateBulkOptions
  ): Promise<PopulateBulkResponse<T>> => {
    const { documentIds, lexicalField = 'content', populate = true } = options;
    
    const response = await post(`/lexical/populate-bulk/${contentType}`, {
      documentIds,
      lexicalField,
      populate,
    });

    return response.data;
  };

  /**
   * エンティティの Lexical フィールドから参照情報を取得
   */
  const getReferences = async (
    contentType: string,
    documentId: string,
    lexicalField: string = 'content'
  ) => {
    const response = await get(`/lexical/references/${contentType}/${documentId}`, {
      params: {
        lexicalField,
      },
    });

    return response.data;
  };

  /**
   * 参照の妥当性をチェック
   */
  const validateReferences = async (references: {
    media?: string[];
    entries?: Array<{ documentId: string; contentType: string }>;
  }) => {
    const response = await post('/lexical/validate-references', references);
    return response.data;
  };

  return {
    populateEntity,
    populateBulk,
    getReferences,
    validateReferences,
  };
}

/**
 * Lexical エディタ内容から populate されたエンティティを取得する例
 */
export const useLexicalContentWithPopulate = () => {
  const { populateEntity } = useLexicalPopulate();

  /**
   * エンティティのコンテンツを populate 付きで取得
   */
  const getContentWithPopulate = async (
    contentType: string,
    documentId: string,
    lexicalField: string = 'content'
  ) => {
    try {
      const result = await populateEntity(contentType, documentId, {
        lexicalField,
        populate: true,
      });

      return {
        success: true,
        data: result.data,
        meta: result.meta,
      };
    } catch (error) {
      console.error('Failed to get content with populate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    getContentWithPopulate,
  };
};

/**
 * バッチでの populate 処理用ユーティリティ
 */
export const useBatchPopulate = () => {
  const { populateBulk } = useLexicalPopulate();

  /**
   * 複数のエンティティを効率的に populate
   */
  const batchPopulate = async (
    contentType: string,
    documentIds: string[],
    lexicalField: string = 'content'
  ) => {
    // バッチサイズを制限（API負荷軽減のため）
    const BATCH_SIZE = 20;
    const results = [];

    for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
      const batch = documentIds.slice(i, i + BATCH_SIZE);
      
      try {
        const result = await populateBulk(contentType, {
          documentIds: batch,
          lexicalField,
          populate: true,
        });
        
        results.push(...result.data);
      } catch (error) {
        console.error(`Failed to populate batch ${i / BATCH_SIZE + 1}:`, error);
        // 失敗したバッチは個別に処理するか、エラーを記録
      }
    }

    return results;
  };

  return {
    batchPopulate,
  };
};