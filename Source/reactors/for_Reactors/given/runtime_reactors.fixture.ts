// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { EventsToObserve, ObserverInformation, type ReactorMessage } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { AsyncQueue } from '../../AsyncQueue.js';
import { Reactors } from '../../Reactors.js';

@eventType('runtime-registered')
export class Registered { value = ''; }
@eventType('runtime-other')
export class Other {}

/** A controllable duplex stream, recording only messages actually sent by production code. */
export class runtime_reactors {
    readonly lifecycle = new ConnectionLifecycle();
    readonly types: Constructor[] = [Registered, Other];
    readonly artifacts: Constructor[] = [];
    readonly attempts: { incoming: AsyncQueue<EventsToObserve>; sent: ReactorMessage[]; signal: AbortSignal }[] = [];
    readonly information = vi.fn(async () => ObserverInformation.fromPartial({ IsSubscribed: false }));
    readonly observe = vi.fn((outgoing: AsyncIterable<ReactorMessage>, options: { signal: AbortSignal }) => {
        const attempt = { incoming: new AsyncQueue<EventsToObserve>(), sent: [] as ReactorMessage[], signal: options.signal };
        this.attempts.push(attempt);
        options.signal.addEventListener('abort', () => attempt.incoming.complete(), { once: true });
        return (async function* () {
            const messages = outgoing[Symbol.asyncIterator]();
            const registration = await messages.next();
            if (!registration.done) attempt.sent.push(registration.value);
            for await (const message of attempt.incoming) {
                yield message;
                const result = await messages.next();
                if (!result.done) attempt.sent.push(result.value);
            }
        })();
    });
    readonly reactors: Reactors;

    constructor(skipKeepAlive = false) {
        this.reactors = new Reactors({ reactors: this.artifacts, eventTypes: this.types } as unknown as IClientArtifactsProvider,
            { reactors: { observe: this.observe }, observers: { getObserverInformation: this.information } } as unknown as ChronicleConnection,
            'store', 'tenant', this.lifecycle, {} as IEventLog, undefined, undefined, undefined, skipKeepAlive,
            { baseDelayMs: 10, nextJitter: () => 0 });
    }
}
