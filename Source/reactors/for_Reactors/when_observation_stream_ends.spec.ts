// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import type { ReactorMessage } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { reactor } from '../reactor.js';
import { Reactors } from '../Reactors.js';

@eventType('observation-ends-event')
class SomethingHappened {}

@reactor('observation-ends')
class ObservationEnds {
    somethingHappened() {}
}

describe('when the observation stream of a reactor ends', () => {
    it('should open one stream per reactor and register again on a fresh stream after the backoff', async () => {
        const registrations: string[] = [];
        let opened = 0;
        let reopened!: () => void;
        const secondStream = new Promise<void>(resolve => { reopened = resolve; });
        async function* stream(queue: AsyncIterable<ReactorMessage>) {
            opened++;
            const first = (await queue[Symbol.asyncIterator]().next()).value!;
            registrations.push(first.Content!.Value0!.Reactor!.ReactorId);
            if (opened === 2) {
                reopened();
                await new Promise(() => {});
            }
        }
        const reactors = new Reactors({ reactors: [ObservationEnds], eventTypes: [SomethingHappened] } as unknown as IClientArtifactsProvider,
            { reactors: { observe: stream } } as unknown as ChronicleConnection,
            'store', 'default', new ConnectionLifecycle(), {} as IEventLog, undefined, undefined, undefined, false,
            { baseDelayMs: 0, maxDelayMs: 0 });
        try {
            await reactors.register();
            await secondStream;
        } finally {
            reactors.dispose();
        }
        expect(registrations).toEqual(['observation-ends', 'observation-ends']);
    });
});
