// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReactorMessage, ReducerMessage } from '@cratis/chronicle.contracts';
import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles } from '../../events/handles.js';
import { onceOnly, reactor, Reactors } from '../../reactors/index.js';
import { reducer, Reducers } from '../../reducers/index.js';

chai.should();

@eventType('reobserved-event')
class AuthorRegistered {}

@onceOnly()
@reactor('reobserved-reactor')
class AuthorReactor { @handles(AuthorRegistered) notify() {} }

@reducer('reobserved-reducer')
class AuthorReducer { @handles(AuthorRegistered) update() {} }

for (const kind of ['reactor', 'reducer'] as const) {
    describe(`when reobserving an explicit ${kind} handler`, () => {
        const registrations: (ReactorMessage | ReducerMessage)[] = [];
        let observations: Reactors | Reducers;
        beforeEach(async () => {
            vi.useFakeTimers();
            registrations.length = 0;
            const lifecycle = new ConnectionLifecycle();
            async function* stream(queue: AsyncIterable<ReactorMessage | ReducerMessage>) {
                registrations.push((await queue[Symbol.asyncIterator]().next()).value!);
                yield { Events: [], Partition: 'author', ReplayState: 0, InitialState: '' };
            }
            const connection = {
                reactors: { observe: stream }, reducers: { observe: stream },
                readModels: { registerMany: async () => ({}) }
            } as unknown as ChronicleConnection;
            const artifacts = {
                reactors: [AuthorReactor], reducers: [AuthorReducer], eventTypes: [AuthorRegistered], readModels: []
            } as unknown as IClientArtifactsProvider;
            observations = kind === 'reactor'
                ? new Reactors(artifacts, connection, 'store', 'tenant', lifecycle, {} as IEventLog)
                : new Reducers(artifacts, connection, 'store', 'tenant', lifecycle, 'sink');
            await observations.register();
            await vi.advanceTimersByTimeAsync(0);
            // Changing the catalog must not invalidate an already validated observation on its timer callback.
            artifacts.eventTypes.splice(0);
            await vi.advanceTimersByTimeAsync(2000);
        });
        afterEach(() => {
            observations.dispose();
            vi.clearAllTimers();
            vi.useRealTimers();
        });
        it('should reuse the registered handler mapping when the stream ends', () => {
            registrations.should.have.lengthOf(2);
            registrations[1].should.deep.equal(registrations[0]);
            const registration = registrations[1].Content!.Value0!;
            const observer = 'Reactor' in registration ? registration.Reactor : registration.Reducer;
            observer!.EventTypes.map(entry => entry.EventType!.Id).should.deep.equal(['reobserved-event']);
        });
        if (kind === 'reactor') {
            it('should register a class-level onceOnly reactor with an explicit handler as non-replayable', () => {
                (registrations[0] as ReactorMessage).Content!.Value0!.Reactor!.IsReplayable.should.be.false;
            });
        }
    });
}
