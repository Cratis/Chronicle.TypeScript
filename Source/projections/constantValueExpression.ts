// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Converts a constant to the projection expression understood by the Chronicle kernel. */
export function constantValueExpression(value: unknown): string {
    if (value === null || value === undefined) {
        return '$null';
    }

    if (value instanceof Date) {
        return `$value(${value.toISOString()})`;
    }

    if (typeof value === 'object' && 'value' in value) {
        return constantValueExpression(value.value);
    }

    return `$value(${String(value)})`;
}
