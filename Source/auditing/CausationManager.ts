// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { Causation } from './Causation.js';
import { CausationType } from './CausationType.js';
import { ICausationManager } from './ICausationManager.js';

/**
 * Implements {@link ICausationManager} using {@link AsyncLocalStorage} to scope the causation chain to the active async call context.
 */
export class CausationManager implements ICausationManager {
    private readonly _storage = new AsyncLocalStorage<Causation[]>();
    private _root: Causation = new Causation(new Date(), CausationType.root, {});

    /** @inheritdoc */
    get root(): Causation {
        return this._root;
    }

    /** @inheritdoc */
    getCurrentChain(): ReadonlyArray<Causation> {
        return this._storage.getStore() ?? [this._root];
    }

    /** @inheritdoc */
    add(type: CausationType, properties: Record<string, string>): void {
        this._storage.enterWith([...this.getCurrentChain(), new Causation(new Date(), type, properties)]);
    }

    /** Runs an async or synchronous operation with an isolated, restored causation chain. */
    run<T>(callback: () => T): T;
    run<T>(type: CausationType, properties: Record<string, string>, callback: () => T): T;
    run<T>(typeOrCallback: CausationType | (() => T), properties?: Record<string, string>, callback?: () => T): T {
        const chain = [...this.getCurrentChain()];
        if (typeof typeOrCallback !== 'function') {
            chain.push(new Causation(new Date(), typeOrCallback, properties!));
        }
        return this._storage.run(chain, typeof typeOrCallback === 'function' ? typeOrCallback as () => T : callback!);
    }

    /**
     * Defines the root causation for the current process.
     * @param properties - Properties associated with the root causation.
     */
    defineRoot(properties: Record<string, string>): void {
        this._root = new Causation(new Date(), CausationType.root, properties);
    }
}
