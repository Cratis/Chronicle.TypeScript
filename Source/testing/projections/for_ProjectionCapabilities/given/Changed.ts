// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';

export class Changed { name!: string; quantity!: number; }
field(String)(Changed.prototype, 'name');
field(Number)(Changed.prototype, 'quantity');
eventType('capability-changed')(Changed);
