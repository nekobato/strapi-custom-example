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

const StrapiImageComponent = React.lazy(() => import('./StrapiImageComponent'));

export interface StrapiImagePayload {
  documentId: string;
  src: string;
  metadata?: {
    url?: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
    formats?: any;
    mime?: string;
    size?: number;
    updatedAt?: string;
    [key: string]: any;
  };
}

export type SerializedStrapiImageNode = Spread<
  {
    documentId: string;
    src: string;
    metadata?: {
      url?: string;
      alternativeText?: string;
      caption?: string;
      width?: number;
      height?: number;
      formats?: any;
      mime?: string;
      size?: number;
      updatedAt?: string;
      [key: string]: any;
    };
  },
  SerializedLexicalNode
>;

export type SerializedLinkNode = Spread<
  {
    url: string;
  },
  SerializedLexicalNode
>;

export class StrapiImageNode extends DecoratorNode<JSX.Element> {
  __documentId: string;
  __src: string;
  __metadata?: {
    url?: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
    formats?: any;
    mime?: string;
    size?: number;
    updatedAt?: string;
    [key: string]: any;
  };

  static getType(): string {
    return 'strapi-image';
  }

  static clone(node: StrapiImageNode): StrapiImageNode {
    return new StrapiImageNode(node.__documentId, node.__src, node.__metadata, node.__key);
  }

  static importJSON(serializedNode: SerializedStrapiImageNode): StrapiImageNode {
    const { documentId, src, metadata } = serializedNode;
    return $createStrapiImageNode({
      documentId,
      src,
      metadata,
    }).updateFromJSON(serializedNode);
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedStrapiImageNode>): this {
    const node = super.updateFromJSON(serializedNode);

    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    return { element };
  }

  constructor(documentId: string, src: string, metadata?: any, key?: NodeKey) {
    super(key);
    this.__documentId = documentId;
    this.__src = src;
    this.__metadata = metadata;
  }

  exportJSON(): SerializedStrapiImageNode {
    return {
      ...super.exportJSON(),
      documentId: this.__documentId,
      src: this.__src,
      metadata: this.__metadata,
    };
  }

  // Getters and Setters

  getDocumentId(): string {
    return this.__documentId;
  }

  getSrc(): string {
    return this.__src;
  }

  getMetadata(): any {
    return this.__metadata;
  }

  setMetadata(metadata: any): void {
    const writable = this.getWritable();
    writable.__metadata = metadata;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <Suspense fallback={null}>
        <StrapiImageComponent
          documentId={this.__documentId}
          src={this.__src}
          metadata={this.__metadata}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createStrapiImageNode({ documentId, src, metadata }: StrapiImagePayload): StrapiImageNode {
  return $applyNodeReplacement(new StrapiImageNode(documentId, src, metadata));
}

export function $isStrapiImageNode(node: LexicalNode | null | undefined): node is StrapiImageNode {
  return node instanceof StrapiImageNode;
}
