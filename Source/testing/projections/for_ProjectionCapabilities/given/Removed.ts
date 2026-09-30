// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventType } from '../../../../events/eventTypeDecorator.js';

export class Removed {}
eventType('capability-removed')(Removed);
