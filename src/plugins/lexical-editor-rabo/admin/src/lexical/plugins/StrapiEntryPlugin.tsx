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

import {
  $createStrapiEntryNode,
  $isStrapiEntryNode,
  StrapiEntryNode,
  StrapiEntryPayload,
} from '../nodes/StrapiEntryNode';

export type InsertStrapiEntryPayload = Readonly<StrapiEntryPayload>;

export const INSERT_STRAPI_ENTRY_COMMAND: LexicalCommand<InsertStrapiEntryPayload> = createCommand(
  'INSERT_STRAPI_ENTRY_COMMAND'
);

// This dialog has been moved to StrapiEntryModal component

export default function StrapiEntryPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([StrapiEntryNode])) {
      throw new Error('StrapiEntryPlugin: StrapiEntryNode not registered on editor');
    }

    return mergeRegister(
      editor.registerCommand<InsertStrapiEntryPayload>(
        INSERT_STRAPI_ENTRY_COMMAND,
        (payload) => {
          const strapiEntryNode = $createStrapiEntryNode(payload);
          $insertNodes([strapiEntryNode]);
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
  const node = $getEntryNodeInSelection();
  if (!node) {
    return false;
  }
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return false;
  }
  dataTransfer.setData('text/plain', '_');
  dataTransfer.setDragImage(img, 0, 0);
  dataTransfer.setData(
    'application/x-lexical-drag',
    JSON.stringify({
      data: {
        key: node.getKey(),
        documentId: node.__documentId,
        contentType: node.__contentType,
        title: node.__title,
        data: node.__data,
      },
      type: 'entry',
    })
  );

  return true;
}

function $onDragover(event: DragEvent): boolean {
  const node = $getEntryNodeInSelection();
  if (!node) {
    return false;
  }
  if (!canDropEntry(event)) {
    event.preventDefault();
  }
  return true;
}

function $onDrop(event: DragEvent, editor: LexicalEditor): boolean {
  const node = $getEntryNodeInSelection();
  if (!node) {
    return false;
  }
  const data = getDragEntryData(event);
  if (!data) {
    return false;
  }
  event.preventDefault();
  if (canDropEntry(event)) {
    const range = getDragSelection(event);
    node.remove();
    const rangeSelection = $createRangeSelection();
    if (range !== null && range !== undefined) {
      rangeSelection.applyDOMRange(range);
    }
    $setSelection(rangeSelection);
    editor.dispatchCommand(INSERT_STRAPI_ENTRY_COMMAND, data);
  }
  return true;
}

function $getEntryNodeInSelection(): StrapiEntryNode | null {
  const selection = $getSelection();
  if (!$isNodeSelection(selection)) {
    return null;
  }
  const nodes = selection.getNodes();
  const node = nodes[0];
  return $isStrapiEntryNode(node) ? node : null;
}

function getDragEntryData(event: DragEvent): null | InsertStrapiEntryPayload {
  const dragData = event.dataTransfer?.getData('application/x-lexical-drag');
  if (!dragData) {
    return null;
  }
  const { type, data } = JSON.parse(dragData);
  if (type !== 'entry') {
    return null;
  }

  return data;
}

declare global {
  interface DragEvent {
    rangeOffset?: number;
    rangeParent?: Node;
  }
}

function canDropEntry(event: DragEvent): boolean {
  const target = event.target;
  return !!(
    isHTMLElement(target) &&
    !target.closest('code, .strapi-entry-card') &&
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