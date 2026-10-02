// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { ICompositeKeyBuilder } from './ICompositeKeyBuilder.js';
import { ISetBuilder } from './ISetBuilder.js';
import { SetBuilder } from './SetBuilder.js';

/**
 * Concrete implementation of {@link ICompositeKeyBuilder} that builds a `$composite(...)` key
 * expression from event properties, event context, source identifiers and constants.
 * @template TKeyType - The composite key type.
 * @template TEvent - The event type.
 */
export class CompositeKeyBuilder<TKeyType, TEvent> implements ICompositeKeyBuilder<TKeyType, TEvent> {
    private readonly _parts: Array<{ property: string; expression?: string }> = [];

    /** @inheritdoc */
    set(targetPropertyAccessor: PropertyAccessor<TKeyType>): ISetBuilder<TEvent, ICompositeKeyBuilder<TKeyType, TEvent>>;
    /** @inheritdoc */
    set(
        targetPropertyAccessor: PropertyAccessor<TKeyType>,
        sourcePropertyAccessor: PropertyAccessor<TEvent>
    ): ICompositeKeyBuilder<TKeyType, TEvent>;
    set(
        targetPropertyAccessor: PropertyAccessor<TKeyType>,
        sourcePropertyAccessor?: PropertyAccessor<TEvent>
    ): ICompositeKeyBuilder<TKeyType, TEvent> | ISetBuilder<TEvent, ICompositeKeyBuilder<TKeyType, TEvent>> {
        const targetHandler = new PropertyPathResolverProxyHandler();
        const targetProxy = new Proxy({}, targetHandler);
        targetPropertyAccessor(targetProxy as TKeyType);

        const part: { property: string; expression?: string } = { property: targetHandler.property };
        this._parts.push(part);
        const setBuilder = new SetBuilder<TEvent, ICompositeKeyBuilder<TKeyType, TEvent>>(
            part.property, (_property, expression) => { part.expression = expression; }, this);
        return sourcePropertyAccessor ? setBuilder.to(sourcePropertyAccessor) : setBuilder;
    }

    /** @inheritdoc */
    build(): string {
        const parts = this._parts.map(part => {
            if (part.expression === undefined) {
                throw new Error(`Composite key part '${part.property}' is missing a to expression.`);
            }
            return `${part.property}=${part.expression}`;
        }).join(',');
        return `$composite(${parts})`;
    }
}
