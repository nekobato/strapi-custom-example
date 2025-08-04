import {
  Box,
  Button,
  Field,
  Flex,
  IconButton,
  TextInput,
} from "@strapi/design-system";
import { Plus, Trash } from "@strapi/icons";
import React, { forwardRef, useEffect, useState } from "react";
import { useIntl } from "react-intl";

interface ListInputProps {
  attribute: {
    type: string;
    required?: boolean;
    options?: {
      placeholder?: string;
    };
  };
  description?: {
    id: string;
    defaultMessage: string;
  };
  disabled?: boolean;
  error?: string;
  intlLabel: {
    id: string;
    defaultMessage: string;
  };
  labelAction?: React.ReactNode;
  name: string;
  onChange: (event: {
    target: { name: string; value: string[] | null; type: string };
  }) => void;
  required?: boolean;
  value?: string[] | null;
}

const ListInput = forwardRef<HTMLDivElement, ListInputProps>(
  (
    {
      attribute,
      disabled = false,
      error,
      intlLabel,
      name,
      onChange,
      required = false,
      value = []
    },
    ref
  ) => {
    const { formatMessage } = useIntl();
    const [items, setItems] = useState<string[]>(() =>
      Array.isArray(value) ? value : []
    );

    useEffect(() => {
      setItems(Array.isArray(value) ? value : []);
    }, [value]);

    const handleAddItem = () => {
      const newItems = [...items, ""];
      setItems(newItems);
      onChange({
        target: {
          name,
          value: newItems,
          type: attribute.type
        }
      });
    };

    const handleRemoveItem = (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      onChange({
        target: {
          name,
          value: newItems.length > 0 ? newItems : null,
          type: attribute.type
        }
      });
    };

    const handleItemChange = (index: number, newValue: string) => {
      const newItems = [...items];
      newItems[index] = newValue;
      setItems(newItems);
      onChange({
        target: {
          name,
          value: newItems,
          type: attribute.type
        }
      });
    };

    return (
      <Field.Root name={name} id={name} error={error} required={required} ref={ref}>
        <Box padding={1}>
          <Field.Label>
            {formatMessage(intlLabel)}
          </Field.Label>
          <Box paddingTop={2}>
            {items.map((item, index) => (
              <Flex key={index} gap={2} paddingBottom={2}>
                <TextInput
                  placeholder={
                    attribute.options?.placeholder ||
                    "リスト項目を入力してください"
                  }
                  value={item}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    handleItemChange(index, e.target.value)
                  }
                  disabled={disabled}
                  size="S"
                />
                <IconButton
                  label="削除"
                  variant="danger"
                  onClick={() => handleRemoveItem(index)}
                  disabled={disabled}
                >
                  <Trash />
                </IconButton>
              </Flex>
            ))}
            <Button
              variant="secondary"
              startIcon={<Plus />}
              onClick={handleAddItem}
              disabled={disabled}
              size="S"
            >
              項目を追加
            </Button>
          </Box>
          <Field.Hint />
          <Field.Error />
        </Box>
      </Field.Root>
    );
  }
);

ListInput.displayName = "ListInput";

export default ListInput;
