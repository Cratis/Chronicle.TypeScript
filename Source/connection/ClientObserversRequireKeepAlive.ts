// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A client-hosted observer requires a long-running keep-alive connection. */
export class ClientObserversRequireKeepAlive extends Error {
    constructor(readonly observerKind: 'Reactor' | 'Reducer', readonly observerId: string) {
        super(`${observerKind} '${observerId}' cannot be registered because this client skips the keep-alive connection (short-lived process). Client-hosted observers need a long-running process: host them in a client that does not set skipKeepAlive.`);
        this.name = 'ClientObserversRequireKeepAlive';
    }
}
