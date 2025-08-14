import type { Schema, Struct } from '@strapi/strapi';

export interface LinksLinks extends Struct.ComponentSchema {
  collectionName: 'components_links_links';
  info: {
    displayName: 'Links';
  };
  attributes: {
    categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::category.category'
    >;
    components_from_rich_texts: Schema.Attribute.Relation<
      'oneToMany',
      'api::components-from-rich-text.components-from-rich-text'
    >;
    docs: Schema.Attribute.Relation<'oneToMany', 'api::doc.doc'>;
    hr_media_categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::hr-media-category.hr-media-category'
    >;
    hr_medias: Schema.Attribute.Relation<'oneToMany', 'api::hr-media.hr-media'>;
    links: Schema.Attribute.Relation<'oneToMany', 'api::link.link'>;
    media_discussions: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-discussion.media-discussion'
    >;
    media_galleries: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-gallery.media-gallery'
    >;
    media_lists: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-list.media-list'
    >;
    media_notes: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-note.media-note'
    >;
    media_products_cta_sections: Schema.Attribute.Relation<
      'oneToMany',
      'api::media-products-cta-section.media-products-cta-section'
    >;
    news: Schema.Attribute.Relation<'oneToMany', 'api::new.new'>;
    news_en_uses: Schema.Attribute.Relation<
      'oneToMany',
      'api::news-en-us.news-en-us'
    >;
    owned_media_categories: Schema.Attribute.Relation<
      'oneToMany',
      'api::owned-media-category.owned-media-category'
    >;
    owned_media_profiles: Schema.Attribute.Relation<
      'oneToMany',
      'api::owned-media-profile.owned-media-profile'
    >;
    owned_media_related_links: Schema.Attribute.Relation<
      'oneToMany',
      'api::owned-media-related-link.owned-media-related-link'
    >;
    owned_medias: Schema.Attribute.Relation<
      'oneToMany',
      'api::owned-media.owned-media'
    >;
    related_links: Schema.Attribute.Relation<
      'oneToMany',
      'api::related-link.related-link'
    >;
    simple_image_link_on_rich_texts: Schema.Attribute.Relation<
      'oneToMany',
      'api::simple-image-link-on-rich-text.simple-image-link-on-rich-text'
    >;
    tags: Schema.Attribute.Relation<'oneToMany', 'api::tag.tag'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'links.links': LinksLinks;
    }
  }
}
