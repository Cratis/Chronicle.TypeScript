// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { AutoMap } from '@cratis/chronicle.contracts';
import { Constructor, Fields } from '@cratis/fundamentals';
import { TypeIntrospector } from '../../types';
import { getEventTypeFor } from '../../events/eventTypeDecorator';
import { getAddFromMetadata } from './addFrom';
import { ChildrenFromMetadata, getChildrenFromMetadata } from './childrenFrom';
import { getClearWithClassMetadata, getClearWithPropertyMetadata } from './clearWith';
import { getCountMetadata } from './count';
import { getDecrementMetadata } from './decrement';
import { getFromEventMetadata } from './fromEvent';
import { getIncrementMetadata } from './increment';
import { isNested } from './nested';
import { getRemovedWithClassMetadata, getRemovedWithPropertyMetadata } from './removedWith';
import { getRemovedWithJoinClassMetadata, getRemovedWithJoinPropertyMetadata } from './removedWithJoin';
import { getSetFromMetadata } from './setFrom';
import { getSetFromContextMetadata } from './setFromContext';
import { getSetValueMetadata } from './setValue';
import { getSubtractFromMetadata } from './subtractFrom';

/** The contract-level event type identifier shape used across projection definitions. */
export type ContractEventType = { Id: string; Generation: number; Tombstone: boolean };

