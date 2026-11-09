// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { DictionaryKey } from '../../../projections/declarative/DictionaryKey.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { compileDeclarative } from './given/compile.js';

chai.should();

class OrderedChildAdded { itemId!: string; }
field(String)(OrderedChildAdded.prototype, 'itemId');
eventType('capability-ordered-child-added')(OrderedChildAdded);

describe('when a read-model scenario sets a property once', () => {
    it('should require a kernel-backed test', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, _ => _.setOnce(m => m.name).to(e => e.name)));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes("'$setOnce(name)'").and.includes('set once requires a kernel-backed test');
    });
});

describe('when a read-model scenario targets dictionary entries', () => {
    for (const [name, define] of [
        ['set', (builder: Parameters<Parameters<typeof compileDeclarative>[0]>[0]) => builder.from(Changed, _ => _.set(m => m.details, e => e.name).to(e => e.quantity))],
        ['remove', (builder: Parameters<Parameters<typeof compileDeclarative>[0]>[0]) => builder.from(Changed, _ => _.removeKey(m => m.details, DictionaryKey.causedBy('subject')))]
    ] as const) {
        it(`should require a kernel-backed test to ${name} an entry`, () => {
            const { compiled, definition } = compileDeclarative(define);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('dynamic or unknown destination paths require a kernel-backed test');
        });
    }
});

describe('when a read-model scenario orders children', () => {
    it('should require a kernel-backed test', () => {
        const { compiled, definition } = compileDeclarative(builder => {
            builder.from(Changed).children<{ lineId: string }>(model => model.labels as never, child => child
                .identifiedBy(line => line.lineId)
                .prepend()
                .from(OrderedChildAdded, from => from.usingKey(event => event.itemId)));
        }, [OrderedChildAdded]);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Children.labels.Ordering').and.includes('prepended or sorted children');
    });
});
