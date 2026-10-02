// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { AllSetBuilder } from './AllSetBuilder.js';
import type { IAllSetBuilder } from './IAllSetBuilder.js';
import type { IFromAllBuilder } from './IFromAllBuilder.js';

/** Accumulates all-event mappings without restricting the event subscription to known types. */
export class FromAllBuilder<TReadModel> implements IFromAllBuilder<TReadModel> {
    readonly properties: Record<string, string> = {};

    /** @inheritdoc */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAllSetBuilder<TReadModel, IFromAllBuilder<TReadModel>> {
        return new AllSetBuilder<TReadModel, IFromAllBuilder<TReadModel>>(
            this.targetProperty(readModelPropertyAccessor),
            (property, expression) => { this.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel> {
        return this.operation(readModelPropertyAccessor, '$count', contextPropertyName);
    }

    /** @inheritdoc */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel> {
        return this.operation(readModelPropertyAccessor, '$increment', contextPropertyName);
    }

    /** @inheritdoc */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName?: string): IFromAllBuilder<TReadModel> {
        return this.operation(readModelPropertyAccessor, '$decrement', contextPropertyName);
    }

    private operation(accessor: PropertyAccessor<TReadModel>, expression: string, contextPropertyName?: string): this {
        const property = this.targetProperty(accessor);
        const target = contextPropertyName === undefined ? property : `${property}.$eventContext.${contextPropertyName}`;
        this.properties[target] = expression;
        return this;
    }

    private targetProperty(accessor: PropertyAccessor<TReadModel>): string {
        const handler = new PropertyPathResolverProxyHandler();
        accessor(new Proxy({}, handler) as TReadModel);
        return handler.property;
    }
}
