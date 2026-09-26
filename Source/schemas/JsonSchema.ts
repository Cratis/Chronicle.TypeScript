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
 * Represents a single security classification recorded on a schema node.
 *
 * This is the security counterpart to {@link ComplianceSchemaMetadata} - written under its own,
 * separate `security` schema key rather than merged into `compliance`. See
 * `Source/confidentiality/SecurityMetadataType.ts` for why.
 */
export interface SecuritySchemaMetadata {
    /**
     * The type of security metadata (e.g. 'EncryptedSubject', 'EncryptedNamespace', 'EncryptedGlobal').
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
    type?: 'null' | 'boolean' | 'object' | 'array' | 'number' | 'string' | 'integer' | readonly ['string', 'null'];
    format?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    additionalProperties?: boolean | JsonSchema;
    enum?: Array<string | number | boolean | null>;
    compliance?: ComplianceSchemaMetadata[];
    security?: SecuritySchemaMetadata[];
};
