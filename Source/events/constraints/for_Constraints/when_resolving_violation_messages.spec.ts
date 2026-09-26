// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { EventSequence } from '../../../eventSequences/EventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import { eventType } from '../../eventTypeDecorator.js';
import { constraint } from '../constraint.js';
import { Constraints } from '../Constraints.js';
import type { IConstraint } from '../IConstraint.js';
import type { IConstraintBuilder } from '../IConstraintBuilder.js';
import { unique } from '../unique.js';

const should = chai.should();
class Registered { email = ''; }
class OnlyOnce {}
eventType('message-registered')(Registered);
eventType('message-once')(OnlyOnce);
unique('SharedAddress', 'Address {email} already registered')(Registered.prototype, 'email');
unique('OneRegistration', 'Already registered')(OnlyOnce);

class FluentRegistration implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(OnlyOnce, 'Already registered', 'OneRegistration');
    }
}
constraint('FluentRegistration')(FluentRegistration);

class FluentAddress implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(uniqueBuilder => uniqueBuilder.on(Registered, event => event.email).withMessage('Address {email} already registered'));
    }
}
constraint('SharedAddress')(FluentAddress);

function constraints(types: Function[], constraintTypes: (new () => IConstraint)[] = []): Constraints {
    const artifacts = { eventTypes: types, constraints: constraintTypes } as IClientArtifactsProvider;
    return new Constraints('store', { constraints: { register: vi.fn() } } as unknown as ChronicleConnection, artifacts);
}

describe('when resolving violation messages', () => {
    it('should substitute detail values literally and preserve unknown violations', async () => {
        const discovered = constraints([Registered]);
        await discovered.discover();
        discovered.resolveMessageFor({ constraintId: 'SharedAddress', message: 'Kernel', details: { email: '$& $$ $` $\'' } }).message
            .should.equal('Address $& $$ $` $\' already registered');
        const violation = { constraintId: 'unknown', message: 'Kernel default', details: {} };
        discovered.resolveMessageFor(violation).should.equal(violation);
    });

    it('should resolve fluent withMessage values on append results', async () => {
        const discovered = constraints([Registered], [FluentAddress]);
        await discovered.discover();
        const connection = {
            eventSequences: { append: vi.fn().mockResolvedValue({ Response: {
                SequenceNumber: 0n, Errors: [], ConstraintViolations: [{
                    ConstraintId: 'SharedAddress', Message: 'Kernel default', Details: { email: 'a$b' }
                }]
            } }) }
        } as unknown as ChronicleConnection;
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'namespace', connection,
            {} as IUnitOfWorkManager, discovered.resolveMessageFor.bind(discovered));
        const result = await sequence.append('source', new Registered());
        result.constraintViolations[0].message.should.equal('Address a$b already registered');
    });

    it('should resolve a named fluent event type with a different class id', async () => {
        const discovered = constraints([], [FluentRegistration]);
        await discovered.discover();
        discovered.resolveMessageFor({ constraintId: 'OneRegistration', message: 'Kernel', details: {} }).message
            .should.equal('Already registered');
    });

    it('should resolve decorated event type messages on append results', async () => {
        const discovered = constraints([OnlyOnce]);
        await discovered.discover();
        const connection = {
            eventSequences: { append: vi.fn().mockResolvedValue({ Response: {
                SequenceNumber: 0n, Errors: [], ConstraintViolations: [{
                    ConstraintId: 'OneRegistration', Message: 'Kernel default', Details: {}
                }]
            } }) }
        } as unknown as ChronicleConnection;
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'namespace', connection,
            {} as IUnitOfWorkManager, discovered.resolveMessageFor.bind(discovered));
        const result = await sequence.append('source', new OnlyOnce());
        result.constraintViolations[0].message.should.equal('Already registered');
    });
});
