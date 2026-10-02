// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventSourceType, eventStreamType, filterEventsByTag, tag } from '../../../index.js';
import { filterRegistrationBehaviors } from './filter_registration_behaviors.fixture.js';

class Unfiltered {}
@eventSourceType('Customers')
class SourceFiltered {}
@eventStreamType('Orders')
class StreamFiltered {}
@eventSourceType('Customers')
@eventStreamType('Orders')
@filterEventsByTag('vip')
@filterEventsByTag('priority')
@tag('Analytics')
class Combined {}
class Inherited extends Combined {}
@eventSourceType('')
@eventStreamType('All')
class Reset extends Combined {}

filterRegistrationBehaviors([
    { type: Unfiltered, source: '', stream: 'All', tags: [] },
    { type: SourceFiltered, source: 'Customers', stream: 'All', tags: [] },
    { type: StreamFiltered, source: '', stream: 'Orders', tags: [] },
    { type: Combined, source: 'Customers', stream: 'Orders', tags: ['priority', 'vip'] },
    { type: Inherited, source: 'Customers', stream: 'Orders', tags: ['priority', 'vip'] },
    { type: Reset, source: '', stream: 'All', tags: ['priority', 'vip'] }
]);
