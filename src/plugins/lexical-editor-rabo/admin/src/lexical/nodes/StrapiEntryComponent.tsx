/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { BaseSelection, LexicalCommand, LexicalEditor, NodeKey } from 'lexical';
import type { JSX } from 'react';

import './StrapiEntryNode.css';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isNodeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  createCommand,
  DRAGSTART_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useFetchClient } from '@strapi/strapi/admin';

import { $isStrapiEntryNode } from './StrapiEntryNode';

export const RIGHT_CLICK_STRAPI_ENTRY_COMMAND: LexicalCommand<MouseEvent> = createCommand(
  'RIGHT_CLICK_STRAPI_ENTRY_COMMAND'
);

export default function StrapiEntryComponent({
  documentId,
  contentType,
  title,
  data,
  metadata,
  nodeKey,
}: {
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
  nodeKey: NodeKey;
}): JSX.Element {
  const { formatMessage } = useIntl();
  const cardRef = useRef<null | HTMLDivElement>(null);
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const [editor] = useLexicalComposerContext();
  const [selection, setSelection] = useState<BaseSelection | null>(null);
  const activeEditorRef = useRef<LexicalEditor | null>(null);
  const isEditable = useLexicalEditable();
  const [isLoading, setIsLoading] = useState(false);
  const [entryData, setEntryData] = useState<any>(data);
  const [entryTitle, setEntryTitle] = useState<string | undefined>(title);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { get } = useFetchClient();

  // Load entry data if not provided
  useEffect(() => {
    if (!data && documentId && contentType) {
      setIsLoading(true);
      loadEntryData();
    }
  }, [documentId, contentType, data]);

  // Auto-refresh entry data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (documentId && contentType && !isLoading && !isRefreshing) {
        refreshEntryData();
      }
    }, 30000); // Check for updates every 30 seconds

    return () => clearInterval(interval);
  }, [documentId, contentType, isLoading, isRefreshing]);

  const getCollectionNameFromContentType = (contentType: string): string => {
    // Convert 'api::article.article' to 'articles'
    const parts = contentType.split('::')[1]?.split('.');
    if (parts && parts[0]) {
      // Add 's' for plural form if not already plural
      return parts[0].endsWith('s') ? parts[0] : `${parts[0]}s`;
    }
    return contentType;
  };

  const loadEntryData = async () => {
    try {
      const collectionName = getCollectionNameFromContentType(contentType);
      const result = await get(`/lexical/get/${collectionName}/${documentId}`);
      if (result.data) {
        setEntryData(result.data);
        setEntryTitle(result.data.label);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to load entry data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshEntryData = async () => {
    try {
      setIsRefreshing(true);
      const collectionName = getCollectionNameFromContentType(contentType);
      const result = await get(`/lexical/get/${collectionName}/${documentId}`);
      if (result.data) {
        // Check if data has actually changed
        const newData = result.data;
        if (JSON.stringify(newData) !== JSON.stringify(entryData)) {
          setEntryData(newData);
          setEntryTitle(newData.label);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error('Failed to refresh entry data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const $onDelete = useCallback(
    (payload: KeyboardEvent) => {
      const deleteSelection = $getSelection();
      if (isSelected && $isNodeSelection(deleteSelection)) {
        const event: KeyboardEvent = payload;
        event.preventDefault();
        deleteSelection.getNodes().forEach((node) => {
          if ($isStrapiEntryNode(node)) {
            node.remove();
          }
        });
      }
      return false;
    },
    [isSelected]
  );

  const $onEnter = useCallback(
    (event: KeyboardEvent) => {
      const latestSelection = $getSelection();
      if (
        isSelected &&
        $isNodeSelection(latestSelection) &&
        latestSelection.getNodes().length === 1
      ) {
        // TODO: Open entry details or edit modal
        event.preventDefault();
        return true;
      }
      return false;
    },
    [isSelected]
  );

  const $onEscape = useCallback(
    (event: KeyboardEvent) => {
      if (cardRef.current === event.target) {
        $setSelection(null);
        editor.update(() => {
          setSelected(true);
          const parentRootElement = editor.getRootElement();
          if (parentRootElement !== null) {
            parentRootElement.focus();
          }
        });
        return true;
      }
      return false;
    },
    [editor, setSelected]
  );

  const onClick = useCallback(
    (payload: MouseEvent) => {
      const event = payload;

      if (event.target === cardRef.current || cardRef.current?.contains(event.target as Node)) {
        if (event.shiftKey) {
          setSelected(!isSelected);
        } else {
          clearSelection();
          setSelected(true);
        }
        return true;
      }

      return false;
    },
    [isSelected, setSelected, clearSelection]
  );

  const onRightClick = useCallback(
    (event: MouseEvent): void => {
      editor.getEditorState().read(() => {
        const latestSelection = $getSelection();
        const domElement = event.target as HTMLElement;
        if (
          (domElement === cardRef.current || cardRef.current?.contains(domElement)) &&
          $isNodeSelection(latestSelection)
        ) {
          editor.dispatchCommand(RIGHT_CLICK_STRAPI_ENTRY_COMMAND, event as MouseEvent);
        }
      });
    },
    [editor]
  );

  useEffect(() => {
    let isMounted = true;
    const rootElement = editor.getRootElement();
    const unregister = mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        if (isMounted) {
          setSelection(editorState.read(() => $getSelection()));
        }
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_, activeEditor) => {
          activeEditorRef.current = activeEditor;
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand<MouseEvent>(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
      editor.registerCommand<MouseEvent>(
        RIGHT_CLICK_STRAPI_ENTRY_COMMAND,
        onClick,
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        (event) => {
          if (event.target === cardRef.current) {
            event.preventDefault();
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, $onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ENTER_COMMAND, $onEnter, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ESCAPE_COMMAND, $onEscape, COMMAND_PRIORITY_LOW)
    );

    rootElement?.addEventListener('contextmenu', onRightClick);

    return () => {
      isMounted = false;
      unregister();
      rootElement?.removeEventListener('contextmenu', onRightClick);
    };
  }, [
    clearSelection,
    editor,
    isSelected,
    nodeKey,
    $onDelete,
    $onEnter,
    $onEscape,
    onClick,
    onRightClick,
    setSelected,
  ]);

  const draggable = isSelected && $isNodeSelection(selection);
  const isFocused = isSelected && isEditable;

  if (isLoading) {
    return (
      <div className="strapi-entry-card strapi-entry-card-loading">
        {formatMessage({
          id: 'lexical.nodes.entry.loading',
          defaultMessage: 'Loading entry...',
        })}
      </div>
    );
  }

  const displayTitle = entryTitle ||
    formatMessage({
      id: 'lexical.nodes.entry.untitled',
      defaultMessage: 'Untitled Entry',
    });

  const isStale = !entryData && documentId; // Entry exists but data couldn't be loaded

  return (
    <div
      ref={cardRef}
      className={`strapi-entry-card ${isFocused ? 'focused' : ''} ${draggable ? 'draggable' : ''}`}
      draggable={draggable}
      role="button"
      tabIndex={0}
      aria-label={formatMessage(
        {
          id: 'lexical.nodes.entry.aria.label',
          defaultMessage: 'Strapi entry: {title}',
        },
        { title: entryTitle || documentId }
      )}
    >
      <div className="strapi-entry-card-header">
        <span className="strapi-entry-card-type">{contentType}</span>
        {isRefreshing && (
          <span className="strapi-entry-card-status" title="Refreshing...">
            ↻
          </span>
        )}
        {isStale && (
          <span className="strapi-entry-card-status strapi-entry-card-error" title="Content not found">
            ⚠
          </span>
        )}
      </div>
      <h4 className="strapi-entry-card-title">
        {displayTitle}
      </h4>
      <div className="strapi-entry-card-id">
        ID: {documentId}
        {lastUpdated && (
          <span className="strapi-entry-card-updated">
            {' • '}
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}