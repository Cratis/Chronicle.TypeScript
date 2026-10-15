// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReactorMessage } from '@cratis/chronicle.contracts';
import { describe, expect, it } from 'vitest';
import type { IClientArtifactsProvider } from '../artifacts/index.js';
import type { ChronicleConnection } from '../connection/index.js';
import { ConnectionLifecycle } from '../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { reactor } from './reactor.js';
import { Reactors } from './Reactors.js';
import { startAtTail } from './startAtTail.js';

@eventType('start-at-tail-event')
class SomethingHappened {
    constructor(readonly value: string = '') {}
}

@reactor('starts-at-tail')
@startAtTail()
class StartsAtTail {
    somethingHappened() {}
}

@reactor('starts-at-the-beginning')
class StartsAtTheBeginning {
    somethingHappened() {}
}

async function registrationOf(type: Function) {
    const lifecycle = new ConnectionLifecycle();
    let registration!: ReactorMessage;
    let received!: () => void;
    const registered = new Promise<void>(resolve => { received = resolve; });
    async function* stream(queue: AsyncIterable<ReactorMessage>) {
        registration = (await queue[Symbol.asyncIterator]().next()).value!;
        received();
        await new Promise(() => {});
    }
    const connection = { reactors: { observe: stream } } as unknown as ChronicleConnection;
    const artifacts = { reactors: [type], eventTypes: [SomethingHappened] } as unknown as IClientArtifactsProvider;
    const reactors = new Reactors(artifacts, connection, 'store', 'tenant', lifecycle, {} as IEventLog);
    await reactors.register();
    await registered;
    reactors.dispose();
    return registration.Content?.Value0?.Reactor;
}

describe('when registering a reactor marked to start at the tail', () => {
    it('asks the kernel to begin at the tail', async () => {
        expect((await registrationOf(StartsAtTail))?.StartAtTail).toBe(true);
    });
});

describe('when registering a reactor that is not marked', () => {
    it('does not ask the kernel to skip history', async () => {
        expect((await registrationOf(StartsAtTheBeginning))?.StartAtTail).toBe(false);
    });
});
