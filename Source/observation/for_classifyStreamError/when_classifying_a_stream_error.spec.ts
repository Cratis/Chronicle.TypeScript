// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClientError, Status } from 'nice-grpc';
import { chai, describe, it } from 'vitest';
import { classifyStreamError, StreamErrorKind } from '../classifyStreamError.js';

chai.should();

const sessionLost = () => new ClientError('/Reactors/Observe', Status.UNKNOWN, 'ClientIsNotConnected: connection 42 is not connected');
const abort = () => Object.assign(new Error('The operation has been aborted'), { name: 'AbortError' });

describe('when classifying a stream error', () => {
    const cases: [string, unknown, StreamErrorKind][] = [
        ['the kernel no longer knows the connection', sessionLost(), StreamErrorKind.SessionLost],
        ['the message names the lost connection', Object.assign(new Error('ClientIsNotConnected'), { code: Status.INTERNAL }), StreamErrorKind.SessionLost],
        ['the lost connection is wrapped', new Error('stream failed', { cause: sessionLost() }), StreamErrorKind.SessionLost],
        ['every wrapped error lost the session or connection',
            new AggregateError([sessionLost(), new ClientError('/x', Status.UNAVAILABLE, '')]), StreamErrorKind.SessionLost],
        ['a wrapped error is a failure of its own',
            new AggregateError([sessionLost(), new ClientError('/x', Status.INTERNAL, 'boom')]), StreamErrorKind.Failure],
        ['the kernel is unreachable', new ClientError('/x', Status.UNAVAILABLE, 'ClientIsNotConnected'), StreamErrorKind.ConnectionLost],
        ['the call was cancelled', new ClientError('/x', Status.CANCELLED, ''), StreamErrorKind.Cancelled],
        ['the client aborted the stream', abort(), StreamErrorKind.Cancelled],
        ['the stream failed for another reason', new ClientError('/x', Status.INTERNAL, 'boom'), StreamErrorKind.Failure],
        ['the error is not an object', 'boom', StreamErrorKind.Failure]
    ];

    for (const [scenario, error, kind] of cases) {
        it(`should classify as ${kind} when ${scenario}`, () => classifyStreamError(error).should.equal(kind));
    }
});
