// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import type { ICompositeKeyBuilder } from '../../../projections/declarative/ICompositeKeyBuilder.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { Removed } from './given/Removed.js';
import { compileDeclarative } from './given/compile.js';

chai.should();

for (const source of ['event property', 'context', 'source id', 'constant'] as const) {
    for (const kind of ['root', 'parent', 'join'] as const) {
        describe(`when validating a ${kind} composite key with a ${source} part before replay`, () => {
            it('should reject the composite key rather than evaluate unproven semantics', () => {
                const configure = <TEvent>(key: ICompositeKeyBuilder<{ part: string }, TEvent>) => {
                    const part = key.set(target => target.part);
                    if (source === 'context') return part.toEventContextProperty('subject');
                    if (source === 'source id') return part.toEventSourceId();
                    if (source === 'constant') return part.toValue('fixed');
                    return part.to(event => (event as { name: string }).name);
                };
                const { compiled, definition } = compileDeclarative(builder => {
                    if (kind === 'root') builder.from(Changed, from => from.usingCompositeKey(configure));
                    if (kind === 'parent') builder.from(Changed, from => from.usingParentCompositeKey(configure));
                    if (kind === 'join') builder
                        .from(Changed, from => from.set(model => model.state).to(event => event.name))
                        .join(Removed, join => join.on(model => model.state).usingCompositeKey(configure));
                });
                const section = kind === 'join' ? 'Join[capability-removed:1].Key'
                    : kind === 'parent' ? 'From[capability-changed:1].ParentKey' : 'From[capability-changed:1].Key';
                (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                    .with.property('message').that.includes(section);
            });
        });
    }
}
