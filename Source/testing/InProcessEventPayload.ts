// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { conceptAsTypeKey, JsonSerializer, typeKeyOf, type Constructor } from '@cratis/fundamentals';
import type { AppendedEvent } from '../events/AppendedEvent.js';
import { EventType } from '../events/EventType.js';
import { EventTypeId } from '../events/EventTypeId.js';
import { EventTypeGeneration } from '../events/EventTypeGeneration.js';
import { Tag } from '../events/Tag.js';
import { Identity } from '../identity/Identity.js';
import type { JsonSchema } from '../schemas/JsonSchema.js';
import { matchesEventField } from './EventFieldSchema.js';
import type { InProcessConstraints } from './InProcessConstraints.js';
import type { InProcessEventSequenceEnvironment } from './InProcessEventSequenceEnvironment.js';

/** Schema-bound payload validation, canonical hashing, and isolated history snapshots. */
export class InProcessEventPayload {
    constructor(private readonly environment: InProcessEventSequenceEnvironment, private readonly constraints?: InProcessConstraints) {}

    checkedContent(event: object, serialized: string, operation: string,
        mismatchReason = 'Content differs from the event schema.'): Record<string, unknown> {
        const content = this.parse(serialized, event, operation);
        const metadata = this.environment.catalog.get(event.constructor)!;
        const properties = metadata.schema.properties!;
        if (!this.objectWithProperties(content, properties) || !this.matchesProperties(event, content, properties)) {
            throw this.environment.unsupported(operation, event.constructor.name, mismatchReason);
        }
        return content;
    }

    hash(typeId: string, source: string, content: Record<string, unknown>): string {
        const canonical = Object.fromEntries(Object.entries(content).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
        return createHash('sha256').update(`${typeId}|${source}|${JSON.stringify(canonical)}`).digest('base64');
    }

    snapshot(event: AppendedEvent): AppendedEvent {
        const eventType = new EventType(new EventTypeId(event.eventType.id.value),
            new EventTypeGeneration(event.eventType.generation.value), event.eventType.tombstone);
        const causedBy = event.context.causedBy;
        return {
            eventType,
            content: JSON.parse(JSON.stringify(event.content)) as Record<string, unknown>,
            context: { ...event.context, eventType, occurred: new Date(event.context.occurred),
                causedBy: causedBy && new Identity(causedBy.subject, causedBy.name, causedBy.userName, causedBy.onBehalfOf),
                causation: event.context.causation.map(item => ({ ...item, occurred: item.occurred && new Date(item.occurred), properties: { ...item.properties } })),
                tags: event.context.tags.map(item => new Tag(item.value)),
                namedTags: [...(event.context.namedTags ?? [])] }
        };
    }

    private parse(serialized: string, event: object, operation: string): Record<string, unknown> {
        try { return JSON.parse(serialized) as Record<string, unknown>; }
        catch { throw this.environment.unsupported(operation, event.constructor.name, 'Content must be valid JSON.'); }
    }

    private objectWithProperties(content: Record<string, unknown>, properties: Record<string, JsonSchema>): boolean {
        if (!this.isObject(content)) return false;
        return Object.keys(content).length === Object.keys(properties).length;
    }

    private isObject(content: unknown): boolean {
        return !!content && typeof content === 'object' && !Array.isArray(content);
    }

    private matchesProperties(event: object, content: Record<string, unknown>, properties: Record<string, JsonSchema>): boolean {
        return Object.entries(properties).every(property => this.matchesSchema(event, content, property));
    }

    private matchesSchema(event: object, content: Record<string, unknown>, [key, property]: [string, JsonSchema]): boolean {
        return this.matchesProperty(content, key, property) && this.matchesConstraint(event, content, key) && this.matchesText(content[key], property);
    }

    private matchesProperty(content: Record<string, unknown>, key: string, property: JsonSchema): boolean {
        return Object.hasOwn(content, key) && matchesEventField(content[key], property);
    }

    private matchesText(value: unknown, property: JsonSchema): boolean {
        if (property.type !== 'string' || property.format !== undefined) return true;
        return /^[\x20-\x21\x23-\x5b\x5d-\x7e\u00e9]*$/.test(value as string);
    }

    private matchesConstraint(event: object, content: Record<string, unknown>, key: string): boolean {
        const metadata = this.environment.catalog.get(event.constructor)!;
        if (!this.constraints?.isConstrainedProperty(metadata.eventType.id.value, key)) return true;
        return this.matchesConstrainedValue(Reflect.get(event, key), content[key]);
    }

    private matchesConstrainedValue(value: unknown, content: unknown): boolean {
        // Use production serialization for concepts, not their wrapper object's runtime type.
        // Keep rejecting other unproven conversions, such as a Date assigned to a string field.
        if (this.serializedConcept(value)) return JsonSerializer.serialize(value) === JSON.stringify(content);
        return value === content;
    }

    private serializedConcept(value: unknown): boolean {
        if (!value || typeof value !== 'object') return false;
        return [conceptAsTypeKey, 'Guid'].includes(typeKeyOf(value.constructor as Constructor) ?? '');
    }
}
