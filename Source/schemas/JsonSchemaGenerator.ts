// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { conceptAsTypeKey, Constructor, Fields, Guid, typeKeyOf } from '@cratis/fundamentals';
import { ComplianceSchemaMetadata, JsonSchema, SecuritySchemaMetadata } from './JsonSchema.js';
import { TypeIntrospector } from '../types/index.js';
import { ComplianceMetadata } from '../compliance/ComplianceMetadata.js';
import { ComplianceMetadataResolver } from '../compliance/ComplianceMetadataResolver.js';
import { SecurityMetadata } from '../confidentiality/SecurityMetadata.js';
import { SecurityMetadataResolver } from '../confidentiality/SecurityMetadataResolver.js';
import { PIIAndEncryptedCombinedNotSupported } from '../confidentiality/PIIAndEncryptedCombinedNotSupported.js';

/**
 * Generates JSON schemas for class constructors using reflection metadata.
 */
export class JsonSchemaGenerator {
    private static readonly _knownTypeFormats = new Map<Function, { type: JsonSchema['type']; format: string }>([
        [Guid, { type: 'string', format: 'guid' }],
        [Date, { type: 'string', format: 'date-time' }]
    ]);

    private static readonly _formatAliases = new Map<string, string>([
        ['uuid', 'guid']
    ]);

    /**
     * Creates an empty schema for a type name.
     * @param title - The title to use for the schema.
     * @returns An empty object schema.
     */
    static createEmptySchema(title: string): JsonSchema {
        return {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            title,
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false
        };
    }

    /**
     * Generates a JSON schema for a class constructor.
     * @param target - The class constructor to generate schema for.
     * @param members - Optional pre-introspected members for reuse.
     * @param requireResolvedTypes - Reject unresolved members instead of retaining the legacy empty-schema fallback.
     * @returns The generated JSON schema.
     */
    static generate(target: Function, members?: ReadonlyMap<string, Function | undefined>, requireResolvedTypes = false): JsonSchema {
        const membersToUse = members ?? TypeIntrospector.getMembers(target);
        if (requireResolvedTypes && membersToUse.size === 0) {
            throw new TypeError(`Cannot determine the members of ${target.name}; declare @field with each member's runtime type.`);
        }
        const schemaProperties: Record<string, JsonSchema> = {};
        const prototype = target.prototype;

        for (const [memberName, memberType] of membersToUse.entries()) {
            if (!memberType && requireResolvedTypes) {
                throw new TypeError(`Cannot determine the type of ${target.name}.${memberName}; declare @field with its runtime type.`);
            }
            const propertySchema = this.mapRuntimeTypeToSchema(memberType, target, memberName, requireResolvedTypes);
            // Only include properties whose type was resolved. An empty schema ({}) means
            // the runtime type was unavailable (e.g. esbuild/tsx omits design:paramtypes).
            if (Object.keys(propertySchema).length > 0) {
                // An array of concept elements resolves and applies its own item-level compliance
                // and security metadata inside mapRuntimeTypeToSchema - the general
                // property/type/declaring-class walk below is skipped for it, mirroring the C#
                // generator's enumerable-of-concept branch.
                if (!this.isConceptArrayMember(target, memberName, memberType)) {
                    const complianceMetadata = this.collectComplianceMetadata(prototype, memberName, memberType);
                    const securityMetadata = this.collectSecurityMetadata(prototype, memberName, memberType);
                    this.throwIfBothCompliantAndSecure(memberName, complianceMetadata, securityMetadata);
                    this.addComplianceMetadataToSchema(propertySchema, complianceMetadata);
                    this.addSecurityMetadataToSchema(propertySchema, securityMetadata);
                }
                schemaProperties[memberName] = propertySchema;
            }
        }

        // Legacy decorators retain the minimal schema fallback for members with no
        // runtime type metadata. Standard decorators reject unresolved types above.
        if (Object.keys(schemaProperties).length === 0) {
            return this.createEmptySchema(target.name);
        }

        return {
            ...this.createEmptySchema(target.name),
            properties: schemaProperties,
            required: Object.keys(schemaProperties),
        };
    }

