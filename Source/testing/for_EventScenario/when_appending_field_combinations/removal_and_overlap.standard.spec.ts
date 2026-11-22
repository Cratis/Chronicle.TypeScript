// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, Guid } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { removalAndOverlapBehaviors } from './removal_and_overlap_behaviors.fixture.js';

@eventType('OracleCombinedNumber')
class NumberKey {
    @field(Number) key = -7;
    @field(String) suffix = 'Alpha';
    @field(Guid) identifier = Guid.parse('abcdef01-abcd-abcd-abcd-abcdef012345');
}
@eventType('OracleCombinedGuid')
class GuidKey {
    @field(Guid) key = Guid.parse('abcdef01-abcd-abcd-abcd-abcdef012345');
    @field(String) suffix = 'Alpha';
    @field(Number) amount = -7;
}
@eventType('OracleCombinedText')
class TextKey { @field(String) key = ''; }
@eventType('OracleCombinedBoolean')
class BooleanKey { @field(Boolean) key = true; }
@eventType('OracleCombinedRemoved')
class Removed { }

describe('when appending fieldless removals and overlapping definitions with standard decorators', () => {
    removalAndOverlapBehaviors({ number: NumberKey, guid: GuidKey, string: TextKey, boolean: BooleanKey, removed: Removed });
});
