// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { FacetName } from '../../index.js';
import { a_patterns_service } from '../given/a_patterns_service.fixture.js';

chai.should();

for (const method of ['getPatterns', 'getUsualActions'] as const) {
    for (const limited of [false, true]) {
        describe(`when ${method} queries facets ${limited ? 'with explicit limits' : 'with server defaults'}`, () => {
            let context: a_patterns_service;
            beforeEach(async () => {
                context = new a_patterns_service();
                await context.patterns[method]('user-42', {
                    [FacetName.CommandType]: 'RegisterInvoice',
                    [FacetName.AggregateType]: '',
                    CustomFacet: 'custom-value'
                }, limited ? { minimumConfidence: 0.75, maximumResults: 3 } : undefined);
            });
            it('should scope the query and omit unspecified facet values', () => {
                const client = method === 'getPatterns' ? context.client.matchingPatterns : context.client.usualActions;
                client.mock.calls[0][0].should.deep.equal({
                    EventStore: 'accounts', Namespace: 'tenant-a', GroupingKey: 'user-42',
                    Context: { CommandType: 'RegisterInvoice', CustomFacet: 'custom-value' },
                    MinimumConfidence: limited ? 0.75 : 0, MaximumResults: limited ? 3 : 0
                });
            });
        });
    }
}
