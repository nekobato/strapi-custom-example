/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import type { JSX } from 'react';

import { $applyNodeReplacement, DecoratorNode } from 'lexical';
import * as React from 'react';
import { Suspense } from 'react';

const StrapiEntryComponent = React.lazy(() => import('./StrapiEntryComponent'));

export interface StrapiEntryPayload {
  documentId: string;
  contentType: string;
  title?: string;
  data?: any;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    locale?: string;
    [key: string]: any;
  };
}

export type SerializedStrapiEntryNode = Spread<
  {
    documentId: string;
    contentType: string;
    title?: string;
    data?: any;
    metadata?: {
      createdAt?: string;
      updatedAt?: string;
      publishedAt?: string;
      locale?: string;
      [key: string]: any;
    };
  },
  SerializedLexicalNode
>;

export class StrapiEntryNode extends DecoratorNode<JSX.Element> {
  __documentId: string;
  __contentType: string;
  __title?: string;
  __data?: any;
  __metadata?: {
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;
    locale?: string;
    [key: string]: any;
  };

  static getType(): string {
    return 'strapi-entry';
  }

  static clone(node: StrapiEntryNode): StrapiEntryNode {
    return new StrapiEntryNode(
      node.__documentId,
      node.__contentType,
      node.__title,
      node.__data,
      node.__metadata,
      node.__key
    );
  }

  static importJSON(serializedNode: SerializedStrapiEntryNode): StrapiEntryNode {
    const { documentId, contentType, title, data, metadata } = serializedNode;
    return $createStrapiEntryNode({
      documentId,
      contentType,
      title,
      data,
      metadata,
    }).updateFromJSON(serializedNode);
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedStrapiEntryNode>): this {
    const node = super.updateFromJSON(serializedNode);
    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('div');
    element.setAttribute('data-document-id', this.__documentId);
    element.setAttribute('data-content-type', this.__contentType);
    if (this.__metadata) {
      element.setAttribute('data-metadata', JSON.stringify(this.__metadata));
    }
    if (this.__title) {
      element.textContent = this.__title;
    }
    return { element };
  }

  constructor(
    documentId: string,
    contentType: string,
    title?: string,
    data?: any,
    metadata?: {
      createdAt?: string;
      updatedAt?: string;
      publishedAt?: string;
      locale?: string;
      [key: string]: any;
    },
    key?: NodeKey
  ) {
    super(key);
    this.__documentId = documentId;
    this.__contentType = contentType;
    this.__title = title;
    this.__data = data;
    this.__metadata = metadata;
  }

  exportJSON(): SerializedStrapiEntryNode {
    return {
      ...super.exportJSON(),
      documentId: this.__documentId,
      contentType: this.__contentType,
      title: this.__title,
      data: this.__data,
      metadata: this.__metadata,
    };
  }

  // Getters and Setters

  getDocumentId(): string {
    return this.__documentId;
  }

  getContentType(): string {
    return this.__contentType;
  }

  getTitle(): string | undefined {
    return this.__title;
  }

  getData(): any {
    return this.__data;
  }

  getMetadata(): any {
    return this.__metadata;
  }

  setTitle(title: string): void {
    const writable = this.getWritable();
    writable.__title = title;
  }

  setData(data: any): void {
    const writable = this.getWritable();
    writable.__data = data;
  }

  setMetadata(metadata: any): void {
    const writable = this.getWritable();
    writable.__metadata = metadata;
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    const theme = config.theme;
    const className = theme.strapiEntry;
    if (className !== undefined) {
      div.className = className;
    }
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <Suspense fallback={null}>
        <StrapiEntryComponent
          documentId={this.__documentId}
          contentType={this.__contentType}
          title={this.__title}
          data={this.__data}
          metadata={this.__metadata}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createStrapiEntryNode({
  documentId,
  contentType,
  title,
  data,
  metadata,
}: StrapiEntryPayload): StrapiEntryNode {
  return $applyNodeReplacement(new StrapiEntryNode(documentId, contentType, title, data, metadata));
}

export function $isStrapiEntryNode(
  node: LexicalNode | null | undefined
): node is StrapiEntryNode {
  return node instanceof StrapiEntryNode;
}