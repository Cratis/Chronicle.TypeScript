// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { beforeAll, chai, describe, it } from 'vitest';
import type { Constraint } from '@cratis/chronicle.contracts';
import { EventSequenceId } from '../../../../eventSequences/EventSequenceId.js';
import { eventType } from '../../../eventTypeDecorator.js';
import { unique } from '../../unique.js';
import { registeredConstraints } from './given/registered_constraints.js';

chai.should();

@eventType('legacy-account-opened')
@unique({ name: 'legacy-one-account', message: 'Already opened', eventSequences: [EventSequenceId.eventLog] })
class AccountOpened { @field(String) label = ''; }

@eventType('legacy-account-noted')
@unique('legacy-unscoped-account')
class AccountNoted { @field(String) label = ''; }

@eventType('legacy-email-registered')
class EmailRegistered {
    @field(String) @unique({ name: 'legacy-email', eventSequences: ['event-log'] }) email = '';
    @field(String) @unique({ name: 'legacy-alias' }) alias = '';
}

@eventType('legacy-email-forwarded')
class EmailForwarded {
    @field(String) @unique({ name: 'legacy-email', eventSequences: ['outbox'] }) email = '';
    @field(String) @unique({ name: 'legacy-alias', eventSequences: ['outbox'] }) alias = '';
}

describe('when scoping legacy unique decorators to event sequences', () => {
    let registered: Map<string, Constraint>;
    beforeAll(async () => { registered = await registeredConstraints([], [AccountOpened, AccountNoted, EmailRegistered, EmailForwarded]); });

    it('should register a decorated event type for the declared event sequences', () =>
        registered.get('legacy-one-account')!.EventSequences.should.deep.equal(['event-log']));
    it('should register the positional form for every event sequence', () =>
        registered.get('legacy-unscoped-account')!.EventSequences.should.deep.equal([]));
    it('should combine the event sequences of properties sharing a constraint name', () =>
        registered.get('legacy-email')!.EventSequences.should.deep.equal(['event-log', 'outbox']));
    it('should keep a shared constraint applying everywhere when one property names no event sequence', () =>
        registered.get('legacy-alias')!.EventSequences.should.deep.equal([]));
});
