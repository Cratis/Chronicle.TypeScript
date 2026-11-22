// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../../events/EventContext.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ChildrenValidationContext } from './ProjectionChildrenCapabilities.js';
import { ProjectionExpressionEvaluator } from './ProjectionExpressionEvaluator.js';

/** The context key intersection measured by the three context-child-keys fixtures. */
export class ProjectionContextChildKeyCapabilities {
    static matches(expression: string): boolean {
        return expression === '$eventContext(EventSourceId)';
    }

    static value(expression: string, content: unknown, context: EventContext): unknown {
        return this.matches(expression) ? context.eventSourceId : ProjectionExpressionEvaluator.pathValue(content, expression);
    }

    static validate(children: Record<string, ChildrenDefinitionLike>, context: ChildrenValidationContext): void {
        for (const [property, child] of Object.entries(children)) {
            const entries = [...(child.From ?? []), ...(child.RemovedWith ?? [])];
            if (!entries.some(entry => this.matches(entry.Value.Key))) continue;
            const path = `Children.${property}`;
            const reject = (detail: string): never => context.reject(path,
                `event-context child keys ${detail}; require a kernel-backed test (ChronicleKernelScenario / live kernel)`, context.declarationFor(path));
            if (Object.keys(children).length !== 1) reject('with multiple collections');
            if (entries.some(entry => !this.matches(entry.Value.Key))) reject('mixed with event-content or other keys');
            const items = context.schema.properties?.[property]?.items;
            if (!items?.properties || !Object.values(items.properties).every(schema => this.plainString(schema))) reject('without typed plain-string child properties');
            const roots = Object.entries(context.schema.properties ?? {}).filter(([name]) => name !== property);
            if (!roots.every(([, schema]) => this.plainString(schema))) reject('combined with non-string root properties');
            this.root(context, entries.map(entry => entry.Key.Id), reject);
        }
    }

    private static root(context: ChildrenValidationContext, childEvents: string[], reject: (detail: string) => never): void {
        if (context.from.some(entry => childEvents.includes(entry.Key.Id))) reject('sharing a child event with a root subscription');
        const expressions = context.from.flatMap(entry => Object.values(entry.Value.Properties ?? {}));
        if (expressions.some(expression => !/^(?!(?:true|True|false|False)$)[A-Za-z_]\w*$/.test(expression))) reject('combined with non-content root mappings');
    }

    private static plainString(schema: JsonSchema): boolean {
        return schema.type === 'string' && !schema.format;
    }
}
