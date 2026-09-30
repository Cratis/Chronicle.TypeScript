// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { canonicalStringify } from './canonicalStringify.js';

chai.should();

describe('canonicalStringify', () => {
    it('should include recursively sorted mapping keys', () => {
        const definition = { From: [{ Value: { Properties: { name: 'title' }, Key: 'id' }, Key: { Id: 'Created' } }] };

        canonicalStringify(definition).should.equal('{"From":[{"Key":{"Id":"Created"},"Value":{"Key":"id","Properties":{"name":"title"}}}]}');
    });

    it('should produce the same serialization when object keys are reordered at any depth', () => {
        const first = { From: [{ Value: { Properties: { name: 'title', count: '$count' }, Key: 'id' } }], All: { AutoMap: 0 } };
        const reordered = { All: { AutoMap: 0 }, From: [{ Value: { Key: 'id', Properties: { count: '$count', name: 'title' } } }] };

        canonicalStringify(first).should.equal(canonicalStringify(reordered));
    });

    it('should preserve array order', () => {
        const first = { From: [{ Key: 'Created' }, { Key: 'Updated' }] };
        const reordered = { From: [{ Key: 'Updated' }, { Key: 'Created' }] };

        canonicalStringify(first).should.not.equal(canonicalStringify(reordered));
    });
});
