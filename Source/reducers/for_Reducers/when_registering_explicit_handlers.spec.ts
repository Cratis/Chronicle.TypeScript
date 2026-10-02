// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, reducer, Reducers } from '../index.js';

chai.should();

@eventType('reducer-handled-event')
class AuthorRegistered {}
@eventType('unselected-reducer-event')
class Unregistered {}

@reducer('valid-handlers')
class Valid { @handles(AuthorRegistered) update() {} }
@reducer('missing-handler-event')
class Missing { @handles(Unregistered) update() {} }
@reducer('duplicate-handlers')
class Duplicate {
    @handles(AuthorRegistered) update() {}
    authorRegistered() {}
}

for (const [type, message] of [
    [Missing, /update.*Missing.*Unregistered.*no registered event type/],
    [Duplicate, /multiple handlers.*reducer-handled-event.*update.*authorRegistered/]
] as const) {
    describe(`when registering a reducer with invalid explicit handlers on ${type.name}`, () => {
        const observe = vi.fn();
        const registerMany = vi.fn();
        let error: unknown;
        beforeEach(async () => {
            observe.mockReset();
            registerMany.mockReset();
            error = undefined;
            const artifacts = { reducers: [Valid, type], eventTypes: [AuthorRegistered], readModels: [] } as unknown as IClientArtifactsProvider;
            const connection = { reducers: { observe }, readModels: { registerMany } } as unknown as ChronicleConnection;
            const reducers = new Reducers(artifacts, connection, 'store', 'tenant', new ConnectionLifecycle(), 'sink');
            try { await reducers.register(); } catch (caught) { error = caught; }
            finally { reducers.dispose(); }
        });
        it('should reject registration with an actionable error', () => {
            (error instanceof Error).should.be.true;
            (error as Error).message.should.match(message);
        });
        it('should not register read models before validating all handlers', () => {
            registerMany.mock.calls.should.have.lengthOf(0);
        });
        it('should not start an observation before validating all reducers', () => {
            observe.mock.calls.should.have.lengthOf(0);
        });
    });
}
