/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
  $createRangeSelection,
  $getSelection,
  $insertNodes,
  $isNodeSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGOVER_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  getDOMSelectionFromTarget,
  isHTMLElement,
  LexicalCommand,
  LexicalEditor,
} from 'lexical';
import { useEffect } from 'react';
import * as React from 'react';

import {
  $createStrapiImageNode,
  $isStrapiImageNode,
  StrapiImageNode,
  StrapiImagePayload,
} from '../nodes/StrapiImageNode';
import {
  $createStrapiVideoNode,
  $isStrapiVideoNode,
  StrapiVideoNode,
  StrapiVideoPayload,
} from '../nodes/StrapiVideoNode';
import { getMediaTypeFromAsset, isImageAsset, isVideoAsset } from '../utils/mediaTypeUtils';

export type InsertStrapiImagePayload = Readonly<StrapiImagePayload>;
export type InsertStrapiVideoPayload = Readonly<StrapiVideoPayload>;

export const INSERT_STRAPI_IMAGE_COMMAND: LexicalCommand<InsertStrapiImagePayload> = createCommand(
  'INSERT_STRAPI_IMAGE_COMMAND'
);

export const INSERT_STRAPI_VIDEO_COMMAND: LexicalCommand<InsertStrapiVideoPayload> = createCommand(
  'INSERT_STRAPI_VIDEO_COMMAND'
);

export function InsertStrapiImageDialog({
  activeEditor,
  onClose,
  MediaLibraryDialog,
}: {
  activeEditor: LexicalEditor;
  onClose: () => void;
  MediaLibraryDialog: React.ComponentType<{
    allowedTypes: string[];
    onClose: () => void;
    onSelectAssets: (assets: any[]) => void;
  }>;
}) {
  const handleSelectAssets = (assets: any[]) => {
    try {
      if (assets.length > 0) {
        for (const asset of assets) {
          const mediaType = getMediaTypeFromAsset(asset);
          
          if (mediaType === 'image' || isImageAsset(asset)) {
            // 画像として挿入
            const imagePayload: InsertStrapiImagePayload = {
              documentId: asset.documentId,
              src: asset.formats?.thumbnail?.url || asset.url,
              metadata: {
                url: asset.url,
                alternativeText: asset.alternativeText,
                caption: asset.caption,
                width: asset.width,
                height: asset.height,
                formats: asset.formats,
                mime: asset.mime,
                size: asset.size,
                updatedAt: asset.updatedAt,
              },
            };
            activeEditor.dispatchCommand(INSERT_STRAPI_IMAGE_COMMAND, imagePayload);
          } else if (mediaType === 'video' || isVideoAsset(asset)) {
            // 動画として挿入
            const videoPayload: InsertStrapiVideoPayload = {
              documentId: asset.documentId,
              src: asset.url,
              metadata: {
                url: asset.url,
                alternativeText: asset.alternativeText,
                caption: asset.caption,
                width: asset.width,
                height: asset.height,
                mime: asset.mime,
                size: asset.size,
                updatedAt: asset.updatedAt,
              },
            };
            activeEditor.dispatchCommand(INSERT_STRAPI_VIDEO_COMMAND, videoPayload);
          } else {
            console.warn('Unsupported media type for asset:', asset);
          }
        }
        onClose();
      }
    } catch (err) {
      console.log('Unable to insert media:');
      console.log(err);
    }
  };

  return (
    <MediaLibraryDialog
      allowedTypes={['images', 'videos']}
      onClose={onClose}
      onSelectAssets={handleSelectAssets}
    />
  );
}

