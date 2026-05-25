// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IAddBuilder } from './IAddBuilder';
import { IAddChildBuilder } from './IAddChildBuilder';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder';
import { IFromBuilder } from './IFromBuilder';
import { ISetBuilder } from './ISetBuilder';
import { ISubtractBuilder } from './ISubtractBuilder';
import { SetBuilder } from './SetBuilder';

/**
 * Accumulated property mapping for a from clause.
 */
export interface FromEntry {
    properties: Record<string, string>;
    key: string;
    parentKey: string;
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
        parentKey: ''
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
    usingCompositeKey<TKeyType>(_builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        throw new Error('usingCompositeKey is not implemented yet.');
    }

    /** @inheritdoc */
    usingParentCompositeKey<TKeyType>(_builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        throw new Error('usingParentCompositeKey is not implemented yet.');
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
    add(_readModelPropertyAccessor: PropertyAccessor<TReadModel>): IAddBuilder<TEvent, this> {
        throw new Error('add is not implemented yet.');
    }

    /** @inheritdoc */
    subtract(_readModelPropertyAccessor: PropertyAccessor<TReadModel>): ISubtractBuilder<TEvent, this> {
        throw new Error('subtract is not implemented yet.');
    }

    /** @inheritdoc */
    count(_readModelPropertyAccessor: PropertyAccessor<TReadModel>): this {
        throw new Error('count is not implemented yet.');
    }

    /** @inheritdoc */
    addChild<TChildModel>(
        _targetPropertyAccessor: PropertyAccessor<TReadModel>,
        _eventPropertyAccessorOrBuilderCallback: PropertyAccessor<TEvent> | ((builder: IAddChildBuilder<TChildModel, TEvent>) => void)
    ): this {
        throw new Error('addChild is not implemented yet.');
    }

    /** @inheritdoc */
    setThisValue(): ISetBuilder<TEvent, this> {
        throw new Error('setThisValue is not implemented yet.');
    }
}