    private static mapRuntimeTypeToSchema(runtimeType: Function | undefined, declaringType?: Function, propertyName?: string, requireResolvedTypes = false): JsonSchema {
        const knownTypeFormat = this.getKnownTypeFormat(runtimeType);
        if (knownTypeFormat) {
            return knownTypeFormat;
        }

        if (runtimeType === String) {
            return { type: 'string' };
        }

        if (runtimeType === Number) {
            return { type: 'number' };
        }

        if (runtimeType === Boolean) {
            return { type: 'boolean' };
        }

        if (runtimeType === Array) {
            return this.mapArrayTypeToSchema(declaringType, propertyName, requireResolvedTypes);
        }

        if (!runtimeType) {
            return {};
        }

        // TypeScript erases ConceptAs<T>'s primitive type. Prefer an explicit field or
        // static hint; legacy emitDecoratorMetadata is the last available source.
        if (this.isConceptAs(runtimeType)) {
            const concept = runtimeType as Function & { valueType?: Function };
            const fieldType = Fields.getFieldsForType(concept as Constructor).find(field => field.name === 'value')?.type;
            const valueType = fieldType ?? concept.valueType ?? Reflect.getMetadata('design:type', runtimeType.prototype, 'value') as Function | undefined;
            if (!valueType && !requireResolvedTypes) return { type: 'string' }; // Legacy schema compatibility.
            if (valueType !== String && valueType !== Number && valueType !== Boolean) {
                throw new TypeError(`Cannot determine the primitive type of concept ${runtimeType.name}; declare static readonly valueType = String or Number.`);
            }
            return this.mapRuntimeTypeToSchema(valueType);
        }

        if (runtimeType !== Object) {
            return this.generate(runtimeType, undefined, requireResolvedTypes);
        }

        return { type: 'object' };
    }

    /**
     * Maps an array-typed member to a schema, resolving the element type from a
     * `@field(Array, { genericArguments: [ItemType] })` declaration when present.
     * @param declaringType - The class constructor that declares the array property.
     * @param propertyName - The array property name.
     * @returns The array schema, with the element's own compliance metadata carried onto `items` when the element is a PII concept.
     */
    private static mapArrayTypeToSchema(declaringType: Function | undefined, propertyName: string | undefined, requireResolvedTypes: boolean): JsonSchema {
        const elementType = this.getArrayElementType(declaringType, propertyName);

        // An array whose element is a ConceptAs<T> loses its classification the moment it is put in
        // a list unless the element concept's own compliance/security metadata is carried onto the
        // item schema - a value that would be encrypted as a scalar would otherwise be persisted in
        // the clear as a list element. Mirrors the C# generator's explicit enumerable-of-concept branch.
        if (elementType && this.isConceptAs(elementType)) {
            const itemSchema = this.mapRuntimeTypeToSchema(elementType, undefined, undefined, requireResolvedTypes);
            const complianceMetadata = ComplianceMetadataResolver.getMetadataForType(elementType);
            const securityMetadata = SecurityMetadataResolver.getMetadataForType(elementType);
            this.throwIfBothCompliantAndSecure(elementType.name, complianceMetadata, securityMetadata);
            this.addComplianceMetadataToSchema(itemSchema, complianceMetadata);
            this.addSecurityMetadataToSchema(itemSchema, securityMetadata);
            return { type: 'array', items: itemSchema };
        }

        return { type: 'array', items: { type: 'object' } };
    }

    /**
     * Resolves the element type of an array property from its `@field(Array, { genericArguments: [...] })`
     * declaration. TypeScript erases generic type arguments at runtime, so without an explicit
     * `@field` declaration the element type cannot be recovered.
     * @param declaringType - The class constructor that declares the array property.
     * @param propertyName - The array property name.
     * @returns The element type constructor, or undefined when it cannot be resolved.
     */
    private static getArrayElementType(declaringType: Function | undefined, propertyName: string | undefined): Function | undefined {
        if (!declaringType || !propertyName) {
            return undefined;
        }

        const field = Fields.getFieldsForType(declaringType as Constructor).find(candidate => candidate.name === propertyName);
        return field?.genericArguments?.[0];
    }

    /**
     * Checks whether a member is an array whose element type is a ConceptAs<T>.
     * @param declaringType - The class constructor that declares the property.
     * @param propertyName - The property name.
     * @param runtimeType - The member's reflected runtime type.
     * @returns True when the member is an array of concept elements; false otherwise.
     */
    private static isConceptArrayMember(declaringType: Function, propertyName: string, runtimeType: Function | undefined): boolean {
        if (runtimeType !== Array) {
            return false;
        }

        const elementType = this.getArrayElementType(declaringType, propertyName);
        return elementType !== undefined && this.isConceptAs(elementType);
    }

