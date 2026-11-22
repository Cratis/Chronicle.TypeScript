// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { fieldKeyMeasurements } from './field_key_measurements.fixture.js';

@eventType('OracleFieldText')
class TextClaimed { @field(String) key = ''; }
@eventType('OracleFieldDecimal')
class DecimalClaimed { @field(Number) key = 0.1; }
@eventType('OracleFieldFloat')
class FloatClaimed { @field(Number) key = 0.1; }

fieldKeyMeasurements({ text: TextClaimed, decimal: DecimalClaimed, float: FloatClaimed });
