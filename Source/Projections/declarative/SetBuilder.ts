// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ISetBuilder } from './ISetBuilder';

/**
 * Concrete implementation of {@link ISetBuilder} that records the property mapping
 * into the owning from/join builder.
 * @template TEvent - The event type.
 * @template TParentBuilder - The parent builder type.
 */
export class SetBuilder<TEvent, TParentBuilder> implements ISetBuilder<TEvent, TParentBuilder> {
    constructor(
        private readonly _readModelProperty: string,
        private readonly _setProperty: (readModelProp: string, expression: string) => void,
        private readonly _parent: TParentBuilder
    ) {}

    /** @inheritdoc */
    to(eventPropertyAccessor: PropertyAccessor<TEvent>): TParentBuilder {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        eventPropertyAccessor(proxy as TEvent);
        this._setProperty(this._readModelProperty, handler.property);
        return this._parent;
    }

    /** @inheritdoc */
    toValue<TProperty>(value: TProperty): TParentBuilder {
        this._setProperty(this._readModelProperty, JSON.stringify(value));
        return this._parent;
    }

    /** @inheritdoc */
    toEventContextProperty(contextPropertyName: string): TParentBuilder {
        this._setProperty(this._readModelProperty, `$context.${contextPropertyName}`);
        return this._parent;
    }

    /** @inheritdoc */
    toEventSourceId(): TParentBuilder {
        this._setProperty(this._readModelProperty, '$eventSourceId');
        return this._parent;
    }
}
