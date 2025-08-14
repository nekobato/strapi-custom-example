import type { Core } from '@strapi/strapi';

/**
 * Lexical JSON 内の参照を最新データで populate するユーティリティ
 */

export interface PopulateContext {
  strapi: Core.Strapi;
  populatedMedia?: any[];
  populatedEntries?: any[];
}

/**
 * エンティティの Lexical フィールドを populate
 */
export async function populateLexicalReferences(
  entity: any,
  lexicalFieldName: string = 'content',
  context: PopulateContext
): Promise<any> {
  const lexicalField = entity[lexicalFieldName];

  if (!lexicalField?.root?.children) {
    return entity;
  }

  try {
    // 再帰的にノードを走査し、参照を解決
    const populatedNodes = await populateNodes(lexicalField.root.children, context);

    return {
      ...entity,
      [lexicalFieldName]: {
        ...lexicalField,
        root: {
          ...lexicalField.root,
          children: populatedNodes,
        },
      },
    };
  } catch (error) {
    console.error('Error populating lexical references:', error);
    return entity; // エラー時は元のエンティティを返す
  }
}

/**
 * ノードの配列を populate
 */
async function populateNodes(nodes: any[], context: PopulateContext): Promise<any[]> {
  if (!Array.isArray(nodes)) return nodes;

  const populatedNodes: any[] = [];

  for (const node of nodes) {
    const populatedNode = await populateNode(node, context);
    populatedNodes.push(populatedNode);
  }

  return populatedNodes;
}

/**
 * 単一ノードを populate
 */
async function populateNode(node: any, context: PopulateContext): Promise<any> {
  if (!node || typeof node !== 'object') return node;

  let populatedNode = { ...node };

  // ノードタイプに応じて処理
  switch (node.type) {
    case 'strapi-image':
      populatedNode = await populateImageNode(node, context);
      break;
    case 'strapi-entry':
      populatedNode = await populateEntryNode(node, context);
      break;
    default:
      // 他のノードタイプはそのまま
      break;
  }

  // 子ノードがある場合は再帰的に処理
  if (populatedNode.children && Array.isArray(populatedNode.children)) {
    populatedNode.children = await populateNodes(populatedNode.children, context);
  }

  return populatedNode;
}

/**
 * StrapiImageNode を populate
 */
async function populateImageNode(node: any, context: PopulateContext): Promise<any> {
  if (!node.documentId || !context.populatedMedia) {
    return node;
  }

  // populate されたメディアから該当するものを検索
  const populatedMedia = context.populatedMedia.find(
    (media) => media.documentId === node.documentId
  );

  if (!populatedMedia) {
    console.warn(`Media with documentId ${node.documentId} not found in populated data`);
    return node;
  }

  // ノードの情報を最新データで更新
  return {
    ...node,
    src: populatedMedia.formats?.thumbnail?.url || populatedMedia.url || node.src,
    metadata: {
      ...(node.metadata || {}),
      url: populatedMedia.url,
      alternativeText: populatedMedia.alternativeText,
      caption: populatedMedia.caption,
      width: populatedMedia.width,
      height: populatedMedia.height,
      formats: populatedMedia.formats,
      mime: populatedMedia.mime,
      size: populatedMedia.size,
      updatedAt: populatedMedia.updatedAt,
    },
  };
}

/**
 * StrapiEntryNode を populate
 */
async function populateEntryNode(node: any, context: PopulateContext): Promise<any> {
  if (!node.documentId || !node.contentType || !context.populatedEntries) {
    return node;
  }

  // populate されたエントリから該当するものを検索
  const populatedEntry = context.populatedEntries.find(
    (entry) => entry.documentId === node.documentId
  );

  if (!populatedEntry) {
    console.warn(
      `Entry with documentId ${node.documentId} and contentType ${node.contentType} not found in populated data`
    );
    return node;
  }

  // タイトルフィールドを動的に検索
  const titleField = findTitleField(populatedEntry);
  const title = titleField ? populatedEntry[titleField] : node.title;

  // ノードの情報を最新データで更新
  return {
    ...node,
    title,
    metadata: {
      ...(node.metadata || {}),
      title,
      publishedAt: populatedEntry.publishedAt,
      updatedAt: populatedEntry.updatedAt,
      locale: populatedEntry.locale,
      status: populatedEntry.publishedAt ? 'published' : 'draft',
    },
    data: populatedEntry, // 完全なエントリデータも保存
  };
}

/**
 * エントリからタイトルフィールドを検索
 */
function findTitleField(entry: any): string | null {
  const titleCandidates = ['title', 'name', 'label', 'headline', 'subject'];
  
  for (const candidate of titleCandidates) {
    if (entry[candidate] && typeof entry[candidate] === 'string') {
      return candidate;
    }
  }
  
  return null;
}

/**
 * メディアの documentId 配列から populate クエリを実行
 */
export async function populateMediaReferences(
  documentIds: string[],
  strapi: Core.Strapi
): Promise<any[]> {
  if (documentIds.length === 0) return [];

  try {
    const mediaResults = await strapi.documents('plugin::upload.file').findMany({
      filters: {
        documentId: {
          $in: documentIds,
        },
      },
    });

    return mediaResults || [];
  } catch (error) {
    console.error('Error populating media references:', error);
    return [];
  }
}

/**
 * エントリの参照配列から populate クエリを実行
 */
export async function populateEntryReferences(
  entryRefs: Array<{ documentId: string; contentType: string }>,
  strapi: Core.Strapi
): Promise<any[]> {
  if (entryRefs.length === 0) return [];

  const results: any[] = [];

  // コンテンツタイプごとにグループ化
  const groupedRefs = entryRefs.reduce((acc, ref) => {
    if (!acc[ref.contentType]) {
      acc[ref.contentType] = [];
    }
    acc[ref.contentType].push(ref.documentId);
    return acc;
  }, {} as Record<string, string[]>);

  // コンテンツタイプごとに検索
  for (const [contentType, documentIds] of Object.entries(groupedRefs)) {
    try {
      const entries = await strapi.documents(contentType as any).findMany({
        filters: {
          documentId: {
            $in: documentIds,
          },
        },
      });

      if (entries) {
        results.push(...entries);
      }
    } catch (error) {
      console.error(`Error populating entries for content type ${contentType}:`, error);
    }
  }

  return results;
}