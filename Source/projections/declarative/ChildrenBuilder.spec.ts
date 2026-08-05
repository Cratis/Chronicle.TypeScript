// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator';
import { ProjectionBuilderFor } from './ProjectionBuilderFor';

// Decorators are applied as plain function calls (rather than `@decorator` syntax) so these
// fixtures don't depend on the test runner's decorator-syntax support.

class LineAdded {
    productId!: string;
    quantity!: number;
}
eventType()(LineAdded);

class TagAdded {
    name!: string;
}
eventType()(TagAdded);

class SummaryUpdated {
    total!: number;
}
eventType()(SummaryUpdated);

class SummaryCleared {}
eventType()(SummaryCleared);

class WholeLineReceived {
    productId!: string;
}
eventType()(WholeLineReceived);

class OrderLine {
    productId!: string;
    quantity!: number;
}

class OrderSummary {
    total!: number;
}

class Order {
    id!: string;
    lines!: OrderLine[];
    tags!: string[];
    summary!: OrderSummary | undefined;
}

interface FromRecord {
    Key: { Id: string };
    Value: { Properties: Record<string, string>; Key: string; ParentKey: string };
}

interface ChildrenDefinition {
    IdentifiedBy: string;
    From: FromRecord[];
    RemovedWith: Array<{ Key: { Id: string } }>;
    FromEventProperty?: { Event: { Id: string } | undefined; PropertyExpression: string };
}

interface BuiltDefinition {
    From: FromRecord[];
    Children: Record<string, ChildrenDefinition>;
    Nested: Record<string, ChildrenDefinition>;
}

describe('ChildrenBuilder and NestedBuilder', () => {
    describe('when using children on the top-level builder', () => {
        it('should produce a children definition keyed by the target property', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.children<OrderLine>(order => order.lines, children => children
                .identifiedBy(line => line.productId)
                .from(LineAdded, from => from.set(line => line.quantity).to(event => event.quantity)));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const linesDefinition = definition.Children.lines;

            expect(linesDefinition.IdentifiedBy).toBe('productId');
            const fromEntry = linesDefinition.From.find(candidate => candidate.Key.Id === 'LineAdded')!;
            expect(fromEntry.Value.Properties.quantity).toBe('quantity');
        });
    });

    describe('when using nested with clearWith on the top-level builder', () => {
        it('should produce a nested definition with a RemovedWith entry', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.nested<OrderSummary>(order => order.summary, nested => nested
                .from(SummaryUpdated, from => from.set(summary => summary.total).to(event => event.total))
                .clearWith(SummaryCleared));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const summaryDefinition = definition.Nested.summary;

            const fromEntry = summaryDefinition.From.find(candidate => candidate.Key.Id === 'SummaryUpdated')!;
            expect(fromEntry.Value.Properties.total).toBe('total');
            expect(summaryDefinition.RemovedWith[0].Key.Id).toBe('SummaryCleared');
        });
    });

    describe('when using addChild with a builder callback', () => {
        it('should produce a children definition keyed by identifiedBy and usingKey', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.from(LineAdded, from => from.addChild<OrderLine>(order => order.lines, child => child
                .identifiedBy(line => line.productId)
                .usingKey(event => event.productId)));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const linesDefinition = definition.Children.lines;

            expect(linesDefinition.IdentifiedBy).toBe('productId');
            const fromEntry = linesDefinition.From.find(candidate => candidate.Key.Id === 'LineAdded')!;
            expect(fromEntry.Value.Key).toBe('productId');
        });
    });

    describe('when using addChild with a plain event property accessor', () => {
        it('should produce a children definition with a FromEventProperty expression', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.from(TagAdded, from => from.addChild<string>(order => order.tags, event => event.name));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const tagsDefinition = definition.Children.tags;

            expect(tagsDefinition.FromEventProperty?.PropertyExpression).toBe('name');
            expect(tagsDefinition.FromEventProperty?.Event?.Id).toBe('TagAdded');
        });
    });

    describe('when using addChild on a join builder', () => {
        it('should produce a children definition from the join clause', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.join(WholeLineReceived, join => join.addChild<OrderLine>(order => order.lines, child => child
                .identifiedBy(line => line.productId)));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const linesDefinition = definition.Children.lines;

            expect(linesDefinition.IdentifiedBy).toBe('productId');
            expect(linesDefinition.From.some(candidate => candidate.Key.Id === 'WholeLineReceived')).toBe(true);
        });
    });

    describe('when using setThisValue on a from builder', () => {
        it('should map the whole event property onto the $this well-known expression', () => {
            const builder = new ProjectionBuilderFor<Order>();
            builder.from(TagAdded, from => from.setThisValue().to(event => event.name));

            const definition = builder.build('order', 'Order') as unknown as BuiltDefinition;
            const fromEntry = definition.From.find(candidate => candidate.Key.Id === 'TagAdded')!;

            expect(fromEntry.Value.Properties.$this).toBe('name');
        });
    });
});
