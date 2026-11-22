// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';

/** The flat, plain-string root routing intersection measured by the routed-root fixtures. */
export class ProjectionRootKeyCapabilities {
    static supports(wire: Record<string, unknown>, schema: JsonSchema, eventSchema: JsonSchema, expression: string): boolean {
        const definition = wire as unknown as ProjectionDefinition;
        if (!/^(?!(?:true|True|false|False)$)[A-Za-z_]\w*$/.test(expression)) return false;
        if (!this.plainString(eventSchema.properties?.[expression])) return false;
        if (!Object.values(schema.properties ?? {}).every(property => this.plainString(property))) return false;
        if (!Object.values(eventSchema.properties ?? {}).every(property => this.plainString(property))) return false;
        return this.flat(definition) && this.mapping(definition);
    }

    /** Validate raw keys before deserialization or replay; never coerce or fall back to the source id. */
    static key(definition: ProjectionDefinition, event: ScenarioEvent, reject: ProjectionCapabilityReject): string {
        const type = event.context.eventType;
        const from = definition.From?.find(entry => entry.Key?.Id === type.id.value);
        const expression = from?.Value?.Key;
        if (!expression || expression === '$eventSourceId') return event.sourceId;
        const value = this.rawKey(event.content, expression);
        if (typeof value !== 'string' || !value.length) {
            reject(`From[${type.id.value}:${type.generation.value}].Key`,
                `routed root key '${expression}' must be a present, nonempty plain string; requires a kernel-backed test (ChronicleKernelScenario / live kernel)`);
        }
        return value as string;
    }

    private static rawKey(content: unknown, expression: string): unknown {
        return content !== null && typeof content === 'object' && Object.hasOwn(content, expression)
            ? (content as Record<string, unknown>)[expression] : undefined;
    }

    private static flat(definition: ProjectionDefinition): boolean {
        const all = definition.All;
        if (!all) return false;
        const subscriptions = [definition.RemovedWith, definition.Join, definition.RemovedWithJoin, definition.FromEvery];
        const nested = [definition.Children, definition.Nested, all.Properties];
        return definition.From.length === 1 && subscriptions.every(entries => !entries.length)
            && nested.every(properties => !Object.keys(properties).length) && !all.IncludeChildren
            && all.AutoMap === AutoMap.Inherit && !definition.SubscribesToAllEvents
            && definition.InitialModelState.trim() === '{}';
    }

    private static mapping(definition: ProjectionDefinition): boolean {
        const from = definition.From[0]?.Value;
        return !!from && !from.ParentKey && definition.AutoMap === AutoMap.Enabled
            && !(definition.NoAutoMapProperties ?? []).length
            && Object.values(from.Properties).every(expression => /^(?!(?:true|True|false|False)$)[A-Za-z_]\w*$/.test(expression));
    }

    private static plainString(schema: JsonSchema | undefined): boolean {
        return schema?.type === 'string' && !schema.format;
    }
}
