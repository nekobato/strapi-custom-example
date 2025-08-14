import type { Core } from '@strapi/strapi';
import { 
  populateLexicalReferences,
  populateMediaReferences,
  populateEntryReferences,
  PopulateContext
} from '../utils/lexical-populate';
import { extractReferences } from '../../../admin/src/utils/reference-extractor';

/**
 * Lexical Populate Controller
 * Lexical フィールドの参照を populate する API エンドポイント
 */

export default ({ strapi }: { strapi: Core.Strapi }) => ({
  /**
   * 指定されたエンティティの Lexical フィールドを populate
   * GET /api/lexical/populate/:contentType/:documentId
   */
  async populateEntity(ctx: any) {
    const { contentType, documentId } = ctx.params;
    const { lexicalField = 'content', populate = true } = ctx.query;

    try {
      // エンティティを取得
      const entity = await strapi.documents(contentType as any).findOne({
        documentId,
        populate: {
          [lexicalField]: true,
        },
      });

      if (!entity) {
        return ctx.notFound('Entity not found');
      }

      // populate が無効な場合は、そのまま返す
      if (!populate || populate === 'false') {
        return ctx.send({ data: entity });
      }

      // Lexical フィールドから参照を抽出
      const lexicalFieldData = entity[lexicalField];
      if (!lexicalFieldData?.root?.children) {
        return ctx.send({ data: entity });
      }

      const references = extractReferences(lexicalFieldData);

      // 参照データを取得
      const populatedMedia = await populateMediaReferences(
        references.media.map(ref => ref.documentId),
        strapi
      );

      const populatedEntries = await populateEntryReferences(
        references.entries,
        strapi
      );

      // Lexical フィールドを populate
      const context: PopulateContext = {
        strapi,
        populatedMedia,
        populatedEntries,
      };

      const populatedEntity = await populateLexicalReferences(
        entity,
        lexicalField,
        context
      );

      ctx.send({
        data: populatedEntity,
        meta: {
          references: {
            media: references.media.length,
            entries: references.entries.length,
          },
        },
      });
    } catch (error) {
      console.error('Error in populateEntity:', error);
      ctx.internalServerError('Failed to populate entity');
    }
  },

  /**
   * 複数のエンティティの Lexical フィールドを populate
   * POST /api/lexical/populate-bulk/:contentType
   * Body: { documentIds: string[], lexicalField?: string }
   */
  async populateBulk(ctx: any) {
    const { contentType } = ctx.params;
    const { documentIds, lexicalField = 'content', populate = true } = ctx.request.body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return ctx.badRequest('documentIds array is required');
    }

    try {
      // エンティティを一括取得
      const entities = await strapi.documents(contentType as any).findMany({
        filters: {
          documentId: {
            $in: documentIds,
          },
        },
        populate: {
          [lexicalField]: true,
        },
      });

      if (!entities || entities.length === 0) {
        return ctx.send({ data: [] });
      }

      // populate が無効な場合は、そのまま返す
      if (!populate || populate === 'false') {
        return ctx.send({ data: entities });
      }

      // 全エンティティから参照を抽出
      const allMediaRefs = new Set<string>();
      const allEntryRefs: Array<{ documentId: string; contentType: string }> = [];

      entities.forEach(entity => {
        const lexicalFieldData = entity[lexicalField];
        if (lexicalFieldData?.root?.children) {
          const references = extractReferences(lexicalFieldData);
          references.media.forEach(ref => allMediaRefs.add(ref.documentId));
          allEntryRefs.push(...references.entries);
        }
      });

      // 参照データを一括取得
      const populatedMedia = await populateMediaReferences(
        Array.from(allMediaRefs),
        strapi
      );

      const populatedEntries = await populateEntryReferences(
        allEntryRefs,
        strapi
      );

      // 各エンティティの Lexical フィールドを populate
      const context: PopulateContext = {
        strapi,
        populatedMedia,
        populatedEntries,
      };

      const populatedEntities = await Promise.all(
        entities.map(entity =>
          populateLexicalReferences(entity, lexicalField, context)
        )
      );

      ctx.send({
        data: populatedEntities,
        meta: {
          total: populatedEntities.length,
          references: {
            media: allMediaRefs.size,
            entries: allEntryRefs.length,
          },
        },
      });
    } catch (error) {
      console.error('Error in populateBulk:', error);
      ctx.internalServerError('Failed to populate entities');
    }
  },

  /**
   * Lexical フィールドから参照情報のみを抽出
   * GET /api/lexical/references/:contentType/:documentId
   */
  async getReferences(ctx: any) {
    const { contentType, documentId } = ctx.params;
    const { lexicalField = 'content' } = ctx.query;

    try {
      // エンティティを取得
      const entity = await strapi.documents(contentType as any).findOne({
        documentId,
        populate: {
          [lexicalField]: true,
        },
      });

      if (!entity) {
        return ctx.notFound('Entity not found');
      }

      // Lexical フィールドから参照を抽出
      const lexicalFieldData = entity[lexicalField];
      if (!lexicalFieldData?.root?.children) {
        return ctx.send({
          data: {
            media: [],
            entries: [],
          },
        });
      }

      const references = extractReferences(lexicalFieldData);

      ctx.send({
        data: references,
        meta: {
          total: references.media.length + references.entries.length,
        },
      });
    } catch (error) {
      console.error('Error in getReferences:', error);
      ctx.internalServerError('Failed to extract references');
    }
  },

  /**
   * 参照の妥当性チェック
   * POST /api/lexical/validate-references
   * Body: { media: string[], entries: { documentId: string, contentType: string }[] }
   */
  async validateReferences(ctx: any) {
    const { media = [], entries = [] } = ctx.request.body;

    try {
      const results = {
        media: {
          valid: [] as string[],
          invalid: [] as string[],
        },
        entries: {
          valid: [] as Array<{ documentId: string; contentType: string }>,
          invalid: [] as Array<{ documentId: string; contentType: string }>,
        },
      };

      // メディア参照の妥当性チェック
      if (Array.isArray(media) && media.length > 0) {
        const foundMedia = await populateMediaReferences(media, strapi);
        const foundDocumentIds = new Set(foundMedia.map(m => m.documentId));

        media.forEach(documentId => {
          if (foundDocumentIds.has(documentId)) {
            results.media.valid.push(documentId);
          } else {
            results.media.invalid.push(documentId);
          }
        });
      }

      // エントリ参照の妥当性チェック
      if (Array.isArray(entries) && entries.length > 0) {
        const foundEntries = await populateEntryReferences(entries, strapi);
        const foundEntryKeys = new Set(
          foundEntries.map(e => `${e.documentId}:${e.contentType || 'unknown'}`)
        );

        entries.forEach((entry: { documentId: string; contentType: string }) => {
          const key = `${entry.documentId}:${entry.contentType}`;
          if (foundEntryKeys.has(key)) {
            results.entries.valid.push(entry);
          } else {
            results.entries.invalid.push(entry);
          }
        });
      }

      ctx.send({
        data: results,
        meta: {
          totalValid: results.media.valid.length + results.entries.valid.length,
          totalInvalid: results.media.invalid.length + results.entries.invalid.length,
        },
      });
    } catch (error) {
      console.error('Error in validateReferences:', error);
      ctx.internalServerError('Failed to validate references');
    }
  },
});