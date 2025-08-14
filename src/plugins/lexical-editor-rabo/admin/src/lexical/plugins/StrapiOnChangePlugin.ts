import { EditorState, SerializedEditorState, SerializedLexicalNode } from 'lexical';
import { useEffect, useRef } from 'react';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import equal from 'fast-deep-equal';
import { extractReferences, hasReferencesChanged, ExtractedReferences } from '../../utils/reference-extractor';

export interface StrapiOnChangeData {
  editorState: EditorState;
  references?: ExtractedReferences;
}

function StrapiOnChangePlugin({
  onChange,
  expectedEditorState,
  enableReferences = false,
}: {
  onChange: (data: StrapiOnChangeData) => void;
  expectedEditorState?: SerializedEditorState<SerializedLexicalNode>;
  enableReferences?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const lastReferencesRef = useRef<ExtractedReferences>({ media: [], entries: [] });

  // Update strapi when lexical editor changes
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let references: ExtractedReferences | undefined;
      
      if (enableReferences) {
        const serialized = editorState.toJSON();
        references = extractReferences(serialized);
        
        // 参照情報が変更された場合のみ、参照情報を含めて送信
        if (hasReferencesChanged(lastReferencesRef.current, references)) {
          lastReferencesRef.current = references;
        } else {
          // 参照情報に変更がない場合は、前回と同じ参照情報を使用
          references = lastReferencesRef.current;
        }
      }
      
      onChange({
        editorState,
        references: enableReferences ? references : undefined,
      });
    });
  }, [editor, onChange, enableReferences]);

  // Update lexical editor when strapi changes
  useEffect(() => {
    if (expectedEditorState && !equal(expectedEditorState, editor.getEditorState().toJSON())) {
      const parsedEditorState = editor.parseEditorState(expectedEditorState);
      editor.setEditorState(parsedEditorState);
    }
  }, [editor, expectedEditorState]);

  return null;
}

export default StrapiOnChangePlugin;
