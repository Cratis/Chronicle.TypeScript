// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IAllSetBuilder } from './IAllSetBuilder';

/**
 * Concrete implementation of {@link IAllSetBuilder} for fromEvery mappings.
 * @template TReadModel - The read model type.
 * @template TParentBuilder - The parent builder type.
 */
export class AllSetBuilder<TReadModel, TParentBuilder> implements IAllSetBuilder<TReadModel, TParentBuilder> {
    constructor(
        private readonly _targetProperty: string,
        private readonly _setProperty: (property: string, expression: string) => void,
        private readonly _parent: TParentBuilder
    ) {}

    /** @inheritdoc */
    to(readModelPropertyAccessor: PropertyAccessor<TReadModel>): TParentBuilder {
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        readModelPropertyAccessor(proxy as TReadModel);
        this._setProperty(this._targetProperty, handler.property);
        return this._parent;
    }

    /** @inheritdoc */
    toEventContextProperty(contextPropertyName: string): TParentBuilder {
        this._setProperty(this._targetProperty, `$context.${contextPropertyName}`);
        return this._parent;
    }

    /** @inheritdoc */
    toEventSourceId(): TParentBuilder {
        this._setProperty(this._targetProperty, '$eventSourceId');
        return this._parent;
    }
}
