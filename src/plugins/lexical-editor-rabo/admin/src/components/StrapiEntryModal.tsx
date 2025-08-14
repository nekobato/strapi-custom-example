import * as React from 'react';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Field,
  Modal,
  Radio,
  Table,
  Tbody,
  Td,
  Tr,
  Typography,
} from '@strapi/design-system';

import {
  unstable_useContentManagerContext as useContentManagerContext,
  useFetchClient,
} from '@strapi/strapi/admin';

const highlightText = (text: string, q: string): React.ReactElement => {
  if (!q.trim().length) return <>{text}</>;

  const regex = new RegExp(`(${q})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? <strong key={index}>{part}</strong> : part
      )}
    </>
  );
};

export interface StrapiEntryModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectEntry: (entry: {
    documentId: string;
    contentType: string;
    title: string;
    data: any;
  }) => void;
  currentEntry?: {
    documentId: string;
    contentType: string;
    title?: string;
  } | null;
}

const StrapiEntryModal = ({
  open,
  setOpen,
  onSelectEntry,
  currentEntry,
}: StrapiEntryModalProps) => {
  const { locale, formatMessage } = useIntl();
  const { get } = useFetchClient();
  const { model } = useContentManagerContext();

  const [searchResults, setSearchResults] = React.useState<
    { documentId: string; id: number; label: string; collectionName: string }[]
  >([]);
  const [q, setQ] = React.useState<string>('');
  const [selectedEntry, setSelectedEntry] = React.useState<string | undefined>();

  // Prepopulate with already selected item
  React.useEffect(() => {
    const loadCurrentSelected = async (documentId: string, collectionName: string) => {
      try {
        const result = await get(`/lexical/get/${collectionName}/${documentId}`);
        if (result.data) {
          setSearchResults([result.data]);
          setSelectedEntry(`strapi://${result.data.collectionName}/${result.data.documentId}`);
          return;
        }
      } catch (err) {
        console.log('Failed to load selected entry:');
        console.error(err);
      }
      setSearchResults([]);
    };

    if (currentEntry) {
      // Extract collection name from content type (e.g., 'api::article.article' -> 'articles')
      const collectionName = currentEntry.contentType.split('::')[1]?.split('.')[0];
      if (collectionName) {
        loadCurrentSelected(currentEntry.documentId, collectionName);
      }
    }
  }, [currentEntry, get]);

  const handleSearch = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const userQuery = e.target.value.trim();
      if (userQuery.length) {
        setQ(userQuery);
        try {
          // Use the existing search endpoint - we'll search across all content types
          const result = await get(`/lexical/search/${model}/content?q=${userQuery}&locale=${locale}`);
          if (result.status && result.status !== 200) {
            throw new Error(`Search failed:\n${JSON.stringify(result.data, null, 2)}`);
          }
          setSearchResults(result.data);
          return;
        } catch (err) {
          console.error(err);
        }
      }
      setSearchResults([]);
    },
    [get, model, locale]
  );

  const [error, setError] = React.useState('');

  const onSubmitCb = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!selectedEntry) {
        setError('Please select an entry to insert.');
        return;
      }

      // Parse the selected entry value: "strapi://collectionName/documentId"
      const match = selectedEntry.match(/^strapi:\/\/(.+?)\/(.+)$/);
      if (!match) {
        setError('Invalid entry selection.');
        return;
      }

      const [, collectionName, documentId] = match;

      try {
        // Get full entry data
        const result = await get(`/lexical/get/${collectionName}/${documentId}`);
        if (!result.data) {
          throw new Error('Entry not found');
        }

        const entryData = result.data;
        
        // Determine content type from collection name
        // This is a simplified conversion - in a real scenario, you might need a more robust mapping
        const contentType = `api::${collectionName.replace(/s$/, '')}.${collectionName.replace(/s$/, '')}`;

        onSelectEntry({
          documentId: entryData.documentId,
          contentType,
          title: entryData.label,
          data: entryData,
        });

        setError('');
        setOpen(false);
      } catch (err) {
        console.error('Failed to fetch entry data:', err);
        setError('Failed to load entry data. Please try again.');
      }
    },
    [selectedEntry, onSelectEntry, setOpen, get]
  );

  return (
    <Modal.Root open={open} onOpenChange={setOpen}>
      <Modal.Content>
        <form onSubmit={onSubmitCb}>
          <Modal.Header>
            <Modal.Title>
              {formatMessage({
                id: 'lexical.components.strapi-entry-modal.title',
                defaultMessage: 'Insert Strapi Entry',
              })}
            </Modal.Title>
          </Modal.Header>
          <Box padding={4} style={{ minHeight: '60vh', overflowY: 'scroll' }}>
            <Field.Root error={error} onChange={handleSearch} required>
              <Field.Label>
                {formatMessage({
                  id: 'lexical.components.strapi-entry-modal.search.label',
                  defaultMessage: 'Search for content within Strapi to insert',
                })}
              </Field.Label>
              <Field.Input
                type="search"
                placeholder={formatMessage({
                  id: 'lexical.components.strapi-entry-modal.search.placeholder',
                  defaultMessage: 'Search for entries...',
                })}
                size="M"
              />
              <Field.Error />
            </Field.Root>
            {searchResults.length > 0 && (
              <Radio.Group
                name="entry"
                value={selectedEntry}
                onValueChange={setSelectedEntry}
              >
                <Table colCount={2} rowCount={1} style={{ marginTop: '0.5rem' }}>
                  <Tbody>
                    {searchResults.map((result) => (
                      <Tr key={result.documentId}>
                        <Td>
                          <Radio.Item
                            value={`strapi://${result.collectionName}/${result.documentId}`}
                            id={result.documentId}
                          />
                        </Td>
                        <Td>
                          <label htmlFor={result.documentId}>
                            <Typography>
                              {highlightText(result.label, q)} ({result.collectionName}:
                              {result.id})
                            </Typography>
                          </label>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Radio.Group>
            )}
          </Box>
          <Modal.Footer>
            <Modal.Close>
              <Button variant="tertiary" onClick={() => setOpen(false)}>
                {formatMessage({
                  id: 'lexical.components.strapi-entry-modal.button.cancel',
                  defaultMessage: 'Cancel',
                })}
              </Button>
            </Modal.Close>
            <Button type="submit">
              {formatMessage({
                id: 'lexical.components.strapi-entry-modal.button.insert',
                defaultMessage: 'Insert Entry',
              })}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
};

export default StrapiEntryModal;