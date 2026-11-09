// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { ChildrenPlacement, SortDirection } from '../../childrenOrdering.js';
import { compileModelBound } from '../../for_ProjectionDefinitionCompiler/given/compile_model_bound.js';
import { childrenFrom } from '../childrenFrom.js';
import { ConflictingChildrenOrdering } from '../ConflictingChildrenOrdering.js';

chai.should();

class LineAdded {
    lineId = '';
    position = 0;
}
eventType()(LineAdded);

class LineImported {
    lineId = '';
    position = 0;
}
eventType()(LineImported);

class Line {
    lineId = '';
    position = 0;
}
field(String)(Line.prototype, 'lineId');
field(Number)(Line.prototype, 'position');

const orderingOf = (configure: (target: object) => void) => {
    class Order {
        id = '';
        lines: Line[] = [];
    }
    field(String)(Order.prototype, 'id');
    configure(Order.prototype);
    const { definition } = compileModelBound(Order);
    return (definition.Children.lines as unknown as { Ordering?: unknown }).Ordering;
};

describe('when children declare no ordering', () => {
    it('should leave the ordering out of the definition', () => {
        const ordering = orderingOf(target => childrenFrom(LineAdded, { childType: Line, key: 'lineId' })(target, 'lines'));
        (ordering === undefined).should.be.true;
    });
});

describe('when children are prepended', () => {
    it('should place new children first', () => orderingOf(target =>
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', prepend: true })(target, 'lines'))!.should.deep.equal({
        Placement: ChildrenPlacement.Prepend, SortBy: '', Direction: SortDirection.Ascending
    }));
});

describe('when children are ordered by a property', () => {
    it('should sort new children ascending by it', () => orderingOf(target =>
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', orderBy: 'position' })(target, 'lines'))!.should.deep.equal({
        Placement: ChildrenPlacement.Sorted, SortBy: 'position', Direction: SortDirection.Ascending
    }));
});

describe('when children are ordered descending by a property on one of several creating events', () => {
    it('should sort new children descending by it', () => orderingOf(target => {
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', orderByDescending: 'position' })(target, 'lines');
        childrenFrom(LineImported, { childType: Line, key: 'lineId' })(target, 'lines');
    })!.should.deep.equal({ Placement: ChildrenPlacement.Sorted, SortBy: 'position', Direction: SortDirection.Descending }));
});

describe('when every creating event declares the same ordering', () => {
    it('should use it', () => orderingOf(target => {
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', orderBy: 'position' })(target, 'lines');
        childrenFrom(LineImported, { childType: Line, key: 'lineId', orderBy: 'position' })(target, 'lines');
    })!.should.deep.equal({ Placement: ChildrenPlacement.Sorted, SortBy: 'position', Direction: SortDirection.Ascending }));
});

describe('when creating events declare different orderings', () => {
    it('should reject the conflict', () => (() => orderingOf(target => {
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', orderBy: 'position' })(target, 'lines');
        childrenFrom(LineImported, { childType: Line, key: 'lineId', prepend: true })(target, 'lines');
    })).should.throw(ConflictingChildrenOrdering, "'lines'"));
});

describe('when one creating event declares more than one ordering', () => {
    it('should reject the conflict', () => (() => orderingOf(target =>
        childrenFrom(LineAdded, { childType: Line, key: 'lineId', prepend: true, orderBy: 'position' })(target, 'lines')
    )).should.throw(ConflictingChildrenOrdering));
});
