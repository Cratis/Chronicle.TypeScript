// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it, beforeEach } from 'vitest';
import { should } from 'chai';
import { NamedTag } from '../../../events/index.js';
import { NamedTagsWithRegisteredEventSourceNotSupported } from '../../NamedTagsWithRegisteredEventSourceNotSupported.js';
import { Account, a_sequence, NamedTagRecorded, registered_sources } from './given.fixture.js';

should();

const namedTags = [new NamedTag('tenant', 'alpha')];
const entry = () => ({ eventSourceId: 'source-1', event: new NamedTagRecorded(), eventSource: Account, namedTags });

for (const version of ['19.37.4', '19.37.4-development', '19.38.0', '20.0.0']) {
    describe(`when appending named tags with a registered source on kernel ${version}`, () => {
        let calls: ReturnType<typeof a_sequence>;

        beforeEach(async () => {
            calls = a_sequence(registered_sources());
            calls.getKernelVersion.mockResolvedValue(version);
            await calls.sequence.appendMany([entry()]);
        });

        it('should send the named-tag batch', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(1));
        it('should preserve the registered source', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls[0][0].Events[0].EventSource.should.equal('Account'));
    });
}

for (const version of ['19.37.3', '19.36.99', '1.0.0', undefined, '', 'unknown']) {
    describe(`when appending named tags with a registered source on kernel ${version ?? 'unknown'}`, () => {
        let calls: ReturnType<typeof a_sequence>;
        let error: unknown;

        beforeEach(async () => {
            calls = a_sequence(registered_sources());
            calls.getKernelVersion.mockResolvedValue(version);
            try {
                await calls.sequence.appendMany([entry()]);
            } catch (caught) {
                error = caught;
            }
        });

        it('should throw the public operation-specific error', () => (error instanceof NamedTagsWithRegisteredEventSourceNotSupported).should.equal(true));
        it('should mention the required kernel', () => (error as Error).message.should.contain('19.37.4'));
        it('should not send the batch', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(0));
        it('should not send a legacy batch', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(0));
        it('should not read a concurrency tail', () => calls.tailSequenceNumber.mock.calls.should.have.lengthOf(0));
    });

    describe(`when appending unaffected batches on kernel ${version ?? 'unknown'}`, () => {
        let calls: ReturnType<typeof a_sequence>;

        beforeEach(async () => {
            calls = a_sequence(registered_sources());
            calls.getKernelVersion.mockResolvedValue(version);
            await calls.sequence.appendMany([{ ...entry(), namedTags: [] }]);
            await calls.sequence.appendMany([{ ...entry(), eventSource: undefined }]);
            await calls.sequence.append('source-1', new NamedTagRecorded(), { eventSource: Account, namedTags });
        });

        it('should send the registered batch without tags', () => calls.appendManyForEventSources.mock.calls.should.have.lengthOf(1));
        it('should send the named-tag batch without a registered source', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(1));
        it('should send a single append with both', () => calls.appendWithNamedTags.mock.calls.should.have.lengthOf(1));
        it('should not need the kernel version', () => calls.getKernelVersion.mock.calls.should.have.lengthOf(0));
    });
}

for (const sharedSource of [false, true]) {
    describe(`when appending named tags and a ${sharedSource ? 'shared' : 'separate'} registered source on an older kernel`, () => {
        let calls: ReturnType<typeof a_sequence>;
        let error: unknown;

        beforeEach(async () => {
            calls = a_sequence(registered_sources());
            calls.getKernelVersion.mockResolvedValue('19.37.3');
            try {
                if (sharedSource) {
                    await calls.sequence.appendMany('source-1', [new NamedTagRecorded()], { eventSource: Account, namedTags });
                } else {
                    await calls.sequence.appendMany([{ ...entry(), eventSource: undefined }, { ...entry(), namedTags: [] }]);
                }
            } catch (caught) {
                error = caught;
            }
        });

        it('should reject the combination', () => (error instanceof NamedTagsWithRegisteredEventSourceNotSupported).should.equal(true));
        it('should not send', () => calls.appendManyForEventSourcesWithNamedTags.mock.calls.should.have.lengthOf(0));
    });
}
