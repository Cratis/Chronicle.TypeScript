// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { EventContext, EventType, ObservationState, type ReducerMessage } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import type { EventContext as ClientEventContext } from '../../events/EventContext.js';
import { handles, reducer, Reducers } from '../index.js';

chai.should();

@eventType('legacy-reduced-handler')
class AuthorRegistered { constructor(readonly name = '') {} }

@reducer('legacy-reduction')
class AuthorReducer {
    @handles(AuthorRegistered)
    update(event: AuthorRegistered, state: { names: string[] } | undefined, context: ClientEventContext) {
        return { names: [...(state?.names ?? []), event.name], id: context.eventSourceId };
    }
}

describe('when observing explicit legacy reducer handlers', () => {
    let registration: ReducerMessage;
    let result: ReducerMessage;
    beforeEach(async () => {
        const lifecycle = new ConnectionLifecycle();
        let finish!: () => void;
        const finished = new Promise<void>(resolve => { finish = resolve; });
        async function* stream(queue: AsyncIterable<ReducerMessage>) {
            const messages = queue[Symbol.asyncIterator]();
            registration = (await messages.next()).value!;
            yield {
                Events: ['Ada', 'Grace'].map((name, index) => ({
                    Context: EventContext.fromPartial({
                        EventType: EventType.fromPartial({ Id: 'legacy-reduced-handler', Generation: 1 }),
                        EventSourceId: 'author', SequenceNumber: BigInt(index + 1)
                    }),
                    Content: JSON.stringify({ name })
                })),
                Partition: 'author', ReplayState: 0, InitialState: ''
            };
            result = (await messages.next()).value!;
            await lifecycle.disconnected(error => { throw error; });
            finish();
        }
        const connection = {
            reducers: { observe: stream }, readModels: { registerMany: async () => ({}) }
        } as unknown as ChronicleConnection;
        const artifacts = {
            reducers: [AuthorReducer], eventTypes: [AuthorRegistered], readModels: []
        } as unknown as IClientArtifactsProvider;
        const reducers = new Reducers(artifacts, connection, 'store', 'tenant', lifecycle, 'sink');
        try {
            await reducers.register();
            await finished;
        } finally { reducers.dispose(); }
    });
    it('should subscribe to the explicitly named event type', () => {
        registration.Content!.Value0!.Reducer!.EventTypes.map(entry => entry.EventType!.Id)
            .should.deep.equal(['legacy-reduced-handler']);
    });
    it('should pass the event state and context through the named method', () => {
        JSON.parse(result.Content!.Value1!.ReadModelState).should.deep.equal({ names: ['Ada', 'Grace'], id: 'author' });
    });
    it('should acknowledge both deliveries successfully', () => {
        result.Content!.Value1!.State.should.equal(ObservationState.Success);
        result.Content!.Value1!.LastSuccessfulObservation.should.equal(2n);
    });
});
