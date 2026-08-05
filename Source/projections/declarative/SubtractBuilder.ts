// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ISubtractBuilder } from './ISubtractBuilder';

/**
 * Concrete implementation of {@link ISubtractBuilder} that records a subtract expression
 * into the owning from/join builder.
 * @template TEvent - The event type.
 * @template TParentBuilder - The parent builder type.
 */
export class SubtractBuilder<TEvent, TParentBuilder> implements ISubtractBuilder<TEvent, TParentBuilder> {
    constructor(
        private readonly _readModelProperty: string,
        private readonly _setProperty: (readModelProp: string, expression: string) => void,
        private readonly _parent: TParentBuilder
    ) {}

    /** @inheritdoc */
    with(eventPropertyAccessor: PropertyAccessor<TEvent>): TParentBuilder {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        eventPropertyAccessor(proxy as TEvent);
        this._setProperty(this._readModelProperty, `$subtract(${handler.property})`);
        return this._parent;
    }
}
