// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, Constructor, Fields, Guid } from '@cratis/fundamentals';
import { ComplianceSchemaMetadata, JsonSchema } from './JsonSchema';
import { TypeIntrospector } from '../types';
import { ComplianceMetadata } from '../compliance/ComplianceMetadata';
import { ComplianceMetadataResolver } from '../compliance/ComplianceMetadataResolver';

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
     * @returns The generated JSON schema.
     */
    static generate(target: Function, members?: ReadonlyMap<string, Function | undefined>): JsonSchema {
        const membersToUse = members ?? TypeIntrospector.getMembers(target);
        const schemaProperties: Record<string, JsonSchema> = {};
        const prototype = target.prototype;

        for (const [memberName, memberType] of membersToUse.entries()) {
            const propertySchema = this.mapRuntimeTypeToSchema(memberType, target, memberName);
            // Only include properties whose type was resolved. An empty schema ({}) means
            // the runtime type was unavailable (e.g. esbuild/tsx omits design:paramtypes).
            if (Object.keys(propertySchema).length > 0) {
                // An array of concept elements resolves and applies its own item-level compliance
                // inside mapRuntimeTypeToSchema - the general property/type/declaring-class walk
                // below is skipped for it, mirroring the C# generator's enumerable-of-concept branch.
                if (!this.isConceptArrayMember(target, memberName, memberType)) {
                    const metadata = this.collectComplianceMetadata(prototype, memberName, memberType);
                    this.addComplianceMetadataToSchema(propertySchema, metadata);
                }
                schemaProperties[memberName] = propertySchema;
            }
        }

        // When no property types could be resolved, return a minimal schema with empty
        // properties so the server uses its fallback path that preserves all event
        // content as-is via ConvertUnknownSchemaTypeToClrType.
        if (Object.keys(schemaProperties).length === 0) {
            return this.createEmptySchema(target.name);
        }

        return {
            ...this.createEmptySchema(target.name),
            properties: schemaProperties,
            required: Object.keys(schemaProperties),
        };
    }

    private static mapRuntimeTypeToSchema(runtimeType: Function | undefined, declaringType?: Function, propertyName?: string): JsonSchema {
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
            return this.mapArrayTypeToSchema(declaringType, propertyName);
        }

        if (!runtimeType) {
            return {};
        }

        // A ConceptAs<T> serializes as its underlying primitive value, so the schema must
        // describe that primitive rather than the wrapper object. The generic argument T is
        // not available at runtime, so resolve it from the 'value' property's design:type
        // when present (ts-node/webpack with emitDecoratorMetadata) and fall back to string
        // when it is not (esbuild/tsx) — string-backed concepts are by far the common case.
        if (this.isConceptAs(runtimeType)) {
            const valueType = Reflect.getMetadata('design:type', runtimeType.prototype, 'value') as Function | undefined;
            return this.mapRuntimeTypeToSchema(valueType ?? String);
        }

        if (runtimeType !== Object) {
            return this.generate(runtimeType);
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
    private static mapArrayTypeToSchema(declaringType: Function | undefined, propertyName: string | undefined): JsonSchema {
        const elementType = this.getArrayElementType(declaringType, propertyName);

        // An array whose element is a ConceptAs<T> loses its classification the moment it is put in
        // a list unless the element concept's own compliance metadata is carried onto the item schema -
        // a value that would be encrypted as a scalar would otherwise be persisted in the clear as a
        // list element. Mirrors the C# generator's explicit enumerable-of-concept branch.
        if (elementType && this.isConceptAs(elementType)) {
            const itemSchema = this.mapRuntimeTypeToSchema(elementType);
            const metadata = ComplianceMetadataResolver.getMetadataForType(elementType);
            this.addComplianceMetadataToSchema(itemSchema, metadata);
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
        let current: Function | null = runtimeType;
        while (current && current !== Function.prototype) {
            if (current === ConceptAs) {
                return true;
            }

            current = Object.getPrototypeOf(current) as Function | null;
        }

        return false;
    }

    private static getKnownTypeFormat(runtimeType: Function | undefined): JsonSchema | undefined {
        if (!runtimeType) {
            return undefined;
        }

        const known = this._knownTypeFormats.get(runtimeType);
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
}
