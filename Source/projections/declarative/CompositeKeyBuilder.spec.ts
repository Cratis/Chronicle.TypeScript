// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator';
import { ProjectionBuilderFor } from './ProjectionBuilderFor';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class OrderLineAdded {
    orderId!: string;
    lineNumber!: number;
    quantity!: number;
}
eventType()(OrderLineAdded);

class OrderLineJoined {
    orderId!: string;
    lineNumber!: number;
    description!: string;
}
eventType()(OrderLineJoined);

class CompositeKey {
    orderId!: string;
    lineNumber!: number;
}

class OrderLine {
    id!: string;
    quantity!: number;
    description!: string;
}

interface FromRecord {
    Key: { Id: string };
    Value: { Key: string };
}

interface JoinRecord {
    Key: { Id: string };
    Value: { Key: string };
}

interface JoinRecordWithParentKey {
    Key: { Id: string };
    Value: { Key: string; ParentKey?: string };
}

describe('CompositeKeyBuilder', () => {
    describe('when using a composite key on a from builder', () => {
        it('should produce a $composite expression', () => {
            const builder = new ProjectionBuilderFor<OrderLine>();
            builder.from(OrderLineAdded, from => from.usingCompositeKey<CompositeKey>(key => key
                .set(target => target.orderId, event => event.orderId)
                .set(target => target.lineNumber, event => event.lineNumber)));

            const definition = builder.build('orderLine', 'OrderLine') as unknown as { From: FromRecord[] };
            const entry = definition.From.find(candidate => candidate.Key.Id === 'OrderLineAdded')!;

            expect(entry.Value.Key).toBe('$composite(orderId=orderId,lineNumber=lineNumber)');
        });
    });

    describe('when using a parent composite key on a from builder', () => {
        it('should produce a $composite expression for the parent key', () => {
            const builder = new ProjectionBuilderFor<OrderLine>();
            builder.from(OrderLineAdded, from => from.usingParentCompositeKey<CompositeKey>(key => key
                .set(target => target.orderId, event => event.orderId)
                .set(target => target.lineNumber, event => event.lineNumber)));

            const definition = builder.build('orderLine', 'OrderLine') as unknown as { From: Array<{ Key: { Id: string }; Value: { ParentKey: string } }> };
            const entry = definition.From.find(candidate => candidate.Key.Id === 'OrderLineAdded')!;

            expect(entry.Value.ParentKey).toBe('$composite(orderId=orderId,lineNumber=lineNumber)');
        });
    });

    describe('when using a composite key on a join builder', () => {
        it('should produce a $composite expression', () => {
            const builder = new ProjectionBuilderFor<OrderLine>();
            builder.join(OrderLineJoined, join => join
                .on(model => model.id)
                .usingCompositeKey<CompositeKey>(key => key
                    .set(target => target.orderId, event => event.orderId)
                    .set(target => target.lineNumber, event => event.lineNumber)));

            const definition = builder.build('orderLine', 'OrderLine') as unknown as { Join: JoinRecord[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'OrderLineJoined')!;

            expect(entry.Value.Key).toBe('$composite(orderId=orderId,lineNumber=lineNumber)');
        });
    });

    describe('when using parent-key methods on a join builder', () => {
        it('should accept the calls without throwing, matching the C# client having no wire effect for Join', () => {
            const builder = new ProjectionBuilderFor<OrderLine>();

            expect(() => builder.join(OrderLineJoined, join => join
                .on(model => model.id)
                .usingParentKey(event => event.orderId)
                .usingParentKeyFromContext('someContextProperty')
                .usingParentCompositeKey<CompositeKey>(key => key.set(target => target.orderId, event => event.orderId))
                .usingConstantParentKey('constant')
            )).not.toThrow();

            const definition = builder.build('orderLine', 'OrderLine') as unknown as { Join: JoinRecordWithParentKey[] };
            const entry = definition.Join.find(candidate => candidate.Key.Id === 'OrderLineJoined')!;

            // JoinDefinition has no ParentKey slot on the wire, so none of the calls above
            // should have produced a ParentKey property.
            expect(entry.Value.ParentKey).toBeUndefined();
        });
    });
});
