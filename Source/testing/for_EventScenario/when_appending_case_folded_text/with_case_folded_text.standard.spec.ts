// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { caseFoldedText } from './case_folded_text.fixture.js';

@eventType('OracleFieldText')
class TextClaimed { @field(String) key = ''; }
@eventType('OracleCasingPair')
class PairClaimed { @field(String) key = ''; @field(String) other = ''; }

caseFoldedText({ text: TextClaimed, pair: PairClaimed });
