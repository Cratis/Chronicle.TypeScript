// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { ChronicleCallFailed } from '../../../connection/callResults.js';
import type { IPatterns } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

const should = chai.should();
const queries: Record<string, (patterns: IPatterns) => Promise<unknown[]>> = {
    matching: patterns => patterns.getPatterns('user-42', {}),
    actions: patterns => patterns.getUsualActions('user-42', {}),
    moment: patterns => patterns.getPatternsAt('user-42'),
    scope: patterns => patterns.getPatternsForScope('user-42'),
    scopes: patterns => patterns.getScopes()
};

for (const [name, query] of Object.entries(queries)) {
    describe(`when querying ${name} with no established behavior`, () => {
        let result: unknown[];
        beforeEach(async () => result = await query(new a_patterns_service().patterns));
        it('should return an empty answer without inventing behavior', () => result.should.deep.equal([]));
    });

    for (const failureKind of ['authorization', 'validation', 'exception', 'transport']) {
        describe(`when querying ${name} with a ${failureKind} failure`, () => {
            let failure: unknown;
            const transportFailure = new Error('transport unavailable');
            beforeEach(async () => {
                const context = new a_patterns_service();
                for (const response of [context.response, context.scopesResponse]) {
                    if (failureKind === 'authorization') response.IsAuthorized = false;
                    if (failureKind === 'validation') response.ValidationResults = [{ Severity: 3, Message: 'invalid context', Members: [] }];
                    if (failureKind === 'exception') response.ExceptionMessages = ['query failed'];
                }
                if (failureKind === 'transport') {
                    for (const client of Object.values(context.client)) client.mockRejectedValue(transportFailure);
                }
                try { await query(context.patterns); } catch (error) { failure = error; }
            });
            it('should reject instead of disguising failure as no behavior', () => {
                if (failureKind === 'transport') should.equal(failure, transportFailure);
                else (failure as Error).should.be.instanceOf(ChronicleCallFailed);
            });
        });
    }
}
