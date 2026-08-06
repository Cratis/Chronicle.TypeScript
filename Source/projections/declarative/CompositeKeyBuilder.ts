// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder';

/**
 * Concrete implementation of {@link ICompositeKeyBuilder} that builds a `$composite(...)` key
 * expression from multiple event properties mapped onto named parts of a key type.
 * @template TKeyType - The composite key type.
 * @template TEvent - The event type.
 */
export class CompositeKeyBuilder<TKeyType, TEvent> implements ICompositeKeyBuilder<TKeyType, TEvent> {
    private readonly _parts: Array<{ property: string; expression: string }> = [];

    /** @inheritdoc */
    set(
        targetPropertyAccessor: PropertyAccessor<TKeyType>,
        sourcePropertyAccessor: PropertyAccessor<TEvent>
    ): ICompositeKeyBuilder<TKeyType, TEvent> {
        const targetHandler = new PropertyPathResolverProxyHandler();
        const targetProxy = new Proxy({}, targetHandler);
        targetPropertyAccessor(targetProxy as TKeyType);

        const sourceHandler = new PropertyPathResolverProxyHandler();
        const sourceProxy = new Proxy({}, sourceHandler);
        sourcePropertyAccessor(sourceProxy as TEvent);

        this._parts.push({ property: targetHandler.property, expression: sourceHandler.property });
        return this;
    }

    /** @inheritdoc */
    build(): string {
        const parts = this._parts.map(part => `${part.property}=${part.expression}`).join(',');
        return `$composite(${parts})`;
    }
}
