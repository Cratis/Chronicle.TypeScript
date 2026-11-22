// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Client-owned watchers, not durable kernel observers. */
export interface IReadModelReactors {
    /** Resolves after stop and in-flight lease release; rejects on startup or watcher failure only. */
    readonly completion: Promise<void>;
    /** Starts once and awaits subscription acknowledgments. Repeated calls reuse the existing watchers. */
    start(): Promise<void>;
    /** Aborts cooperatively. Await completion to drain work; handlers must settle for draining to finish. */
    stop(): void;
}
