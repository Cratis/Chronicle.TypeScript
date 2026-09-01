// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a single compliance classification recorded on a schema node.
 */
export interface ComplianceSchemaMetadata {
    /**
     * The type of compliance metadata (e.g. 'PII').
     */
    metadataType: string;

    /**
     * Any additional details - can be empty.
     */
    details: string;
}

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
    compliance?: ComplianceSchemaMetadata[];
};
