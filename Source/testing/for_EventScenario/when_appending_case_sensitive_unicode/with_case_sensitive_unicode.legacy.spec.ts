// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { caseSensitiveUnicode } from './case_sensitive_unicode.fixture.js';

class TextClaimed { @field(String) key = ''; }
eventType('OracleFieldText')(TextClaimed);
class PairClaimed { @field(String) key = ''; @field(String) other = ''; }
eventType('OracleUnicodePair')(PairClaimed);
class SiblingClaimed { @field(String) key = ''; }
eventType('OracleUnicodeSibling')(SiblingClaimed);

caseSensitiveUnicode({ text: TextClaimed, pair: PairClaimed, sibling: SiblingClaimed });
