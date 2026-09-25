// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../eventTypeDecorator.js';
import { constraint } from '../constraint.js';
import { Constraints } from '../Constraints.js';
import type { IConstraint } from '../IConstraint.js';
import type { IConstraintBuilder } from '../IConstraintBuilder.js';
import { unique } from '../unique.js';
import { removeConstraint } from '../removeConstraint.js';

const should = chai.should();

class Once {}
class Again {}
class Released {}
class ValueClaimed { address = ''; second = ''; }
for (const [type, id] of [[Once, 'once'], [Again, 'again'], [Released, 'released'], [ValueClaimed, 'value-claimed']] as const) eventType(id)(type);
unique('OneRegistration')(Once);
unique('OneRegistration')(Again);
unique('Shared')(ValueClaimed.prototype, 'address');
removeConstraint('OneRegistration')(Released);

class FluentOnce implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(Once, 'Registered {email}', 'OneRegistration');
    }
}
constraint('FluentOnce')(FluentOnce);

class FluentValue implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(uniqueBuilder => uniqueBuilder.on(ValueClaimed, event => event.address));
    }
}
constraint('Shared')(FluentValue);

async function discover(types: Function[], constraintTypes: (new () => IConstraint)[]): Promise<{ definitions: { Name: string; Definition: { Value0?: { EventDefinitions: { Properties: string[] }[] }; Value1?: { EventTypeIds: string[] } }; RemovedWith: string[] }[]; constraints: Constraints }> {
    const register = vi.fn().mockResolvedValue({});
    const artifacts = { eventTypes: types, constraints: constraintTypes } as IClientArtifactsProvider;
    const constraints = new Constraints('store', { constraints: { register } } as unknown as ChronicleConnection, artifacts);
    await constraints.register();
    return { definitions: register.mock.calls[0][0].Constraints, constraints };
}

describe('when combining fluent and decorated unique event type constraints', () => {
    it('should register one definition per wire name and merge event types and removals', async () => {
        const { definitions, constraints } = await discover([Once, Again, Released], [FluentOnce]);
        definitions.length.should.equal(1);
        definitions[0].Name.should.equal('OneRegistration');
        definitions[0].Definition.Value1!.EventTypeIds.should.deep.equal(['once', 'again']);
        definitions[0].RemovedWith.should.deep.equal(['released']);
        constraints.resolveMessageFor({ constraintId: 'OneRegistration', message: 'Kernel', details: { email: 'a$b' } }).message.should.equal('Registered a$b');
    });
});

describe('when combining fluent and decorated unique properties', () => {
    it('should not register the same property twice', async () => {
        const { definitions } = await discover([ValueClaimed], [FluentValue]);
        definitions.length.should.equal(1);
        definitions[0].Definition.Value0!.EventDefinitions[0].Properties.should.deep.equal(['address']);
    });
});

describe('when a fluent property constraint and decorated event type share a name', () => {
    it('should reject conflicting constraint definitions', async () => {
        class Conflicting implements IConstraint {
            define(builder: IConstraintBuilder): void {
                builder.unique(uniqueBuilder => uniqueBuilder.on(ValueClaimed, event => event.address));
            }
        }
        constraint('OneRegistration')(Conflicting);
        const artifacts = { eventTypes: [Once], constraints: [Conflicting] } as unknown as IClientArtifactsProvider;
        const constraints = new Constraints('store', {} as ChronicleConnection, artifacts);
        await constraints.discover().then(
            () => should.fail('Expected conflicting constraint types'),
            (error: Error) => error.message.should.match(/not a unique event type constraint/)
        );
    });
});

describe('when decorating two properties on the same event with one unique name', () => {
    it('should reject the second property instead of silently making a compound key', async () => {
        unique('Pair')(ValueClaimed.prototype, 'address');
        unique('Pair')(ValueClaimed.prototype, 'second');
        const artifacts = { eventTypes: [ValueClaimed], constraints: [] } as unknown as IClientArtifactsProvider;
        const constraints = new Constraints('store', {} as ChronicleConnection, artifacts);
        await constraints.discover().then(
            () => should.fail('Expected a duplicate event type error'),
            (error: Error) => error.message.should.match(/already added to unique constraint 'Pair'/)
        );
    });
});
