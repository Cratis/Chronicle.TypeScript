// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { ChronicleCallFailed, ensureCommandSuccess, ensureQuerySuccess, firstQueryResult, isCallSuccess } from './callResults';

const successfulResult = {
    ValidationResults: [],
    ExceptionMessages: [],
    AuthorizationFailureReason: ''
};

describe('callResults', () => {
    describe('when checking a successful result', () => {
        it('should report success', () => {
            expect(isCallSuccess(successfulResult)).toBe(true);
        });
    });

    describe('when checking a result with an authorization failure reason', () => {
        it('should report failure', () => {
            expect(isCallSuccess({ ...successfulResult, AuthorizationFailureReason: 'no access' })).toBe(false);
        });
    });

    describe('when checking a result with validation results', () => {
        it('should report failure', () => {
            expect(isCallSuccess({ ...successfulResult, ValidationResults: [{ Message: 'invalid', Members: [] }] })).toBe(false);
        });
    });

    describe('when checking a result with exception messages', () => {
        it('should report failure', () => {
            expect(isCallSuccess({ ...successfulResult, ExceptionMessages: ['boom'] })).toBe(false);
        });
    });

    describe('when ensuring a successful command', () => {
        it('should not throw', () => {
            expect(() => ensureCommandSuccess('operation', successfulResult)).not.toThrow();
        });
    });

    describe('when ensuring a failed command', () => {
        it('should throw with the failure reasons', () => {
            expect(() => ensureCommandSuccess('operation', { ...successfulResult, ExceptionMessages: ['boom'] }))
                .toThrow(ChronicleCallFailed);
            expect(() => ensureCommandSuccess('operation', { ...successfulResult, ExceptionMessages: ['boom'] }))
                .toThrow(/operation.*boom/);
        });
    });

    describe('when ensuring a successful query', () => {
        it('should return the data', () => {
            expect(ensureQuerySuccess('operation', { ...successfulResult, Data: ['a', 'b'] })).toEqual(['a', 'b']);
        });
    });

    describe('when ensuring a failed query', () => {
        it('should throw with the failure reasons', () => {
            expect(() => ensureQuerySuccess('operation', { ...successfulResult, AuthorizationFailureReason: 'no access', Data: [] }))
                .toThrow(/no access/);
        });
    });

    describe('when taking the first result from a stream', () => {
        it('should return the first item and cancel the stream', async () => {
            let cleanedUp = false;
            async function* stream() {
                try {
                    yield 'first';
                    yield 'second';
                } finally {
                    cleanedUp = true;
                }
            }

            const result = await firstQueryResult('operation', stream());
            expect(result).toBe('first');
            expect(cleanedUp).toBe(true);
        });
    });

    describe('when taking the first result from an empty stream', () => {
        it('should throw', async () => {
            async function* stream() { /* produces nothing */ }
            await expect(firstQueryResult('operation', stream())).rejects.toThrow(/completed without producing a result/);
        });
    });
});
