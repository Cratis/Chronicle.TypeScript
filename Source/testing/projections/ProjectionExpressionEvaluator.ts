// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../../events/EventContext.js';
import { Identity } from '../../identity/Identity.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';

/** Evaluates validated wire expressions, without executing JavaScript supplied by a definition. */
export class ProjectionExpressionEvaluator {
    static value(expression: string, content: unknown, context: EventContext, target: JsonSchema): unknown {
        if (expression === '$null') return null;
        if (expression === '$eventSourceId') return ProjectionValueConverter.convert(context.eventSourceId, target);
        if (expression.startsWith('$value(') && expression.endsWith(')')) {
            return ProjectionValueConverter.convert(expression.slice(7, -1), target);
        }
        if (expression.startsWith('$eventContext(') && expression.endsWith(')')) {
            return ProjectionValueConverter.convert(this.contextValue(expression.slice(14, -1), context), target);
        }
        return ProjectionValueConverter.convert(this.pathValue(content, expression), target);
    }

    static pathValue(value: unknown, path: string): unknown {
        return path.split('.').reduce<unknown>((current, segment) => {
            if (current === null || typeof current !== 'object') return null;
            return (current as Record<string, unknown>)[segment] ?? null;
        }, value);
    }

    private static contextValue(path: string, context: EventContext): unknown {
        const [root, ...members] = path.split('.');
        const roots: Record<string, unknown> = {
            SequenceNumber: context.sequenceNumber.toString(), EventSourceId: context.eventSourceId,
            EventStore: context.eventStore, Namespace: context.namespace, EventSourceType: context.eventSourceType,
            EventStreamType: context.eventStreamType, EventStreamId: context.eventStreamId,
            Subject: context.subject ?? context.eventSourceId, Hash: context.hash ?? '', CausedBy: context.causedBy ?? Identity.notSet,
            ObservationState: context.observationState, EventType: context.eventType,
            Occurred: context.occurred, CorrelationId: context.correlationId,
            Causation: context.causation, Tags: context.tags
        };
        let value: unknown = roots[root];
        for (const member of members) {
            if (value instanceof Date) {
                if (member === 'Year') { value = value.getUTCFullYear(); continue; }
                if (member === 'Month') { value = value.getUTCMonth() + 1; continue; }
                if (member === 'Day') { value = value.getUTCDate(); continue; }
            }
            if (member === 'Value' && (typeof value !== 'object' || value === null)) continue;
            if (value === null || typeof value !== 'object') return null;
            const object = value as Record<string, unknown>;
            value = object[member[0].toLowerCase() + member.slice(1)] ?? object[member] ?? null;
        }
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'bigint') return value.toString();
        return value ?? null;
    }
}
