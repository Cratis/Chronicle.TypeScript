// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../artifacts/index.js';
import type { ChronicleConnection } from '../../connection/index.js';
import { ConnectionLifecycle } from '../../connection/ConnectionLifecycle.js';
import type { IEventLog } from '../../eventSequences/IEventLog.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { handles, reactor, Reactors } from '../index.js';

chai.should();

@eventType('registration-handled-event')
class AuthorRegistered {}
@eventType('unselected-handled-event')
class Unregistered {}

@reactor('valid-handlers')
class Valid { @handles(AuthorRegistered) notify() {} }
@reactor('missing-handler-event')
class Missing { @handles(Unregistered) notify() {} }
@reactor('duplicate-handlers')
class Duplicate {
    @handles(AuthorRegistered) notify() {}
    authorRegistered() {}
}

for (const [type, message] of [
    [Missing, /notify.*Missing.*Unregistered.*no registered event type/],
    [Duplicate, /multiple handlers.*registration-handled-event.*notify.*authorRegistered/]
] as const) {
    describe(`when registering a reactor with invalid explicit handlers on ${type.name}`, () => {
        const observe = vi.fn();
        let error: unknown;
        beforeEach(async () => {
            observe.mockReset();
            error = undefined;
            const artifacts = { reactors: [Valid, type], eventTypes: [AuthorRegistered] } as unknown as IClientArtifactsProvider;
            const connection = { reactors: { observe } } as unknown as ChronicleConnection;
            const reactors = new Reactors(artifacts, connection, 'store', 'tenant', new ConnectionLifecycle(), {} as IEventLog);
            try { await reactors.register(); } catch (caught) { error = caught; }
            finally { reactors.dispose(); }
        });
        it('should reject registration with an actionable error', () => {
            (error instanceof Error).should.be.true;
            (error as Error).message.should.match(message);
        });
        it('should not start any observation before validating all reactors', () => {
            observe.mock.calls.should.have.lengthOf(0);
        });
    });
}
