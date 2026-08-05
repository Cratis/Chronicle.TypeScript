// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { PropertyAccessor, PropertyPathResolverProxyHandler } from '@cratis/fundamentals';
import { IAddChildBuilder } from './IAddChildBuilder';

/**
 * A single `.addChild()` accumulation captured on a from/join builder, later merged into the
 * owning projection builder's `Children` definitions once the enclosing `.from()`/`.join()`
 * call resolves the event type it belongs to.
 */
export interface ChildAdditionEntry {
    /** The read model property the child is added to. */
    targetProperty: string;
    /** The child model property used to identify instances, when set via the builder callback overload. */
    identifiedBy?: string;
    /** The event property used as the key, when set via the builder callback overload. */
    usingKey?: string;
    /** The event property whose value becomes the child directly, when set via the plain accessor overload. */
    fromEventProperty?: string;
}

/**
 * Implements {@link IAddChildBuilder} and doubles as a {@link ProxyHandler} so a single probe
 * object can resolve `.addChild()`'s two call shapes at runtime: a plain event-property
 * accessor (`e => e.someProperty`), or a builder callback (`b => b.usingKey(...)`). Known
 * builder members are dispatched to the real implementation below; any other property access
 * (the plain-accessor shape) falls through to the same path-capturing proxy used everywhere
 * else in this file for `PropertyAccessor<T>` resolution.
 * @template TChildModel - The child model type.
 * @template TEvent - The event type.
 */
export class AddChildBuilder<TChildModel, TEvent> implements IAddChildBuilder<TChildModel, TEvent>, ProxyHandler<object> {
    private readonly _pathHandler = new PropertyPathResolverProxyHandler();
    private readonly _pathProxy = new Proxy({}, this._pathHandler);
    private _usedAsBuilder = false;
    private _identifiedByProperty: string | undefined;
    private _usingKeyProperty: string | undefined;

    /** Whether any builder member (`identifiedBy`/`usingKey`) was invoked on the probe. */
    get usedAsBuilder(): boolean {
        return this._usedAsBuilder;
    }

    /** The child model property captured via `identifiedBy()`, if any. */
    get identifiedByProperty(): string | undefined {
        return this._identifiedByProperty;
    }

    /** The event property captured via `usingKey()`, if any. */
    get usingKeyProperty(): string | undefined {
        return this._usingKeyProperty;
    }

    /** The event property path captured when the probe was used as a plain accessor. */
    get capturedEventProperty(): string {
        return this._pathHandler.property;
    }

    /** @inheritdoc */
    identifiedBy(childPropertyAccessor: PropertyAccessor<TChildModel>): IAddChildBuilder<TChildModel, TEvent> {
        this._usedAsBuilder = true;
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        childPropertyAccessor(proxy as TChildModel);
        this._identifiedByProperty = handler.property;
        return this;
    }

    /** @inheritdoc */
    usingKey(eventPropertyAccessor: PropertyAccessor<TEvent>): IAddChildBuilder<TChildModel, TEvent> {
        this._usedAsBuilder = true;
        const handler = new PropertyPathResolverProxyHandler();
        const proxy = new Proxy({}, handler);
        eventPropertyAccessor(proxy as TEvent);
        this._usingKeyProperty = handler.property;
        return this;
    }

    /**
     * Proxy `get` trap: known builder members dispatch to the real implementation above;
     * anything else (a plain event property accessed by the accessor overload) falls through
     * to path-capturing so the accessor overload keeps working against the same probe.
     * @param _target - The proxy's (unused) empty target object.
     * @param prop - The accessed property name.
     * @returns The resolved member.
     */
    get(_target: object, prop: string | symbol): unknown {
        if (prop === 'identifiedBy') {
            return this.identifiedBy.bind(this);
        }
        if (prop === 'usingKey') {
            return this.usingKey.bind(this);
        }
        return Reflect.get(this._pathProxy as object, prop);
    }
}
