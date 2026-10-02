// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** A single-consumer stream of read model changes, started when createWatcher() is called. */
export interface IReadModelWatcher<TReadModel> extends AsyncIterable<ReadModelChangeset<TReadModel>> {
    /**
     * Resolves on the kernel's subscription acknowledgment, without requiring iteration.
     * When resumption is opted into, read this property again after disconnect for the next subscription.
     * An already pending promise carries across lifecycle reconnects; a previously resolved
     * promise cannot be revoked. Rejects if the watcher stops before acknowledgment.
     */
    readonly subscribed: Promise<void>;

    /**
     * Registers a callback after each subscription acknowledgment following the first.
     * Having at least one registered callback opts into resumption on transport failures and
     * completion. Without callbacks or the resume option, transport errors reject iteration.
     * Refresh your query here: changes during an outage are not replayed. Register before
     * awaiting subscribed; callbacks are not replayed for late registrations.
     * Callbacks run in registration order and are awaited before reading more changes on
     * the resumed stream. Do not wait for iteration inside a callback. A thrown error or
     * rejected promise fails iteration. Reconnects retain already received changes.
     * @returns An idempotent function that unregisters the callback. Disposal also unregisters it.
     */
    onResubscribed(callback: () => void | Promise<void>): () => void;

    /** Stops the stream and completes pending iteration. Safe to call more than once. */
    dispose(): void;
}
