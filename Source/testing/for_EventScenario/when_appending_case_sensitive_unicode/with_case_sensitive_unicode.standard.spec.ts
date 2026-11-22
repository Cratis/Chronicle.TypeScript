// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { caseSensitiveUnicode } from './case_sensitive_unicode.fixture.js';

@eventType('OracleFieldText')
class TextClaimed { @field(String) key = ''; }
@eventType('OracleUnicodePair')
class PairClaimed { @field(String) key = ''; @field(String) other = ''; }
@eventType('OracleUnicodeSibling')
class SiblingClaimed { @field(String) key = ''; }

caseSensitiveUnicode({ text: TextClaimed, pair: PairClaimed, sibling: SiblingClaimed });
