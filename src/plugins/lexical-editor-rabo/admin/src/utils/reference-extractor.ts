/**
 * Lexical エディタの状態から参照情報を抽出するユーティリティ
 */

import { SerializedLexicalNode } from 'lexical';

export interface MediaReference {
  documentId: string;
}

export interface EntryReference {
  documentId: string;
  contentType: string;
}

export interface ExtractedReferences {
  media: MediaReference[];
  entries: EntryReference[];
}

/**
 * Lexical エディタの状態から参照情報を抽出
 */
export function extractReferences(editorState: any): ExtractedReferences {
  const mediaRefs: MediaReference[] = [];
  const entryRefs: EntryReference[] = [];

  if (!editorState?.root?.children) {
    return { media: mediaRefs, entries: entryRefs };
  }

  function traverseNodes(nodes: SerializedLexicalNode[]) {
    if (!Array.isArray(nodes)) return;

    nodes.forEach((node) => {
      // StrapiImageNode の参照を抽出
      if (node.type === 'strapi-image' && (node as any).documentId) {
        const imageNode = node as any;
        const existingRef = mediaRefs.find(ref => ref.documentId === imageNode.documentId);
        if (!existingRef) {
          mediaRefs.push({ documentId: imageNode.documentId });
        }
      }
      
      // StrapiEntryNode の参照を抽出
      else if (node.type === 'strapi-entry' && (node as any).documentId) {
        const entryNode = node as any;
        const existingRef = entryRefs.find(
          ref => ref.documentId === entryNode.documentId && ref.contentType === entryNode.contentType
        );
        if (!existingRef) {
          entryRefs.push({
            documentId: entryNode.documentId,
            contentType: entryNode.contentType,
          });
        }
      }

      // 子ノードがある場合は再帰的に処理
      if ((node as any).children && Array.isArray((node as any).children)) {
        traverseNodes((node as any).children);
      }
    });
  }

  traverseNodes(editorState.root.children);

  return {
    media: mediaRefs,
    entries: entryRefs,
  };
}

/**
 * 参照情報をデバッグ用に文字列で出力
 */
export function debugReferences(references: ExtractedReferences): string {
  const { media, entries } = references;
  
  const parts: string[] = [];
  
  if (media.length > 0) {
    parts.push(`Media: ${media.map(ref => ref.documentId).join(', ')}`);
  }
  
  if (entries.length > 0) {
    parts.push(`Entries: ${entries.map(ref => `${ref.contentType}:${ref.documentId}`).join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'No references found';
}

/**
 * 参照情報が変更されたかどうかをチェック
 */
export function hasReferencesChanged(
  oldRefs: ExtractedReferences,
  newRefs: ExtractedReferences
): boolean {
  // メディア参照の比較
  if (oldRefs.media.length !== newRefs.media.length) return true;
  
  for (const newMediaRef of newRefs.media) {
    const exists = oldRefs.media.some(oldRef => oldRef.documentId === newMediaRef.documentId);
    if (!exists) return true;
  }
  
  // エントリ参照の比較
  if (oldRefs.entries.length !== newRefs.entries.length) return true;
  
  for (const newEntryRef of newRefs.entries) {
    const exists = oldRefs.entries.some(
      oldRef => oldRef.documentId === newEntryRef.documentId && 
                oldRef.contentType === newEntryRef.contentType
    );
    if (!exists) return true;
  }
  
  return false;
}