    private static isConceptAs(runtimeType: Function): boolean {
        return typeKeyOf(runtimeType as Constructor) === conceptAsTypeKey;
    }

    private static getKnownTypeFormat(runtimeType: Function | undefined): JsonSchema | undefined {
        if (!runtimeType) {
            return undefined;
        }

        const known = typeKeyOf(runtimeType as Constructor) === 'Guid'
            ? this._knownTypeFormats.get(Guid)
            : this._knownTypeFormats.get(runtimeType);
        if (!known) {
            return undefined;
        }

        return {
            type: known.type,
            format: this.normalizeFormat(known.format)
        };
    }

    private static normalizeFormat(format: string): string {
        const normalized = format.toLowerCase();
        return this._formatAliases.get(normalized) ?? normalized;
    }

    /**
     * Collects compliance metadata for a property from every source C# resolves PII from: the
     * property itself, its declaring class, and its own type (the concept case).
     * @param target - The class prototype the property is declared on.
     * @param propertyKey - The property name.
     * @param propertyType - The property's runtime type, when resolved.
     * @returns The collected compliance metadata, in property → declaring-class → type order.
     */
    private static collectComplianceMetadata(target: object, propertyKey: string, propertyType?: Function): ComplianceMetadata[] {
        const metadata: ComplianceMetadata[] = [];

        // Property-level compliance decorator.
        if (ComplianceMetadataResolver.hasMetadataFor(target, propertyKey)) {
            metadata.push(...ComplianceMetadataResolver.getMetadataFor(target, propertyKey));
        }

        // Declaring class-level compliance decorator - a class-level @pii() marks every one of
        // its own properties, the same way C#'s PIIMetadataProvider checks property.DeclaringType.
        const declaringClass = (target as { constructor?: Function }).constructor;
        if (declaringClass) {
            metadata.push(...ComplianceMetadataResolver.getMetadataForType(declaringClass));
        }

        // Type-level compliance decorator on the property's own type (e.g., @pii on a ConceptAs).
        if (propertyType) {
            metadata.push(...ComplianceMetadataResolver.getMetadataForType(propertyType));
        }

        return metadata;
    }

    /**
     * Adds compliance metadata to a schema node, descending into an object's properties so that
     * the metadata always lands on the leaves that actually hold a value.
     * @param schema - The schema node to add to.
     * @param metadata - The compliance metadata to add.
     * @remarks
     * A compliance marker can be declared on something that is not a single value: a `@pii()` on a
     * composite value-object type, or on a property whose type is such an object. Compliance is
     * applied per value, so leaving the marker on the container would make Chronicle hand the whole
     * JSON object to the value handler and store one opaque ciphertext string where the schema still
     * says "object". Releasing that gives back a string, not an object, and the read model then
     * fails to materialize. Pushing the metadata down to every leaf keeps encryption symmetric with
     * the release walk, keeps each value independently encrypted, and preserves the document shape.
     *
     * An array-typed node is deliberately left as a container: coarse compliance on a whole
     * collection is an established, separately handled behavior (the collection is blob-encrypted
     * and its shape restored on release).
     */
    private static addComplianceMetadataToSchema(schema: JsonSchema, metadata: ComplianceMetadata[]): void {
        if (metadata.length === 0) {
            return;
        }

        if (schema.properties && Object.keys(schema.properties).length > 0) {
            for (const propertySchema of Object.values(schema.properties)) {
                this.addComplianceMetadataToSchema(propertySchema, metadata);
            }
            return;
        }

        const compliance = schema.compliance ?? [];
        for (const item of metadata) {
            const metadataType = item.metadataType.value.toString();
            if (!this.hasComplianceMetadataOfType(compliance, metadataType)) {
                compliance.push({ metadataType, details: item.details });
            }
        }

        if (compliance.length > 0) {
            schema.compliance = compliance;
        }
    }

    /**
     * Checks whether a compliance array already carries metadata of a given type.
     * @param compliance - The compliance array to check.
     * @param metadataType - The metadata type to look for.
     * @returns True when the metadata type is already present, false if not.
     * @remarks
     * A leaf can be reached by more than one marker — for example a `@pii()` concept inside a value
     * object whose type is itself marked `@pii()`. Recording the same metadata type twice adds
     * nothing and makes the generated schema noisier to read and to diff.
     */
    private static hasComplianceMetadataOfType(compliance: ComplianceSchemaMetadata[], metadataType: string): boolean {
        return compliance.some(item => item.metadataType === metadataType);
    }