/** Accumulated property mapping for a from clause. */
export interface FromRecord {
    Key: ContractEventType;
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

/** Plain object shape matching the wire-level `ChildrenDefinition`. */
export interface ChildrenDefinitionLike {
    IdentifiedBy: string;
    From: FromRecord[];
    Join: unknown[];
    Children: Record<string, ChildrenDefinitionLike>;
    All: { Properties: Record<string, string>; IncludeChildren: boolean; AutoMap: AutoMap };
    RemovedWith: Array<{ Key: ContractEventType; Value: { Key: string; ParentKey: string } }>;
    RemovedWithJoin: Array<{ Key: ContractEventType; Value: { Key: string } }>;
    AutoMap: AutoMap;
    Nested: Record<string, ChildrenDefinitionLike>;
}

/**
 * Resolves the contract event type for a decorated event constructor.
 * @param eventTypeConstructor - The event class constructor.
 * @returns The contract-level event type identifier.
 */
export function toContractEventType(eventTypeConstructor: Function): ContractEventType {
    const eventType = getEventTypeFor(eventTypeConstructor);
    if (eventType.id.value === '') {
        throw new Error(`Event type '${eventTypeConstructor.name}' is not decorated with @eventType().`);
    }
    return {
        Id: eventType.id.value,
        Generation: eventType.generation.value,
        Tombstone: false
    };
}

/**
 * Builds a stable map key for a contract event type.
 * @param eventType - The contract event type.
 * @returns A string key unique to the event type/generation/tombstone combination.
 */
export function getEventTypeMapKey(eventType: ContractEventType): string {
    return `${eventType.Id}:${eventType.Generation}:${eventType.Tombstone ? '1' : '0'}`;
}

/**
 * Gets or creates the `From` entry for an event type within the given map.
 * @param fromByEventType - The map of event type key to accumulated from entry.
 * @param eventTypeConstructor - The event constructor to resolve the entry for.
 * @returns The existing or newly created from entry.
 */
export function ensureFromEntry(fromByEventType: Map<string, FromRecord>, eventTypeConstructor: Function): FromRecord {
    const eventType = toContractEventType(eventTypeConstructor);
    const key = getEventTypeMapKey(eventType);
    const existing = fromByEventType.get(key);
    if (existing) {
        return existing;
    }

    const created: FromRecord = { Key: eventType, Value: { Properties: {}, Key: '$eventSourceId', ParentKey: '' } };
    fromByEventType.set(key, created);
    return created;
}

/**
 * Applies the property-mapping decorators (`@setFrom`, `@setFromContext`, `@setValue`,
 * `@addFrom`, `@subtractFrom`, `@increment`, `@decrement`, `@count`) declared on a single
 * property into the given from-by-event-type map. Shared by the root model-bound processing
 * loop and by child/nested type processing below, so both honor the same decorators.
 * @param prototype - The class prototype the property is declared on.
 * @param property - The property name.
 * @param fromByEventType - The map of event type key to accumulated from entry to populate.
 */
export function applyPropertyMappings(prototype: object, property: string, fromByEventType: Map<string, FromRecord>): void {
    for (const mapping of getSetFromMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = mapping.eventPropertyName ?? property;
    }

    for (const mapping of getSetFromContextMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = mapping.contextPropertyName ?? property;
    }

    for (const mapping of getSetValueMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = JSON.stringify(mapping.value);
    }

    for (const mapping of getAddFromMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = `$add(${mapping.eventPropertyName ?? property})`;
    }

    for (const mapping of getSubtractFromMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = `$subtract(${mapping.eventPropertyName ?? property})`;
    }

    for (const mapping of getIncrementMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = '$increment';
        if (mapping.constantKey) {
            entry.Value.Key = `$value(${mapping.constantKey})`;
        }
    }

    for (const mapping of getDecrementMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = '$decrement';
        if (mapping.constantKey) {
            entry.Value.Key = `$value(${mapping.constantKey})`;
        }
    }

    for (const mapping of getCountMetadata(prototype, property)) {
        const entry = ensureFromEntry(fromByEventType, mapping.eventType);
        entry.Value.Properties[property] = '$count';
        if (mapping.constantKey) {
            entry.Value.Key = `$value(${mapping.constantKey})`;
        }
    }
}

function createEmptyChildrenDefinition(): ChildrenDefinitionLike {
    return {
        IdentifiedBy: '$eventSourceId',
        From: [],
        Join: [],
        Children: {},
        All: { Properties: {}, IncludeChildren: false, AutoMap: AutoMap.Inherit },
        RemovedWith: [],
        RemovedWithJoin: [],
        AutoMap: AutoMap.Enabled,
        Nested: {}
    };
}

/**
 * Resolves the element type of a `@childrenFrom` collection property. TypeScript erases
 * generic type arguments at runtime, so the element type can only be recovered when the
 * property was declared with `@field(Array, { genericArguments: [ItemType] })` - without it,
 * the children definition still registers correctly (structural Key/ParentKey wiring plus
 * AutoMap), it just cannot also translate the child type's own decorators.
 * @param type - The declaring class constructor.
 * @param property - The property name.
 * @returns The child element type constructor, or undefined when it cannot be resolved.
 */
function resolveChildElementType(type: Function, property: string): Function | undefined {
    const field = Fields.getFieldsForType(type as Constructor).find(candidate => candidate.name === property);
    return field?.genericArguments?.[0];
}

/**
 * Resolves the type of a `@nested` single-object property, preferring an explicit
 * `@field(NestedType)` declaration and falling back to `design:type` decorator metadata
 * (only available when compiled with `tsc`, not esbuild/tsx).
 * @param type - The declaring class constructor.
 * @param property - The property name.
 * @returns The nested type constructor, or undefined when it cannot be resolved.
 */
function resolveNestedType(type: Function, property: string): Function | undefined {
    const field = Fields.getFieldsForType(type as Constructor).find(candidate => candidate.name === property);
    if (field?.type && field.type !== Object && field.type !== Array) {
        return field.type;
    }

    const designType = Reflect.getMetadata('design:type', type.prototype, property) as Function | undefined;
    if (designType && designType !== Object) {
        return designType;
    }

    return undefined;
}

/**
 * Discovers the child model property used to identify instances, by convention: a property
 * named `id` (case-insensitive), matching the C# client's fallback once no `[Key]` attribute
 * is present (TypeScript has no `[Key]` decorator equivalent).
 * @param childType - The child/nested model type, when resolvable.
 * @returns The discovered property name, or undefined when no convention match is found.
 */
function discoverIdentifiedBy(childType: Function | undefined): string | undefined {
    if (!childType) {
        return undefined;
    }

    for (const name of TypeIntrospector.getMembers(childType).keys()) {
        if (name.toLowerCase() === 'id') {
            return name;
        }
    }

    return undefined;
}

/**
 * Populates a children/nested definition from a resolved child/nested type's own class-level
 * and property-level decorators (`@fromEvent`, `@clearWith`, `@removedWith`,
 * `@removedWithJoin`, and the property-mapping decorators), recursing into any further
 * `@childrenFrom`/`@nested` properties the child/nested type itself declares.
 * @param definition - The children definition being populated.
 * @param childType - The resolved child/nested type, when available.
 */
function populateFromType(definition: ChildrenDefinitionLike, childType: Function | undefined): void {
    if (!childType) {
        return;
    }

    const fromByEventType = new Map<string, FromRecord>();
    for (const entry of definition.From) {
        fromByEventType.set(getEventTypeMapKey(entry.Key), entry);
    }

    for (const fromEvent of getFromEventMetadata(childType)) {
        ensureFromEntry(fromByEventType, fromEvent.eventType);
    }

    const removedWithByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string; ParentKey: string } }>();
    for (const entry of definition.RemovedWith) {
        removedWithByEventType.set(getEventTypeMapKey(entry.Key), entry);
    }

    for (const clearWith of getClearWithClassMetadata(childType)) {
        const eventType = toContractEventType(clearWith.eventType);
        removedWithByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: '$eventSourceId', ParentKey: '' } });
    }

    for (const removed of getRemovedWithClassMetadata(childType)) {
        const eventType = toContractEventType(removed.eventType);
        removedWithByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' } });
    }

    const removedWithJoinByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string } }>();
    for (const entry of definition.RemovedWithJoin) {
        removedWithJoinByEventType.set(getEventTypeMapKey(entry.Key), entry);
    }

    for (const removed of getRemovedWithJoinClassMetadata(childType)) {
        const eventType = toContractEventType(removed.eventType);
        removedWithJoinByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: removed.key ?? '$eventSourceId' } });
    }

    const prototype = childType.prototype;
    for (const property of TypeIntrospector.getTrackedProperties(childType)) {
        applyPropertyMappings(prototype, property, fromByEventType);

        for (const clearWith of getClearWithPropertyMetadata(prototype, property)) {
            const eventType = toContractEventType(clearWith.eventType);
            removedWithByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: '$eventSourceId', ParentKey: '' } });
        }

        for (const removed of getRemovedWithPropertyMetadata(prototype, property)) {
            const eventType = toContractEventType(removed.eventType);
            removedWithByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: removed.key ?? '$eventSourceId', ParentKey: removed.parentKey ?? '' } });
        }

        for (const removed of getRemovedWithJoinPropertyMetadata(prototype, property)) {
            const eventType = toContractEventType(removed.eventType);
            removedWithJoinByEventType.set(getEventTypeMapKey(eventType), { Key: eventType, Value: { Key: removed.key ?? '$eventSourceId' } });
        }

        const childrenFromList = getChildrenFromMetadata(prototype, property);
        if (childrenFromList.length > 0) {
            definition.Children[property] = buildChildrenEntry(childType, property, childrenFromList);
        }

        if (isNested(prototype, property)) {
            definition.Nested[property] = buildNestedEntry(childType, property);
        }
    }

    definition.From = Array.from(fromByEventType.values());
    definition.RemovedWith = Array.from(removedWithByEventType.values());
    definition.RemovedWithJoin = Array.from(removedWithJoinByEventType.values());
}

