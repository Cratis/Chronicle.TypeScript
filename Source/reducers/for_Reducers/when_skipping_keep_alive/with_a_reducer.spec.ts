// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { Reducers } from '../../Reducers.js';
import { reducer } from '../../reducer.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { ClientObserversRequireKeepAlive } from '../../../connection/ClientObserversRequireKeepAlive.js';
import { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';

chai.should();
@eventType('reducer-skip-item')
class Item {}
class Model {}
@reducer('late-reducer', undefined, Model)
class Observer { item() { return new Model(); } }

describe('when registering reducers while skipping keep alive', () => {
    for (const scenario of ['initial', 'late', 'discovered', 'default']) {
        it(`should enforce the keep alive requirement for ${scenario} registration`, async () => {
            const observe = vi.fn().mockImplementation(async function* () {});
            const registerMany = vi.fn().mockResolvedValue({});
            const artifacts: IClientArtifactsProvider = { eventTypes: [Item], reducers: scenario === 'initial' ? [Observer] : [],
                reactors: [], readModels: [Model], seeders: [], constraints: [], projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: [] };
            const lifecycle = new ConnectionLifecycle();
            const connection = { reducers: { observe }, readModels: { registerMany } } as unknown as ChronicleConnection;
            const manager = new Reducers(artifacts, connection, 'store', 'Default', lifecycle, 'sink',
                undefined, undefined, undefined, scenario !== 'default');
            try {
                if (scenario !== 'initial') {
                    await manager.register();
                    artifacts.reducers.push(Observer);
                    await lifecycle.disconnected(() => {});
                    if (scenario === 'discovered') await manager.discover();
                }
                const [result] = await Promise.allSettled([manager.register()]);
                result.status.should.equal(scenario === 'default' ? 'fulfilled' : 'rejected');
                if (result.status === 'rejected') {
                    result.reason.should.be.instanceOf(ClientObserversRequireKeepAlive);
                    result.reason.observerKind.should.equal('Reducer');
                    result.reason.observerId.should.equal('late-reducer');
                    observe.mock.calls.should.have.lengthOf(0);
                    registerMany.mock.calls.should.have.lengthOf(0);
                } else {
                    observe.mock.calls.should.have.lengthOf(1);
                    registerMany.mock.calls.should.have.lengthOf(1);
                }
            } finally { manager.dispose(); }
        });
    }
});
