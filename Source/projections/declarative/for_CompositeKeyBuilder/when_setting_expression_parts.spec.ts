// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { CompositeKeyBuilder } from '../CompositeKeyBuilder.js';
import type { ICompositeKeyBuilder } from '../ICompositeKeyBuilder.js';
import { ProjectionBuilderFor } from '../ProjectionBuilderFor.js';

chai.should();

class Changed { orderId!: string; lineNumber!: number; }
eventType('expression-parts-changed')(Changed);
class Model { id!: string; }
class Key { orderId!: string; lineNumber!: number; subject!: string; sourceId!: string; category!: string; }

const configure = (key: ICompositeKeyBuilder<Key, Changed>) => key
    .set(target => target.orderId, event => event.orderId)
    .set(target => target.lineNumber).to(event => event.lineNumber)
    .set(target => target.subject).toEventContextProperty('causedBy.subject')
    .set(target => target.sourceId).toEventSourceId()
    .set(target => target.category).toValue('orders');
const expression = '$composite(orderId=orderId,lineNumber=lineNumber,subject=$eventContext(CausedBy.Subject),sourceId=$eventSourceId,category=$value(orders))';

for (const kind of ['root', 'parent', 'join'] as const) {
    describe(`when setting mixed expression parts on a ${kind} composite key`, () => {
        let result: string;
        beforeEach(() => {
            const builder = new ProjectionBuilderFor<Model>();
            if (kind === 'root') builder.from(Changed, from => from.usingCompositeKey<Key>(configure));
            if (kind === 'parent') builder.from(Changed, from => from.usingParentCompositeKey<Key>(configure));
            if (kind === 'join') builder.join(Changed, join => join.on(model => model.id).usingCompositeKey<Key>(configure));
            const definition = builder.build('expressionParts', 'Model');
            result = kind === 'join' ? definition.Join[0].Value.Key
                : kind === 'parent' ? definition.From[0].Value.ParentKey : definition.From[0].Value.Key;
        });
        it('should emit the .NET set expressions in declaration order', () => result.should.equal(expression));
    });
}

for (const [value, expected] of [
    [42, '$value(42)'], [false, '$value(false)'], ['fixed', '$value(fixed)'],
    [null, '$null'], [{ value: 'concept' }, '$value(concept)']
] as const) {
    describe(`when setting a composite constant part to ${JSON.stringify(value)}`, () => {
        let result: string;
        beforeEach(() => {
            const builder = new CompositeKeyBuilder<{ category: typeof value }, Changed>();
            builder.set(target => target.category).toValue(value);
            result = builder.build();
        });
        it('should use the shared constant expression syntax', () => result.should.equal(`$composite(category=${expected})`));
    });
}

describe('when completing composite parts out of declaration order', () => {
    it('should retain declaration order', () => {
        const builder = new CompositeKeyBuilder<Key, Changed>();
        const first = builder.set(target => target.orderId);
        builder.set(target => target.category).toValue('orders');
        first.to(event => event.orderId);
        builder.build().should.equal('$composite(orderId=orderId,category=$value(orders))');
    });
});

describe('when a composite part has no source expression', () => {
    it('should reject building an incomplete key', () => {
        const builder = new CompositeKeyBuilder<Key, Changed>();
        builder.set(target => target.category);
        (() => builder.build()).should.throw("Composite key part 'category' is missing a to expression.");
    });
});

describe('when configuring an invalid context or constant part', () => {
    it('should reject a context path the kernel cannot resolve', () => {
        const builder = new CompositeKeyBuilder<Key, Changed>();
        (() => builder.set(target => target.subject).toEventContextProperty('unknown')).should.throw();
    });
    it('should reject a constant the kernel cannot parse', () => {
        const builder = new CompositeKeyBuilder<Key, Changed>();
        (() => builder.set(target => target.category).toValue('a,b')).should.throw('unsupported by the kernel');
    });
});
