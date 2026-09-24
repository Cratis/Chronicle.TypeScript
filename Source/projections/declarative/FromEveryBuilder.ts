// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IAllSetBuilder } from './IAllSetBuilder.js';
import { IFromEveryBuilder } from './IFromEveryBuilder.js';
import { AllSetBuilder } from './AllSetBuilder.js';

/**
 * Accumulated mapping entry for fromEvery.
 */
export interface FromEveryEntry {
    properties: Record<string, string>;
    includeChildren: boolean;
}

/**
 * Concrete implementation of {@link IFromEveryBuilder}.
 * @template TReadModel - The read model type.
 */
export class FromEveryBuilder<TReadModel> implements IFromEveryBuilder<TReadModel> {
    readonly entry: FromEveryEntry = {
        properties: {},
        includeChildren: true
    };

    /** @inheritdoc */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAllSetBuilder<TReadModel, IFromEveryBuilder<TReadModel>> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        const property = handler.property;

        return new AllSetBuilder<TReadModel, IFromEveryBuilder<TReadModel>>(
            property,
            (targetProperty, expression) => { this.entry.properties[targetProperty] = expression; },
            this
        );
    }

    /** @inheritdoc */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        const property = handler.property;
        this.entry.properties[`${property}.$eventContext.${contextPropertyName}`] = '$count';
        return this;
    }

    /** @inheritdoc */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        const property = handler.property;
        this.entry.properties[`${property}.$eventContext.${contextPropertyName}`] = '$increment';
        return this;
    }

    /** @inheritdoc */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, contextPropertyName: string): IFromEveryBuilder<TReadModel> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        const property = handler.property;
        this.entry.properties[`${property}.$eventContext.${contextPropertyName}`] = '$decrement';
        return this;
    }

    /** @inheritdoc */
    excludeChildProjections(): IFromEveryBuilder<TReadModel> {
        this.entry.includeChildren = false;
        return this;
    }
}
