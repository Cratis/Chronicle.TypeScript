// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** A single-consumer stream of read model changes, started when watch() is called. */
export interface IReadModelWatcher<TReadModel> extends AsyncIterable<ReadModelChangeset<TReadModel>> {
    /**
     * Resolves on the kernel's subscription acknowledgment, without requiring iteration.
     * After a lifecycle disconnect, read this property again for the next subscription.
     * An already pending promise carries across lifecycle reconnects; a previously resolved
     * promise cannot be revoked. Rejects if the watcher stops before acknowledgment.
     */
    readonly subscribed: Promise<void>;

    /** Stops the stream and completes pending iteration. Safe to call more than once. */
    dispose(): void;
}