    /**
     * Collects security metadata for a property from every source compliance metadata is resolved
     * from: the property itself, its declaring class, and its own type (the concept case). This is
     * the security counterpart to {@link collectComplianceMetadata} - a deliberately separate walk
     * rather than a shared one, over a completely separate `@encrypted()` decorator vocabulary.
     * @param target - The class prototype the property is declared on.
     * @param propertyKey - The property name.
     * @param propertyType - The property's runtime type, when resolved.
     * @returns The collected security metadata, in property → declaring-class → type order.
     */
    private static collectSecurityMetadata(target: object, propertyKey: string, propertyType?: Function): SecurityMetadata[] {
        const metadata: SecurityMetadata[] = [];

        // Property-level security decorator.
        if (SecurityMetadataResolver.hasMetadataFor(target, propertyKey)) {
            metadata.push(...SecurityMetadataResolver.getMetadataFor(target, propertyKey));
        }

        // Declaring class-level security decorator - a class-level @encrypted() marks every one of
        // its own properties, the same way a class-level @pii() does for compliance.
        const declaringClass = (target as { constructor?: Function }).constructor;
        if (declaringClass) {
            metadata.push(...SecurityMetadataResolver.getMetadataForType(declaringClass));
        }

        // Type-level security decorator on the property's own type (e.g., @encrypted on a ConceptAs).
        if (propertyType) {
            metadata.push(...SecurityMetadataResolver.getMetadataForType(propertyType));
        }

        return metadata;
    }

    /**
     * Adds security metadata to a schema node, descending into an object's properties so that the
     * metadata always lands on the leaves that actually hold a value. This is the security
     * counterpart to {@link addComplianceMetadataToSchema} - see its remarks for why metadata is
     * pushed to leaves and why an array is left as a container.
     * @param schema - The schema node to add to.
     * @param metadata - The security metadata to add.
     */
    private static addSecurityMetadataToSchema(schema: JsonSchema, metadata: SecurityMetadata[]): void {
        if (metadata.length === 0) {
            return;
        }

        if (schema.properties && Object.keys(schema.properties).length > 0) {
            for (const propertySchema of Object.values(schema.properties)) {
                this.addSecurityMetadataToSchema(propertySchema, metadata);
            }
            return;
        }

        const security = schema.security ?? [];
        for (const item of metadata) {
            const metadataType = item.metadataType.value.toString();
            if (!this.hasSecurityMetadataOfType(security, metadataType)) {
                security.push({ metadataType, details: item.details });
            }
        }

        if (security.length > 0) {
            schema.security = security;
        }
    }

    /**
     * Checks whether a security array already carries metadata of a given type.
     * @param security - The security array to check.
     * @param metadataType - The metadata type to look for.
     * @returns True when the metadata type is already present, false if not.
     */
    private static hasSecurityMetadataOfType(security: SecuritySchemaMetadata[], metadataType: string): boolean {
        return security.some(item => item.metadataType === metadataType);
    }

    /**
     * Rejects a property or type that resolved both compliance and security metadata.
     * @param name - The property or type name, used in the thrown error.
     * @param complianceMetadata - The compliance metadata collected for the property/type.
     * @param securityMetadata - The security metadata collected for the property/type.
     * @remarks
     * This is not merely redundant - it corrupts the value. The kernel applies every matching
     * handler for a property in sequence, so a value marked both ways is encrypted first under the
     * PII key and then again under the Encrypted key; releasing it decrypts with the wrong key
     * against ciphertext, which fails loudly rather than returning a wrong value. Checked here, at
     * schema-generation time, the same point C#'s `EncryptedMetadataProvider.ThrowIfAlsoPII` checks
     * it - this client has no compile-time analyzer, so this runtime check is the only backstop.
     */
    private static throwIfBothCompliantAndSecure(name: string, complianceMetadata: ComplianceMetadata[], securityMetadata: SecurityMetadata[]): void {
        if (complianceMetadata.length > 0 && securityMetadata.length > 0) {
            throw new PIIAndEncryptedCombinedNotSupported(name);
        }
    }
}
