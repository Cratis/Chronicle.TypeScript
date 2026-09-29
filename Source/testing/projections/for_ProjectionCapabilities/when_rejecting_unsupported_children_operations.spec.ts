// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { AutoMap } from '@cratis/chronicle.contracts';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { ChildrenDefinitionLike } from '../../../projections/modelBound/childrenAndNestedBuilder.js';
import { childrenFrom } from '../../../projections/modelBound/childrenFrom.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';

chai.should();

class ChildAdded { itemId!: string; name!: string; }
field(String)(ChildAdded.prototype, 'itemId');
field(String)(ChildAdded.prototype, 'name');
eventType('capability-child-added')(ChildAdded);

type Wire = { Children: Record<string, ChildrenDefinitionLike>; RemovedWith: unknown[] };

function compileChildren() {
    const result = compileDeclarative(builder => {
        builder.from(Changed).children<{ lineId: string }>(model => model.labels as never, child => child
            .identifiedBy(line => line.lineId)
            .from(ChildAdded, from => from.usingKey(event => event.itemId)));
    }, [ChildAdded]);
    const wire = result.definition as unknown as Wire;
    return { ...result, wire, child: wire.Children.labels };
}

describe('when rejecting unsupported children operations before any event is seeded', () => {
    it('should accept the fixture-backed keyed children shape', () => {
        const { compiled, definition } = compileChildren();
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    const cases: Array<{ name: string; change: (child: ChildrenDefinitionLike, wire: Wire) => void; path: string; reason: string }> = [
        { name: 'a join inside children', change: child => { child.Join = [{}]; }, path: 'Children.labels.Join', reason: 'joins require a kernel-backed test' },
        { name: 'nested children collections', change: child => { child.Children = { inner: child }; }, path: 'Children.labels.Children', reason: 'nested children collections' },
        { name: 'nested projections inside children', change: child => { child.Nested = { inner: child }; }, path: 'Children.labels.Nested', reason: 'nested projections inside children' },
        { name: 'removedWithJoin inside children', change: child => { child.RemovedWithJoin = [child.RemovedWithJoin[0] ?? { Key: child.From[0].Key, Value: { Key: '' } }]; }, path: 'Children.labels.RemovedWithJoin', reason: 'removedWithJoin inside children' },
        { name: 'value children from an event property', change: child => { (child as unknown as Record<string, unknown>).FromEventProperty = { PropertyExpression: 'name' }; }, path: 'Children.labels.FromEventProperty', reason: 'value children from an event property' },
        { name: 'disabled child AutoMap', change: child => { child.AutoMap = AutoMap.Disabled; }, path: 'Children.labels.AutoMap', reason: 'AutoMap disabled' },
        { name: 'a child without an identifying property', change: child => { child.IdentifiedBy = '*NotSet*'; }, path: 'Children.labels.IdentifiedBy', reason: 'without a direct identifying property' },
        { name: 'an event-source-id child key', change: child => { child.From[0].Value.Key = '$eventSourceId'; }, path: 'Children.labels.From[capability-child-added:1].Key', reason: 'only a child key read from a string event property' },
        { name: 'an event-property parent key', change: child => { child.From[0].Value.ParentKey = 'itemId'; }, path: 'Children.labels.From[capability-child-added:1].ParentKey', reason: 'parent keys other than the event source id' },
        { name: 'a mapping into an untyped child', change: child => { child.From[0].Value.Properties = { name: 'name' }; }, path: 'Children.labels.From[capability-child-added:1].Properties.name', reason: 'mappings into an untyped child item schema' },
        { name: 'a child identifier mapped from another value', change: child => { child.From[0].Value.Properties = { lineId: 'name' }; }, path: 'Children.labels.From[capability-child-added:1].Properties.lineId', reason: 'mapping the child identifier from anything but the child key' },
        { name: 'a child event that also removes the parent', change: (child, wire) => { wire.RemovedWith = [{ Key: child.From[0].Key, Value: { Key: '$eventSourceId', ParentKey: '' } }]; }, path: 'Children.labels.From[capability-child-added:1]', reason: 'both removes and changes' },
        { name: 'one event that both adds and removes a child', change: child => { child.RemovedWith = [{ Key: child.From[0].Key, Value: { Key: 'itemId', ParentKey: '' } }]; }, path: 'Children.labels.RemovedWith[capability-child-added:1]', reason: 'more than one children operation' }
    ];
    for (const testCase of cases) {
        it(`should reject ${testCase.name} with its contract path and reason`, () => {
            const { compiled, definition, wire, child } = compileChildren();
            testCase.change(child, wire);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(testCase.path).and.includes(testCase.reason);
        });
    }

    it('should reject a children collection that does not target an array of objects', () => {
        const { compiled, definition } = compileModelBound(model => childrenFrom(ChildAdded, { key: 'itemId' })(model.prototype, 'name'), [ChildAdded]);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Children.name (@childrenFrom)').and.includes('must target an array of objects');
    });
});
