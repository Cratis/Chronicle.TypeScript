// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { eventType } from '../../../../events/eventTypeDecorator.js';

export class Changed { name!: string; quantity!: number; labels!: string[]; details!: object; }
field(String)(Changed.prototype, 'name');
field(Number)(Changed.prototype, 'quantity');
field(Array)(Changed.prototype, 'labels');
field(Object)(Changed.prototype, 'details');
eventType('capability-changed')(Changed);
