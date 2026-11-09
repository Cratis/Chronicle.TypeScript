// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { ChildrenPlacement, SortDirection } from '../../childrenOrdering.js';
import { ChildrenBuilder } from '../ChildrenBuilder.js';
import { ChildrenOrderingAlreadyDefined } from '../ChildrenOrderingAlreadyDefined.js';

chai.should();

class Order {
    lines!: Line[];
}

class Line {
    lineId!: string;
    position!: number;
    product!: { name: string };
}

const build = (configure: (builder: ChildrenBuilder<Order, Line>) => void) => {
    const builder = new ChildrenBuilder<Order, Line>();
    configure(builder);
    return builder.buildDefinition();
};

describe('when building children without an ordering', () => {
    it('should leave the ordering out of the definition', () => build(_ => _.identifiedBy(m => m.lineId)).should.not.have.property('Ordering'));
});

describe('when prepending children', () => {
    it('should place new children first', () => build(_ => _.prepend()).Ordering!.should.deep.equal({
        Placement: ChildrenPlacement.Prepend, SortBy: '', Direction: SortDirection.Ascending
    }));
});

describe('when ordering children by a property', () => {
    it('should sort new children ascending by the property', () => build(_ => _.orderBy(m => m.position)).Ordering!.should.deep.equal({
        Placement: ChildrenPlacement.Sorted, SortBy: 'position', Direction: SortDirection.Ascending
    }));
});

describe('when ordering children descending by a nested property', () => {
    it('should sort new children descending by the property path', () => build(_ => _.orderByDescending(m => m.product.name)).Ordering!.should.deep.equal({
        Placement: ChildrenPlacement.Sorted, SortBy: 'product.name', Direction: SortDirection.Descending
    }));
});

describe('when ordering children twice', () => {
    it('should reject the second ordering', () =>
        (() => build(_ => _.prepend().orderBy(m => m.position))).should.throw(ChildrenOrderingAlreadyDefined));
});
