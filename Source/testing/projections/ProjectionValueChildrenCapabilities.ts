// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ContractEventType } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ChildrenValidationContext } from './ProjectionChildrenCapabilities.js';

/** The fluent scalar addChild contract proven by value-children-fluent.json. */
export interface ValueChildrenDefinition {
    readonly Event: ContractEventType;
    readonly PropertyExpression: string;
}

/** Admits only the compiler-emitted, direct plain-string value-child shape. */
export class ProjectionValueChildrenCapabilities {
    static definition(child: ChildrenDefinitionLike): ValueChildrenDefinition | undefined {
        return (child as unknown as { FromEventProperty?: ValueChildrenDefinition }).FromEventProperty;
    }

    static validate(property: string, child: ChildrenDefinitionLike, context: ChildrenValidationContext, owners: Map<string, string>): void {
        const path = `Children.${property}.FromEventProperty`;
        const reject = (detail: string): never => context.reject(path,
            `value children from an event property ${detail}; require a kernel-backed test (ChronicleKernelScenario / live kernel)`,
            context.declarationFor(`Children.${property}`));
        const value = this.definition(child)!;
        this.contract(value, reject);
        if (child.From.length || child.RemovedWith.length) reject('combined with ordinary child From or removal operations');
        if (child.IdentifiedBy !== '$eventSourceId') reject('with a custom child identifier');
        const schema = this.schemas(property, value, context, reject);
        this.root(value, schema, context, reject);
        if (owners.has(value.Event.Id)) reject('subscribed by more than one children operation');
        owners.set(value.Event.Id, path);
    }

    private static schemas(property: string, value: ValueChildrenDefinition, context: ChildrenValidationContext, reject: (detail: string) => never): JsonSchema {
        const collection = context.schema.properties?.[property];
        if (collection?.type !== 'array' || !this.plainString(collection.items)) reject('must target a plain-string array');
        const schema = context.requireEventSchema(value.Event, `Children.${property}.FromEventProperty`);
        const expression = value.PropertyExpression;
        if (!/^[A-Za-z_]\w*$/.test(expression) || !this.plainString(schema.properties?.[expression])) reject('must read one direct plain-string event property');
        return schema;
    }

    private static contract(value: ValueChildrenDefinition, reject: (detail: string) => never): void {
        if (!value.Event || typeof value.PropertyExpression !== 'string') reject('need an explicit event and property expression');
        if (Object.keys(value).some(key => !['Event', 'PropertyExpression'].includes(key))) reject('contain unknown fields');
        const event = value.Event;
        const regularEvent = typeof event.Generation === 'number' && event.Tombstone === false;
        if (typeof event.Id !== 'string' || !regularEvent) reject('need a non-tombstone event identity');
        if (Object.keys(event).some(key => !['Id', 'Generation', 'Tombstone'].includes(key))) reject('contain unknown event fields');
    }

    private static root(value: ValueChildrenDefinition, schema: JsonSchema, context: ChildrenValidationContext, reject: (detail: string) => never): void {
        const from = context.from.find(entry => entry.Key.Id === value.Event.Id);
        if (!from || from.Key.Generation !== value.Event.Generation) reject('without the compiler-emitted root subscription');
        if (context.removedWith.some(entry => entry.Key.Id === value.Event.Id)) reject('that also remove the parent');
        if (Object.keys(from!.Value.Properties).length) reject('combined with explicit root mappings for the value event');
        const rootNames = Object.keys(context.schema.properties ?? {}).map(name => name.toLowerCase());
        if (Object.keys(schema.properties ?? {}).some(name => rootNames.includes(name.toLowerCase()))) reject('combined with root AutoMap for the value event');
    }

    private static plainString(schema: JsonSchema | undefined): boolean {
        return schema?.type === 'string' && schema.format === undefined;
    }
}