/**
 * Builds the `ChildrenDefinition` for a `@childrenFrom` collection property.
 * @param type - The class declaring the property.
 * @param property - The property name.
 * @param metadataList - The `@childrenFrom` metadata entries declared on the property (one per creating event type).
 * @returns The wire-shaped children definition.
 */
export function buildChildrenEntry(type: Function, property: string, metadataList: ChildrenFromMetadata[]): ChildrenDefinitionLike {
    const childType = resolveChildElementType(type, property);
    const definition = createEmptyChildrenDefinition();

    const explicitIdentifiedBy = metadataList.find(metadata => metadata.identifiedBy)?.identifiedBy;
    definition.IdentifiedBy = explicitIdentifiedBy ?? discoverIdentifiedBy(childType) ?? '$eventSourceId';

    for (const metadata of metadataList) {
        const eventType = toContractEventType(metadata.eventType);
        definition.From.push({
            Key: eventType,
            Value: {
                Key: metadata.key ?? '$eventSourceId',
                ParentKey: metadata.parentKey ?? '$eventSourceId',
                Properties: {}
            }
        });
    }

    populateFromType(definition, childType);
    return definition;
}

/**
 * Builds the `ChildrenDefinition` for a `@nested` single-object property.
 * @param type - The class declaring the property.
 * @param property - The property name.
 * @returns The wire-shaped nested definition.
 */
export function buildNestedEntry(type: Function, property: string): ChildrenDefinitionLike {
    const nestedType = resolveNestedType(type, property);
    const definition = createEmptyChildrenDefinition();
    definition.IdentifiedBy = '';

    // A @clearWith on the property carrying @nested clears this nested object, the same as a
    // class-level @clearWith on the nested type itself (which populateFromType also honors).
    for (const clearWith of getClearWithPropertyMetadata(type.prototype, property)) {
        const eventType = toContractEventType(clearWith.eventType);
        definition.RemovedWith.push({ Key: eventType, Value: { Key: '$eventSourceId', ParentKey: '' } });
    }

    populateFromType(definition, nestedType);
    return definition;
}
