// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/IClientArtifactsProvider.js';
import type { ChronicleConnection } from '../../connection/ChronicleConnection.js';
import { EventStore } from '../../EventStore.js';
import { EventStoreName } from '../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../EventStoreNamespaceName.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles } from '../../events/handles.js';
import { reactor } from '../reactor.js';
import { Reactors } from '../Reactors.js';
import { runtime_reactors } from './given/runtime_reactors.fixture.js';

chai.should();

for (const failure of ['constructor', 'instance validation'] as const) {
    describe(`when a class reactor fails ${failure} during EventStore registration`, () => {
        let context: runtime_reactors;
        let store: EventStore;
        let starts: number;
        let logged: ReturnType<typeof vi.spyOn>;

        beforeEach(async () => {
            vi.useFakeTimers();
            context = new runtime_reactors();
            starts = 0;
            @eventType('start-failure-event')
            class Started {}
            @reactor('broken-start')
            class Broken {
                constructor() {
                    starts++;
                    if (failure === 'constructor') throw new Error('constructor failed');
                    Object.defineProperty(this, 'notify', { value: () => {} });
                }
                @handles(Started) notify() {}
            }
            @reactor('healthy-start')
            class Healthy { @handles(Started) notify() {} }
            const artifacts: IClientArtifactsProvider = {
                eventTypes: [Started], reactors: [Broken, Healthy], readModels: [], reducers: [], seeders: [],
                constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
            };
            const register = vi.fn().mockResolvedValue({});
            const connection = new Proxy({}, {
                get: (_target, service) => {
                    if (service === 'logger') return undefined;
                    if (service === 'reactors') return { observe: context.observe };
                    return new Proxy({}, { get: () => register });
                }
            }) as ChronicleConnection;
            store = new EventStore(new EventStoreName('store'), EventStoreNamespaceName.default,
                connection, context.lifecycle, 'sink', artifacts);
            logged = vi.spyOn((store.reactors as Reactors)['_logger'], 'error');
            await store.registerArtifacts();
            await store.registerArtifacts('reconnect');
            await vi.advanceTimersByTimeAsync(0);
        });
        afterEach(() => { store.disposeObservations(); context.reactors.dispose(); vi.restoreAllMocks(); vi.useRealTimers(); });

        it('should finish EventStore registration and start the second reactor', () => {
            context.observe.mock.calls.length.should.equal(1);
            context.attempts[0].sent[0].Content!.Value0!.Reactor!.ReactorId.should.equal('healthy-start');
        });
        it('should log the failure against only the failing reactor', () => {
            logged.mock.calls.length.should.equal(1);
            logged.mock.calls[0][1].reactorId.should.equal('broken-start');
        });
        it('should back off instead of retrying during repeated registration', () => starts.should.equal(1));
        it('should retry the failing reactor without disturbing the healthy stream', async () => {
            await vi.advanceTimersByTimeAsync(2000);
            starts.should.equal(2);
            logged.mock.calls.length.should.equal(2);
            context.observe.mock.calls.length.should.equal(1);
            context.attempts[0].signal.aborted.should.be.false;
        });
    });
}
