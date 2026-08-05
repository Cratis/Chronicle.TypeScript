// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { AddBuilder } from './AddBuilder';
import { AddChildBuilder, ChildAdditionEntry } from './AddChildBuilder';
import { CompositeKeyBuilder } from './CompositeKeyBuilder';
import { IAddBuilder } from './IAddBuilder';
import { IAddChildBuilder } from './IAddChildBuilder';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder';
import { IFromBuilder } from './IFromBuilder';
import { ISetBuilder } from './ISetBuilder';
import { ISubtractBuilder } from './ISubtractBuilder';
import { SetBuilder } from './SetBuilder';
import { SubtractBuilder } from './SubtractBuilder';

/**
 * Accumulated property mapping for a from clause.
 */
export interface FromEntry {
    properties: Record<string, string>;
    key: string;
    parentKey: string;
    children: ChildAdditionEntry[];
}

/**
 * Concrete implementation of {@link IFromBuilder}.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 */
export class FromBuilder<TReadModel, TEvent> implements IFromBuilder<TReadModel, TEvent> {
    readonly entry: FromEntry = {
        properties: {},
        key: '$eventSourceId',
        parentKey: '',
        children: []
    };

    /** @inheritdoc */
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>): ISetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        const rmProp = handler.property;
        return new SetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>>(
            rmProp,
            (rp, expr) => { this.entry.properties[rp] = expr; },
            this
        );
    }

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.key = handler.property;
        return this;
    }

    /** @inheritdoc */
    usingKeyFromContext(contextPropertyName: string): this {
        this.entry.key = `$context.${contextPropertyName}`;
        return this;
    }

    /** @inheritdoc */
    usingParentKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.parentKey = handler.property;
        return this;
    }

    /** @inheritdoc */
    usingParentKeyFromContext(contextPropertyName: string): this {
        this.entry.parentKey = `$context.${contextPropertyName}`;
        return this;
    }

    /** @inheritdoc */
    usingCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        const compositeKeyBuilder = new CompositeKeyBuilder<TKeyType, TEvent>();
        builderCallback(compositeKeyBuilder);
        this.entry.key = compositeKeyBuilder.build();
        return this;
    }

    /** @inheritdoc */
    usingParentCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        const compositeKeyBuilder = new CompositeKeyBuilder<TKeyType, TEvent>();
        builderCallback(compositeKeyBuilder);
        this.entry.parentKey = compositeKeyBuilder.build();
        return this;
    }

    /** @inheritdoc */
    usingConstantKey(value: string): this {
        this.entry.key = value;
        return this;
    }

    /** @inheritdoc */
    usingConstantParentKey(value: string): this {
        this.entry.parentKey = value;
        return this;
    }

    /** @inheritdoc */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        this.entry.properties[handler.property] = '$increment';
        return this;
    }

    /** @inheritdoc */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        this.entry.properties[handler.property] = '$decrement';
        return this;
    }

    /** @inheritdoc */
    add(readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAddBuilder<TEvent, this> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        return new AddBuilder<TEvent, this>(
            handler.property,
            (property, expression) => { this.entry.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    subtract(readModelPropertyAccessor: PropertyAccessor<TReadModel>): ISubtractBuilder<TEvent, this> {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        return new SubtractBuilder<TEvent, this>(
            handler.property,
            (property, expression) => { this.entry.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        this.entry.properties[handler.property] = '$count';
        return this;
    }

    /** @inheritdoc */
    addChild<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        eventPropertyAccessorOrBuilderCallback: PropertyAccessor<TEvent> | ((builder: IAddChildBuilder<TChildModel, TEvent>) => void)
    ): this {
        const targetHandler = new PropertyPathResolverProxyHandler();
        const targetProxy = new Proxy({}, targetHandler);
        targetPropertyAccessor(targetProxy as TReadModel);

        const probe = new AddChildBuilder<TChildModel, TEvent>();
        const probeProxy = new Proxy({}, probe);
        (eventPropertyAccessorOrBuilderCallback as (value: unknown) => void)(probeProxy);

        this.entry.children.push(probe.usedAsBuilder
            ? { targetProperty: targetHandler.property, identifiedBy: probe.identifiedByProperty, usingKey: probe.usingKeyProperty }
            : { targetProperty: targetHandler.property, fromEventProperty: probe.capturedEventProperty });
        return this;
    }

    /** @inheritdoc */
    setThisValue(): ISetBuilder<TEvent, this> {
        return new SetBuilder<TEvent, this>(
            '$this',
            (rp, expr) => { this.entry.properties[rp] = expr; },
            this
        );
    }
}
