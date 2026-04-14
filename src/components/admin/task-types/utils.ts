/**
 * Shared utilities and types for task type editors
 */

export interface TaskTypeContentEditorProps {
  content: Record<string, unknown>; // Current content data
  schema: any; // Schema from task_type.content_schema
  onChange: (content: Record<string, unknown>) => void; // Update handler
}

/**
 * Helper to update a nested property in content
 */
export function updateContentField(
  content: Record<string, unknown>,
  field: string,
  value: unknown,
  onChange: (content: Record<string, unknown>) => void
) {
  onChange({
    ...content,
    [field]: value,
  });
}

/**
 * Helper to update an array field
 */
export function updateArrayField(
  content: Record<string, unknown>,
  field: string,
  array: unknown[],
  onChange: (content: Record<string, unknown>) => void
) {
  updateContentField(content, field, array, onChange);
}

/**
 * Helper to add an item to an array
 */
export function addArrayItem(
  content: Record<string, unknown>,
  field: string,
  item: unknown,
  onChange: (content: Record<string, unknown>) => void
) {
  const currentArray = (content[field] as unknown[]) || [];
  updateArrayField(content, field, [...currentArray, item], onChange);
}

/**
 * Helper to remove an item from an array by index
 */
export function removeArrayItem(
  content: Record<string, unknown>,
  field: string,
  index: number,
  onChange: (content: Record<string, unknown>) => void
) {
  const currentArray = (content[field] as unknown[]) || [];
  updateArrayField(
    content,
    field,
    currentArray.filter((_, i) => i !== index),
    onChange
  );
}

/**
 * Helper to update an item in an array by index
 */
export function updateArrayItem(
  content: Record<string, unknown>,
  field: string,
  index: number,
  item: unknown,
  onChange: (content: Record<string, unknown>) => void
) {
  const currentArray = (content[field] as unknown[]) || [];
  const updatedArray = [...currentArray];
  updatedArray[index] = item;
  updateArrayField(content, field, updatedArray, onChange);
}

/**
 * Helper to move an item in an array
 */
export function moveArrayItem(
  content: Record<string, unknown>,
  field: string,
  fromIndex: number,
  toIndex: number,
  onChange: (content: Record<string, unknown>) => void
) {
  const currentArray = (content[field] as unknown[]) || [];
  const updatedArray = [...currentArray];
  const [movedItem] = updatedArray.splice(fromIndex, 1);
  updatedArray.splice(toIndex, 0, movedItem);
  updateArrayField(content, field, updatedArray, onChange);
}



