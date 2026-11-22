// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { reactor } from '../../../reactor.js';
import { ReactorId } from '../../../ReactorId.js';

@reactor('on-custom', 'custom')
export class OnCustomSequence { handle() {} }

@reactor('on-log')
export class OnEventLog { handle() {} }

export class NotAReactor {}

export const request = (observerId: string, eventSequenceId: string) =>
    ({ EventStore: 'store', Namespace: 'tenant', ObserverId: observerId, EventSequenceId: eventSequenceId });

export { ReactorId };
