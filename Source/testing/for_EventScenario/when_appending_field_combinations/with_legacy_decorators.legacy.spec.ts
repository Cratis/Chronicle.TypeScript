// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field, Guid } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { combinationBehaviors } from './combination_behaviors.fixture.js';
import { definitionRejectionBehaviors } from './definition_rejection_behaviors.fixture.js';

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
@eventType('OracleCombinedRemoved')
class Removed { @field(String) label = ''; }
@eventType('OracleCombinedBoolean')
class Flag { @field(Boolean) key = true; }
@eventType('OracleCombinedFieldless')
class Fieldless { }

describe('when appending combined Guid/numeric keys with legacy decorators', () => {
    combinationBehaviors({ number: NumberKey, guid: GuidKey, string: TextKey, removed: Removed });
    definitionRejectionBehaviors({ number: NumberKey, guid: GuidKey, text: TextKey, removed: Removed, flag: Flag, fieldless: Fieldless });
});
