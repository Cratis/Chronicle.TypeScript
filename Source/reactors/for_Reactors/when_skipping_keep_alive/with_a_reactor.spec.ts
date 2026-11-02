// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { Reactors } from '../../Reactors.js';
import { reactor } from '../../reactor.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { ClientObserversRequireKeepAlive } from '../../../connection/ClientObserversRequireKeepAlive.js';
import { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { IEventLog } from '../../../eventSequences/IEventLog.js';

chai.should();
@eventType('reactor-skip-item')
class Item {}
@reactor('late-reactor')
class Observer { item() {} }

describe('when registering reactors while skipping keep alive', () => {
    for (const scenario of ['initial', 'late', 'discovered', 'default']) {
        it(`should enforce the keep alive requirement for ${scenario} registration`, async () => {
            const observe = vi.fn().mockImplementation(async function* () {});
            const artifacts: IClientArtifactsProvider = { eventTypes: [Item], reactors: scenario === 'initial' ? [Observer] : [],
                reducers: [], readModels: [], seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] };
            const lifecycle = new ConnectionLifecycle();
            const connection = { reactors: { observe } } as unknown as ChronicleConnection;
            const manager = new Reactors(artifacts, connection, 'store', 'Default', lifecycle, {} as IEventLog,
                undefined, undefined, undefined, scenario !== 'default');
            try {
                if (scenario !== 'initial') {
                    await manager.register();
                    artifacts.reactors.push(Observer);
                    await lifecycle.disconnected(() => {});
                    if (scenario === 'discovered') await manager.discover();
                }
                const [result] = await Promise.allSettled([manager.register()]);
                result.status.should.equal(scenario === 'default' ? 'fulfilled' : 'rejected');
                if (result.status === 'rejected') {
                    result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
                    result.reason.observerKind.should.equal('Reactor');
                    result.reason.observerId.should.equal('late-reactor');
                    observe.mock.calls.should.have.lengthOf(0);
                } else observe.mock.calls.should.have.lengthOf(1);
            } finally { manager.dispose(); }
        });
    }
});
