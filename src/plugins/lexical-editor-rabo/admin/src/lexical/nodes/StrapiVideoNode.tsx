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

const StrapiVideoComponent = React.lazy(() => import('./StrapiVideoComponent'));

export interface StrapiVideoPayload {
  documentId: string;
  src: string;
  metadata?: {
    url?: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
    mime?: string;
    size?: number;
    updatedAt?: string;
    [key: string]: any;
  };
}

export type SerializedStrapiVideoNode = Spread<
  {
    documentId: string;
    src: string;
    metadata?: {
      url?: string;
      alternativeText?: string;
      caption?: string;
      width?: number;
      height?: number;
      mime?: string;
      size?: number;
      updatedAt?: string;
      [key: string]: any;
    };
  },
  SerializedLexicalNode
>;

export class StrapiVideoNode extends DecoratorNode<JSX.Element> {
  __documentId: string;
  __src: string;
  __metadata?: {
    url?: string;
    alternativeText?: string;
    caption?: string;
    width?: number;
    height?: number;
    mime?: string;
    size?: number;
    updatedAt?: string;
    [key: string]: any;
  };

  static getType(): string {
    return 'strapi-video';
  }

  static clone(node: StrapiVideoNode): StrapiVideoNode {
    return new StrapiVideoNode(node.__documentId, node.__src, node.__metadata, node.__key);
  }

  static importJSON(serializedNode: SerializedStrapiVideoNode): StrapiVideoNode {
    const { documentId, src, metadata } = serializedNode;
    return $createStrapiVideoNode({
      documentId,
      src,
      metadata,
    }).updateFromJSON(serializedNode);
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedStrapiVideoNode>): this {
    const node = super.updateFromJSON(serializedNode);

    return node;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('video');
    element.setAttribute('src', this.__src);
    element.setAttribute('controls', 'true');
    return { element };
  }

  constructor(documentId: string, src: string, metadata?: any, key?: NodeKey) {
    super(key);
    this.__documentId = documentId;
    this.__src = src;
    this.__metadata = metadata;
  }

  exportJSON(): SerializedStrapiVideoNode {
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
    const className = theme.video;
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
        <StrapiVideoComponent
          documentId={this.__documentId}
          src={this.__src}
          metadata={this.__metadata}
          nodeKey={this.__key}
        />
      </Suspense>
    );
  }
}

export function $createStrapiVideoNode({ documentId, src, metadata }: StrapiVideoPayload): StrapiVideoNode {
  return $applyNodeReplacement(new StrapiVideoNode(documentId, src, metadata));
}

export function $isStrapiVideoNode(node: LexicalNode | null | undefined): node is StrapiVideoNode {
  return node instanceof StrapiVideoNode;
}