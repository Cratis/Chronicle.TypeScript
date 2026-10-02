// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../../eventSequences/IEventLog.js';
import { Reactors } from '../../../reactors/Reactors.js';
import { reactor } from '../../../reactors/reactor.js';
import { Reducers } from '../../../reducers/Reducers.js';
import { reducer } from '../../../reducers/reducer.js';

chai.should();

export function filterRegistrationBehaviors(cases: readonly { type: Constructor; source: string; stream: string; tags: string[] }[]): void {
    for (const kind of ['reactor', 'reducer'] as const) {
        for (const { type, source, stream, tags } of cases) {
            describe(`when registering ${kind} ${type.name}`, () => {
                it('should combine source and stream type filters with tag filters without changing observer labels', async () => {
                    let registration: unknown;
                    let received!: () => void;
                    const captured = new Promise<void>(resolve => { received = resolve; });
                    const observe = async function* (queue: AsyncIterable<unknown>) {
                        registration = (await queue[Symbol.asyncIterator]().next()).value;
                        received();
                        // An empty stream is enough to capture registration, not evidence of kernel filtering.
                        yield* [];
                    };
                    const connection = { reactors: { observe }, reducers: { observe }, readModels: {
                        registerMany: async () => ({})
                    } } as unknown as ChronicleConnection;
                    reactor(type.name)(type);
                    reducer(type.name)(type);
                    const artifacts = { reactors: kind === 'reactor' ? [type] : [], reducers: kind === 'reducer' ? [type] : [],
                        eventTypes: [], readModels: [] } as unknown as IClientArtifactsProvider;
                    const observer = kind === 'reactor'
                        ? new Reactors(artifacts, connection, 'store', 'Default', new ConnectionLifecycle(), {} as IEventLog)
                        : new Reducers(artifacts, connection, 'store', 'Default', new ConnectionLifecycle(), 'sink');
                    try {
                        await observer.register();
                        await captured;
                        const message = registration as { Content: { Value0: Record<string, { Filters: object; Tags: string[] }> } };
                        const definition = message.Content.Value0[kind === 'reactor' ? 'Reactor' : 'Reducer'];
                        definition.Filters.should.deep.equal({ EventSourceType: source, EventStreamType: stream, FilterTags: tags });
                        definition.Tags.should.deep.equal(tags.length ? ['Analytics'] : []);
                    } finally {
                        observer.dispose();
                    }
                });
            });
        }
    }
}
