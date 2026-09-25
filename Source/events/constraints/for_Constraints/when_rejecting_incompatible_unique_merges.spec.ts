// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../eventTypeDecorator.js';
import { constraint } from '../constraint.js';
import { Constraints } from '../Constraints.js';
import type { IConstraint } from '../IConstraint.js';
import type { IConstraintBuilder } from '../IConstraintBuilder.js';
import { unique } from '../unique.js';

const should = chai.should();

async function assertDiscoveryFails(eventTypes: Function[], constraintTypes: (new () => IConstraint)[], message: RegExp): Promise<void> {
    const artifacts = { eventTypes, constraints: constraintTypes } as IClientArtifactsProvider;
    const constraints = new Constraints('store', {} as ChronicleConnection, artifacts);
    await constraints.discover().then(
        () => should.fail('Expected incompatible constraint definitions'),
        (error: Error) => error.message.should.match(message)
    );
}

describe('when merging fluent unique event types with different scopes', () => {
    it('should reject the conflicting scope', async () => {
        class First {}
        class Second {}
        eventType('merge-first')(First);
        eventType('merge-second')(Second);
        class Global implements IConstraint {
            define(builder: IConstraintBuilder): void { builder.uniqueFor(First, undefined, 'Shared'); }
        }
        class Scoped implements IConstraint {
            define(builder: IConstraintBuilder): void { builder.perEventStreamId().uniqueFor(Second, undefined, 'Shared'); }
        }
        constraint('Global')(Global);
        constraint('Scoped')(Scoped);
        await assertDiscoveryFails([], [Global, Scoped], /Conflicting scopes for constraint 'Shared'/);
    });
});

describe('when merging a scoped fluent unique event type with a decorator', () => {
    it('should reject the conflicting scope', async () => {
        class First {}
        class Second {}
        eventType('merge-first')(First);
        eventType('merge-second')(Second);
        class Scoped implements IConstraint {
            define(builder: IConstraintBuilder): void { builder.perEventSourceType().uniqueFor(First, undefined, 'Shared'); }
        }
        constraint('ScopedEvent')(Scoped);
        unique('Shared')(Second);
        await assertDiscoveryFails([Second], [Scoped], /Conflicting scopes for constraint 'Shared'/);
    });
});

describe('when merging a scoped fluent unique property with a decorator', () => {
    it('should reject the conflicting scope', async () => {
        class First { address = ''; }
        class Second { address = ''; }
        eventType('merge-first')(First);
        eventType('merge-second')(Second);
        class Scoped implements IConstraint {
            define(builder: IConstraintBuilder): void {
                builder.perEventStreamType().unique(uniqueBuilder => uniqueBuilder.on(First, event => event.address));
            }
        }
        constraint('SharedProperty')(Scoped);
        unique('SharedProperty')(Second.prototype, 'address');
        await assertDiscoveryFails([Second], [Scoped], /Conflicting scopes for constraint 'SharedProperty'/);
    });
});

describe('when merging a case-insensitive fluent unique property with a decorator', () => {
    it('should reject the conflicting casing setting', async () => {
        class First { address = ''; }
        class Second { address = ''; }
        eventType('merge-first')(First);
        eventType('merge-second')(Second);
        class CaseInsensitive implements IConstraint {
            define(builder: IConstraintBuilder): void {
                builder.unique(uniqueBuilder => uniqueBuilder.on(First, event => event.address).ignoreCasing());
            }
        }
        constraint('SharedProperty')(CaseInsensitive);
        unique('SharedProperty')(Second.prototype, 'address');
        await assertDiscoveryFails([Second], [CaseInsensitive], /Conflicting ignoreCasing for unique property constraint 'SharedProperty'/);
    });
});
