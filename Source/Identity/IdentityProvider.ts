// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AsyncLocalStorage } from 'async_hooks';
import { Identity } from './Identity';
import { IIdentityProvider } from './IIdentityProvider';

/**
 * Implements {@link IIdentityProvider} using {@link AsyncLocalStorage} to scope the identity to the active async call context.
 */
export class IdentityProvider implements IIdentityProvider {
    private readonly _storage = new AsyncLocalStorage<Identity>();

    /** @inheritdoc */
    getCurrent(): Identity {
        return this._storage.getStore() ?? Identity.system;
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
