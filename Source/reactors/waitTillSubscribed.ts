// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { setTimeout as delay } from 'node:timers/promises';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import type { WaitTillSubscribedOptions } from './WaitTillSubscribedOptions.js';

/** Polls current observer readiness; a previous subscription can satisfy this check. */
export async function waitTillSubscribed(read: (signal: AbortSignal) => ReturnType<ChronicleConnection['observers']['getObserverInformation']>,
    options: WaitTillSubscribedOptions, lifetime: AbortSignal): Promise<void> {
    const timeout = options.timeout ?? 5000;
    if (!Number.isFinite(timeout) || timeout < 0) throw new Error('Subscription timeout must be a finite non-negative number.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Timed out waiting for reactor subscription.')), timeout);
    const signals = [controller.signal, lifetime];
    if (options.signal) signals.push(options.signal);
    const signal = AbortSignal.any(signals);
    try {
        for (;;) {
            signal.throwIfAborted();
            const information = await read(signal);
            signal.throwIfAborted();
            if (information.IsSubscribed) return;
            await delay(50, undefined, { signal });
        }
    } finally {
        clearTimeout(timer);
    }
}