export default function StrapiImagePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([StrapiImageNode, StrapiVideoNode])) {
      throw new Error('StrapiImagePlugin: StrapiImageNode and StrapiVideoNode must be registered on editor');
    }

    return mergeRegister(
      editor.registerCommand<InsertStrapiImagePayload>(
        INSERT_STRAPI_IMAGE_COMMAND,
        (payload) => {
          const strapiImageNode = $createStrapiImageNode(payload);
          $insertNodes([strapiImageNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand<InsertStrapiVideoPayload>(
        INSERT_STRAPI_VIDEO_COMMAND,
        (payload) => {
          const strapiVideoNode = $createStrapiVideoNode(payload);
          $insertNodes([strapiVideoNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR
      ),
      editor.registerCommand<DragEvent>(
        DRAGSTART_COMMAND,
        (event) => {
          return $onDragStart(event);
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand<DragEvent>(
        DRAGOVER_COMMAND,
        (event) => {
          return $onDragover(event);
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand<DragEvent>(
        DROP_COMMAND,
        (event) => {
          return $onDrop(event, editor);
        },
        COMMAND_PRIORITY_HIGH
      )
    );
  }, [editor]);

  return null;
}

const TRANSPARENT_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const img = document.createElement('img');
img.src = TRANSPARENT_IMAGE;

function $onDragStart(event: DragEvent): boolean {
  const node = $getMediaNodeInSelection();
  if (!node) {
    return false;
  }
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return false;
  }
  dataTransfer.setData('text/plain', '_');
  dataTransfer.setDragImage(img, 0, 0);
  
  if ($isStrapiImageNode(node)) {
    dataTransfer.setData(
      'application/x-lexical-drag',
      JSON.stringify({
        data: {
          key: node.getKey(),
          src: node.__src,
          documentId: node.__documentId,
        },
        type: 'image',
      })
    );
  } else if ($isStrapiVideoNode(node)) {
    dataTransfer.setData(
      'application/x-lexical-drag',
      JSON.stringify({
        data: {
          key: node.getKey(),
          src: node.getSrc(),
          documentId: node.getDocumentId(),
        },
        type: 'video',
      })
    );
  }

  return true;
}

function $onDragover(event: DragEvent): boolean {
  const node = $getMediaNodeInSelection();
  if (!node) {
    return false;
  }
  if (!canDropMedia(event)) {
    event.preventDefault();
  }
  return true;
}

function $onDrop(event: DragEvent, editor: LexicalEditor): boolean {
  const node = $getMediaNodeInSelection();
  if (!node) {
    return false;
  }
  const data = getDragMediaData(event);
  if (!data) {
    return false;
  }
  event.preventDefault();
  if (canDropMedia(event)) {
    const range = getDragSelection(event);
    node.remove();
    const rangeSelection = $createRangeSelection();
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range);
    }
    $setSelection(rangeSelection);
    
    // データのタイプに応じて適切なコマンドを発行
    if (data.type === 'image') {
      editor.dispatchCommand(INSERT_STRAPI_IMAGE_COMMAND, data.payload as InsertStrapiImagePayload);
    } else if (data.type === 'video') {
      editor.dispatchCommand(INSERT_STRAPI_VIDEO_COMMAND, data.payload as InsertStrapiVideoPayload);
    }
  }
  return true;
}

function $getMediaNodeInSelection(): StrapiImageNode | StrapiVideoNode | null {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) {
    return null;
  }
  const nodes = selection.getNodes();
  const node = nodes[0];
  if ($isStrapiImageNode(node)) return node;
  if ($isStrapiVideoNode(node)) return node;
  return null;
}

function getDragMediaData(event: DragEvent): null | { type: 'image' | 'video', payload: InsertStrapiImagePayload | InsertStrapiVideoPayload } {
  const dragData = event.dataTransfer?.getData('application/x-lexical-drag');
  if (!dragData) {
    return null;
  }
  const { type, data } = JSON.parse(dragData);
  if (type !== 'image' && type !== 'video') {
    return null;
  }

  return { type, payload: data };
}

declare global {
  interface DragEvent {
    rangeOffset?: number;
    rangeParent?: Node;
  }
}

function canDropMedia(event: DragEvent): boolean {
  const target = event.target;
  return !!(
    isHTMLElement(target) &&
    !target.closest('code, span.editor-image, span.editor-video') &&
    isHTMLElement(target.parentElement) &&
    target.parentElement.closest('div.ContentEditable__root')
  );
}

function getDragSelection(event: DragEvent): Range | null | undefined {
  let range;
  const domSelection = getDOMSelectionFromTarget(event.target);
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY);
  } else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
    range = domSelection.getRangeAt(0);
  } else {
    throw Error(`Cannot get the selection when dragging`);
  }

  return range;
}
