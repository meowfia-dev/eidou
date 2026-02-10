/**
 * EUIP Props Validation Module
 *
 * Provides compile-time and runtime validation for EUIP component props.
 * Ensures required props are present before rendering, preventing crashes
 * and providing clear error messages for debugging.
 *
 * @see /specification/v0_1/json/components.json for authoritative schema
 */

import type { EuipType, EuipPropsByType } from '../../lib/euip';

/**
 * Required props for each EUIP component type.
 *
 * SYNC REQUIREMENT: This MUST stay in sync with the JSON Schema at
 * /specification/v0_1/json/components.json
 *
 * Only components with `required` fields in their schema need entries here.
 * Components without required props (e.g., spacer, divider) are omitted.
 */
export const REQUIRED_PROPS: Partial<Record<EuipType, readonly string[]>> = {
  // Input atoms (need 'name' for event identification)
  input: ['name'],
  textarea: ['name'],
  switch: ['name'],
  select: ['name', 'options'],
  checkbox: ['name'],
  radiogroup: ['name', 'options'],
  slider: ['name'],
  codeeditor: ['name'],

  // Action atoms
  button: ['action'],

  // Display atoms with required content
  icon: ['name'],
  image: ['src'],
  badge: ['label'],
  toast: ['message'],
  tooltip: ['content'],

  // New atoms
  link: ['label'],
  markdown: ['content'],
  terminal: ['lines'],
  chart: ['variant', 'data'],
} as const;

/**
 * Result of props validation.
 * Either valid with typed props, or invalid with error details.
 */
export type ValidationResult<T> =
  | { valid: true; props: T }
  | { valid: false; error: string; missingProps: string[] };

/**
 * Validate EUIP node props against required props schema.
 *
 * @param type - The EUIP component type
 * @param rawProps - The raw props from the EUIP node (may be undefined)
 * @returns ValidationResult with typed props if valid, or error details if invalid
 *
 * @example
 * ```ts
 * const result = validateProps('textarea', node.props);
 * if (result.valid) {
 *   return <Textarea {...result.props} />;
 * } else {
 *   return <ErrorGlitch message={result.error} />;
 * }
 * ```
 */
export function validateProps<T extends EuipType>(
  type: T,
  rawProps: unknown
): ValidationResult<EuipPropsByType[T]> {
  const required = REQUIRED_PROPS[type] || [];
  const props = (rawProps || {}) as Record<string, unknown>;

  const missing = required.filter((key) => props[key] === undefined);

  if (missing.length > 0) {
    return {
      valid: false,
      error: `EUIP Protocol Violation: <${type}> missing required props: [${missing.join(', ')}]`,
      missingProps: [...missing],
    };
  }

  return {
    valid: true,
    props: props as EuipPropsByType[T],
  };
}

/**
 * Check if a component type has required props defined.
 * Useful for determining if validation is needed.
 */
export function hasRequiredProps(type: EuipType): boolean {
  const required = REQUIRED_PROPS[type];
  return required !== undefined && required.length > 0;
}
