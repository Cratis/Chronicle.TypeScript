// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { chai, describe, it } from 'vitest';
import { ChildrenOrderingNotSupportedByContracts } from '../ChildrenOrderingNotSupportedByContracts.js';
import { prependOrdering } from '../childrenOrdering.js';
import { ensureChildrenOrderingIsSupported } from '../childrenOrderingSupport.js';

chai.should();

const definitionWith = (children: Record<string, unknown>, nested: Record<string, unknown> = {}) =>
    ({ Identifier: 'orders', Children: children, Nested: nested }) as unknown as ProjectionDefinition;

describe('when the contracts cannot carry children ordering', () => {
    it('should accept a projection without ordered children', () =>
        (() => ensureChildrenOrderingIsSupported(definitionWith({ lines: { Children: {}, Nested: {} } }), false)).should.not.throw());

    it('should reject ordered children with the projection and path', () =>
        (() => ensureChildrenOrderingIsSupported(definitionWith({ lines: { Ordering: prependOrdering() } }), false))
            .should.throw(ChildrenOrderingNotSupportedByContracts, "Projection 'orders' orders the children at 'Children.lines'"));

    it('should reject ordered children inside a nested object', () =>
        (() => ensureChildrenOrderingIsSupported(definitionWith({}, { summary: { Children: { lines: { Ordering: prependOrdering() } } } }), false))
            .should.throw(ChildrenOrderingNotSupportedByContracts, "'Nested.summary.Children.lines'"));

    it('should reject ordered grandchildren', () =>
        (() => ensureChildrenOrderingIsSupported(definitionWith({ lines: { Children: { notes: { Ordering: prependOrdering() } } } }), false))
            .should.throw(ChildrenOrderingNotSupportedByContracts, "'Children.lines.Children.notes'"));
});

describe('when the contracts carry children ordering', () => {
    it('should accept ordered children', () =>
        (() => ensureChildrenOrderingIsSupported(definitionWith({ lines: { Ordering: prependOrdering() } }), true)).should.not.throw());
});
