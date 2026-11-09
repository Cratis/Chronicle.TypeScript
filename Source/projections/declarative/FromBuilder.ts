// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { constantValueExpression } from '../constantValueExpression.js';
import { eventContextPropertyExpression } from '../eventContextPropertyExpression.js';
import { removeExpression, setOnceExpression } from '../propertyExpressions.js';
import { AddBuilder } from './AddBuilder.js';
import { AddChildBuilder, ChildAdditionEntry } from './AddChildBuilder.js';
import { CompositeKeyBuilder } from './CompositeKeyBuilder.js';
import { DictionaryKeySource, dictionaryEntryPath } from './DictionaryKey.js';
import { IAddBuilder } from './IAddBuilder.js';
import { IAddChildBuilder } from './IAddChildBuilder.js';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder.js';
import { IFromBuilder } from './IFromBuilder.js';
import { ISetBuilder } from './ISetBuilder.js';
import { ISubtractBuilder } from './ISubtractBuilder.js';
import { SetBuilder } from './SetBuilder.js';
import { SubtractBuilder } from './SubtractBuilder.js';
import { recordKeyDeclaration } from './projectionBuilderProvenance.js';

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
    set(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>> {
        return new SetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>>(
            this.targetOf(readModelPropertyAccessor, key),
            (property, expression) => { this.entry.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    setOnce(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>> {
        return new SetBuilder<TEvent, IFromBuilder<TReadModel, TEvent>>(
            this.targetOf(readModelPropertyAccessor, key),
            (property, expression) => { this.entry.properties[property] = setOnceExpression(expression); },
            this
        );
    }

    /** @inheritdoc */
    removeKey(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key: DictionaryKeySource<TEvent>): this {
        this.entry.properties[this.targetOf(readModelPropertyAccessor, key)] = removeExpression;
        return this;
    }

    /** @inheritdoc */
    usingKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.key = handler.property;
        recordKeyDeclaration(this, 'Key', '.from().usingKey');
        return this;
    }

    /** @inheritdoc */
    usingKeyFromContext(contextPropertyName: string): this {
        this.entry.key = eventContextPropertyExpression(contextPropertyName);
        recordKeyDeclaration(this, 'Key', '.from().usingKeyFromContext');
        return this;
    }

    /** @inheritdoc */
    usingParentKey(keyAccessor: PropertyAccessor<TEvent>): this {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        keyAccessor(proxy as TEvent);
        this.entry.parentKey = handler.property;
        recordKeyDeclaration(this, 'ParentKey', '.from().usingParentKey');
        return this;
    }

    /** @inheritdoc */
    usingParentKeyFromContext(contextPropertyName: string): this {
        this.entry.parentKey = eventContextPropertyExpression(contextPropertyName);
        recordKeyDeclaration(this, 'ParentKey', '.from().usingParentKeyFromContext');
        return this;
    }

    /** @inheritdoc */
    usingCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        const compositeKeyBuilder = new CompositeKeyBuilder<TKeyType, TEvent>();
        builderCallback(compositeKeyBuilder);
        this.entry.key = compositeKeyBuilder.build();
        recordKeyDeclaration(this, 'Key', '.from().usingCompositeKey');
        return this;
    }

    /** @inheritdoc */
    usingParentCompositeKey<TKeyType>(builderCallback: (builder: ICompositeKeyBuilder<TKeyType, TEvent>) => void): this {
        const compositeKeyBuilder = new CompositeKeyBuilder<TKeyType, TEvent>();
        builderCallback(compositeKeyBuilder);
        this.entry.parentKey = compositeKeyBuilder.build();
        recordKeyDeclaration(this, 'ParentKey', '.from().usingParentCompositeKey');
        return this;
    }

    /** @inheritdoc */
    usingConstantKey(value: string): this {
        this.entry.key = constantValueExpression(value);
        recordKeyDeclaration(this, 'Key', '.from().usingConstantKey');
        return this;
    }

    /** @inheritdoc */
    usingConstantParentKey(value: string): this {
        this.entry.parentKey = constantValueExpression(value);
        recordKeyDeclaration(this, 'ParentKey', '.from().usingConstantParentKey');
        return this;
    }

    /** @inheritdoc */
    increment(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): this {
        this.entry.properties[this.targetOf(readModelPropertyAccessor, key)] = '$increment';
        return this;
    }

    /** @inheritdoc */
    decrement(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): this {
        this.entry.properties[this.targetOf(readModelPropertyAccessor, key)] = '$decrement';
        return this;
    }

    /** @inheritdoc */
    add(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): IAddBuilder<TEvent, this> {
        return new AddBuilder<TEvent, this>(
            this.targetOf(readModelPropertyAccessor, key),
            (property, expression) => { this.entry.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    subtract(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): ISubtractBuilder<TEvent, this> {
        return new SubtractBuilder<TEvent, this>(
            this.targetOf(readModelPropertyAccessor, key),
            (property, expression) => { this.entry.properties[property] = expression; },
            this
        );
    }

    /** @inheritdoc */
    count(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): this {
        this.entry.properties[this.targetOf(readModelPropertyAccessor, key)] = '$count';
        return this;
    }

    /** @inheritdoc */
    addChild<TChildModel>(targetPropertyAccessor: (model: TReadModel) => readonly TChildModel[] | null | undefined, builderCallback: (builder: IAddChildBuilder<TChildModel, TEvent> & TEvent) => void): this;
    /** @inheritdoc */
    addChild<TChildModel>(targetPropertyAccessor: (model: TReadModel) => readonly TChildModel[] | null | undefined, eventPropertyAccessor: PropertyAccessor<TEvent>): this;
    /** @inheritdoc */
    addChild<TChildModel>(
        targetPropertyAccessor: PropertyAccessor<TReadModel>,
        eventPropertyAccessorOrBuilderCallback: PropertyAccessor<TEvent> | ((builder: IAddChildBuilder<TChildModel, TEvent>) => void)
    ): this;
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
            ? { targetProperty: targetHandler.property, identifiedBy: probe.identifiedByProperty, usingKey: probe.usingKeyProperty, usingParentKey: probe.usingParentKeyProperty }
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

    /**
     * Resolves the target property path: the property itself, or the entry of a dictionary-typed property.
     * @param readModelPropertyAccessor - Accessor for the read model property.
     * @param key - Optional dictionary key.
     * @returns The target property path.
     */
    private targetOf(readModelPropertyAccessor: PropertyAccessor<TReadModel>, key?: DictionaryKeySource<TEvent>): string {
        const handler = new PropertyPathResolverProxyHandler();
        readModelPropertyAccessor(new Proxy({}, handler) as TReadModel);
        return key === undefined ? handler.property : dictionaryEntryPath(handler.property, key);
    }
}
