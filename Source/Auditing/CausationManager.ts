// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { Causation } from './Causation';
import { CausationType } from './CausationType';
import { ICausationManager } from './ICausationManager';

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
        const chain = this._getOrInitChain();
        return chain;
    }

    /** @inheritdoc */
    add(type: CausationType, properties: Record<string, string>): void {
        const chain = this._getOrInitChain();
        chain.push(new Causation(new Date(), type, properties));
    }

    /**
     * Defines the root causation for the current process.
     * @param properties - Properties associated with the root causation.
     */
    defineRoot(properties: Record<string, string>): void {
        this._root = new Causation(new Date(), CausationType.root, properties);
    }

    private _getOrInitChain(): Causation[] {
        let chain = this._storage.getStore();
        if (chain === undefined) {
            chain = [this._root];
            this._storage.enterWith(chain);
        } else if (chain.length === 0) {
            chain.push(this._root);
        }
        return chain;
    }
}
