// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { otherSequenceExtendedKeyBehaviors } from './other_sequence_extended_key_behaviors.fixture.js';

@eventType('OracleOtherSequenceNumber')
class NumberClaimed { @field(Number) key = 1; }
@eventType('OracleOtherSequenceOutbox')
class OutboxClaimed { @field(String) label = 'x'; }

@constraint('OracleOtherSequenceNumberKey')
class NumberKey {
    define(builder: IConstraintBuilder) { builder.forEventLog().unique(key => key.on(NumberClaimed, event => event.key)); }
}
@constraint('OracleOtherSequenceOutboxKey')
class OutboxKey {
    define(builder: IConstraintBuilder) { builder.forEventSequences('outbox').unique(key => key.on(OutboxClaimed, event => event.label)); }
}

describe('when appending extended keys beside other event sequence constraints with  decorators', () => {
    otherSequenceExtendedKeyBehaviors(NumberClaimed, OutboxClaimed, [NumberKey, OutboxKey]);
});
