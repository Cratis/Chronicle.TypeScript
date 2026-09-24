// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { Identity } from './Identity.js';
import { IIdentityProvider } from './IIdentityProvider.js';

/**
 * Implements {@link IIdentityProvider} using {@link AsyncLocalStorage} to scope the identity to the active async call context.
 */
export class IdentityProvider implements IIdentityProvider {
    private readonly _storage = new AsyncLocalStorage<Identity>();

    /** @inheritdoc */
    getCurrent(): Identity {
        return this._storage.getStore() ?? Identity.system;
    }

    /** Runs an async or synchronous operation as the given identity, restoring the caller's identity afterward. */
    run<T>(identity: Identity, callback: () => T): T {
        return this._storage.run(identity, callback);
    }

    /** @inheritdoc */
    setCurrentIdentity(identity: Identity): void {
        this._storage.enterWith(identity);
    }

    /** @inheritdoc */
    clearCurrentIdentity(): void {
        this._storage.enterWith(Identity.system);
    }
}
