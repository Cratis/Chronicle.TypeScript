// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import { FromBuilder } from './FromBuilder.js';
import { IAddChildBuilder } from './IAddChildBuilder.js';
import { IReadModelPropertiesBuilder } from './IReadModelPropertiesBuilder.js';
import { JoinBuilder } from './JoinBuilder.js';
import { ProjectionBuilderFor } from './ProjectionBuilderFor.js';

class Line {
    id = '';
}

class Base {
    id = '';
}

class Derived extends Base {
    derivedId = '';
}

class LineAdded {
    line = new Line();
}
eventType()(LineAdded);

class Order {
    id = '';
    lines: Line[] = [];
    nullableLines: Line[] | null = null;
    bases: Base[] = [];
}

// This checks the shared public interface independently of either concrete builder.
function acceptOriginalCallSites(builder: IReadModelPropertiesBuilder<Order, LineAdded, unknown>): void {
    builder.addChild<Line>(model => model.nullableLines, event => event.line);
    builder.addChild(model => model.nullableLines, child => child.identifiedBy(item => item.id));
    builder.addChild<Derived>(model => model.bases, (event: LineAdded) => event.line);
    builder.addChild<Derived>(model => model.bases, (child: IAddChildBuilder<Derived, LineAdded>) => child
        .identifiedBy(item => item.derivedId)
        .usingKeyFromContext('sequenceNumber'));
    builder.addChild<Line>(model => model.lines, (event: LineAdded) => event.line);
}

describe('addChild source compatibility', () => {
    it('should accept nullable targets and explicitly narrower child types on the shared interface', () => {
        const builder: IReadModelPropertiesBuilder<Order, LineAdded, unknown> = new FromBuilder<Order, LineAdded>();
        acceptOriginalCallSites(builder);
    });

    it('should accept the original call shapes on the concrete from builder', () => {
        const builder = new FromBuilder<Order, LineAdded>();
        builder.addChild<Line>(model => model.nullableLines, event => event.line);
        builder.addChild<Derived>(model => model.bases, (child: IAddChildBuilder<Derived, LineAdded>) => child.identifiedBy(item => item.derivedId));
        builder.addChild<Derived>(model => model.bases, (event: LineAdded) => event.line);
        builder.addChild<Line>(model => model.lines, (event: LineAdded) => event.line);
        expect(builder.entry.children).toHaveLength(4);
    });

    it('should accept the original call shapes on the concrete join builder', () => {
        const builder = new JoinBuilder<Order, LineAdded>();
        builder.addChild<Line>(model => model.nullableLines, event => event.line);
        builder.addChild<Derived>(model => model.bases, (child: IAddChildBuilder<Derived, LineAdded>) => child.identifiedBy(item => item.derivedId));
        builder.addChild<Derived>(model => model.bases, (event: LineAdded) => event.line);
        builder.addChild<Line>(model => model.lines, (event: LineAdded) => event.line);
        expect(builder.entry.children).toHaveLength(4);
    });

    it('should contextually type the unannotated builder callback in the documentation example', () => {
        const projection = new ProjectionBuilderFor<Order>();
        projection.from(LineAdded, from => from
            .addChild(model => model.lines, child => child
                .identifiedBy(item => item.id)
                .usingKeyFromContext('sequenceNumber')
                .usingParentKeyFromContext('eventSourceId')));
        expect(projection.build('order', 'Order').Children).toHaveProperty('lines');
    });
});
