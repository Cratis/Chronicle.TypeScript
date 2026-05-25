// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a JSON Schema object.
 */
export type JsonSchema = {
    $schema?: string;
    title?: string;
    description?: string;
    type?: 'null' | 'boolean' | 'object' | 'array' | 'number' | 'string' | 'integer';
    format?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    additionalProperties?: boolean | JsonSchema;
    enum?: Array<string | number | boolean | null>;
};
