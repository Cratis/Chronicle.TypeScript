// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { afterAll, beforeAll, chai, describe, it } from 'vitest';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fromEvent } from '../../../projections/index.js';
import { readModelReactor } from '../../readModelReactor.js';
import type { IReadModelWatcher } from '../../IReadModelWatcher.js';
import type { IReadModelReactors } from '../../IReadModelReactors.js';
import type { ReadModelChangeset } from '../../ReadModelChangeset.js';

chai.should();
const connectionString = process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING;
@eventType('read-model-reactor-name-changed')
class NameChanged { @field(String) name = ''; }
@eventType('read-model-reactor-reaction-recorded')
class ReactionRecorded { @field(String) name = ''; }
@fromEvent(NameChanged)
class WatchedName { @field(String) name = ''; }
@fromEvent(ReactionRecorded)
class RecordedReaction { @field(String) name = ''; }

describe.skipIf(!connectionString && !process.env.CI)('when reacting to a projection change against a kernel', () => {
    const storeName = `Reactors${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const namespace = `tenant-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    const source = randomUUID();
    const target = randomUUID();
    const failures: unknown[] = [];
    let leases = 0;
    let completed = 0;
    let released = 0;
    let client: ChronicleClient;
    let watcher: IReadModelWatcher<RecordedReaction>;
    let reactors: IReadModelReactors;
    let observed: ReadModelChangeset<RecordedReaction>;

    @readModelReactor(WatchedName, 'record-projection-change')
    class RecordChange {
        constructor(private readonly destination: string) {}
        added(model: WatchedName, change: ReadModelChangeset<WatchedName>) {
            model.should.be.instanceOf(WatchedName);
            change.namespace.should.equal(namespace);
            return { eventSourceId: this.destination, event: Object.assign(new ReactionRecorded(), { name: model.name }) };
        }
    }
    const artifacts: IClientArtifactsProvider = {
        eventTypes: [NameChanged, ReactionRecorded], readModels: [WatchedName, RecordedReaction], readModelReactors: [RecordChange],
        projections: [], reactors: [], reducers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    };

    beforeAll(async () => {
        client = new ChronicleClient(ChronicleOptions.fromConnectionString(connectionString!, {
            discoveryPatterns: [], clientArtifactsProvider: artifacts,
            readModelReactorActivator: async () => {
                leases++;
                return { instance: new RecordChange(target) as never, complete() { completed++; }, dispose() { released++; } };
            },
            readModelReactorOnError: error => { failures.push(error); }
        }));
        // Store registration must await the reactor subscription before this append.
        const store = await client.getEventStore(storeName, namespace);
        reactors = store.readModelReactors!;
        // Chronicle 19.188 refuses a watch on a store it registered only an instant ago (PERMISSION_DENIED), so retry briefly.
        const watchDeadline = Date.now() + 30_000;
        for (;;) {
            watcher = store.readModels.createWatcher(RecordedReaction, { signal: AbortSignal.timeout(60_000) });
            try {
                await watcher.subscribed;
                break;
            } catch (error) {
                watcher.dispose();
                if (Date.now() > watchDeadline) throw error;
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        const result = await store.eventLog.append(source, Object.assign(new NameChanged(), { name: 'observed effect' }));
        result.isSuccess.should.be.true;
        const next = await watcher[Symbol.asyncIterator]().next();
        if (next.done) throw new Error('Effect watcher ended before receiving the reactor side effect.');
        observed = next.value;
        reactors.stop();
        await reactors.completion;
    });
    afterAll(async () => {
        watcher?.dispose();
        client?.dispose();
        if (reactors) await reactors.completion;
    });
    it('should append the returned effect to its explicit source in the change namespace', () => {
        observed.readModel.should.be.instanceOf(RecordedReaction);
        observed.readModel.name.should.equal('observed effect');
        observed.key.should.equal(target);
        observed.namespace.should.equal(namespace);
    });
    it('should complete and release the dependency-aware activation exactly once', () => {
        leases.should.equal(1);
        completed.should.equal(1);
        released.should.equal(1);
        failures.should.have.lengthOf(0);
    });
});
