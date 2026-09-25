// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it, vi } from 'vitest';
import { ConstraintType } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../eventTypeDecorator.js';
import { constraint } from '../constraint.js';
import { Constraints } from '../Constraints.js';
import type { IConstraint } from '../IConstraint.js';
import type { IConstraintBuilder } from '../IConstraintBuilder.js';
import { unique, getUniquePropertyMetadata } from '../unique.js';
import { removeConstraint } from '../removeConstraint.js';

const should = chai.should();

class Registered { address = ''; }
class AddressChanged { contact = ''; }
class Abandoned {}
class Deleted {}
class Reset {}
for (const [type, id] of [
    [Registered, 'decorator-registered'], [AddressChanged, 'decorator-changed'],
    [Abandoned, 'decorator-abandoned'], [Deleted, 'decorator-deleted'], [Reset, 'decorator-reset']
] as const) eventType(id)(type);
unique('SharedAddress', 'Address {email} already registered')(Registered.prototype, 'address');
unique('SharedAddress')(AddressChanged.prototype, 'contact');
removeConstraint('SharedAddress')(Abandoned);
removeConstraint('SharedAddress')(Deleted);
removeConstraint('SharedAddress')(Reset);

class FluentAddress implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(uniqueBuilder => {
            uniqueBuilder.on(Registered, event => event.address);
            uniqueBuilder.on(AddressChanged, event => event.contact);
            uniqueBuilder.withMessage('Address {email} already registered');
            uniqueBuilder.removedWith(Abandoned).removedWith(Deleted).removedWith(Reset);
        });
    }
}
constraint('SharedAddress')(FluentAddress);

async function register(types: Function[], constraintTypes: (new () => IConstraint)[] = []) {
    const send = vi.fn().mockResolvedValue({});
    const connection = { constraints: { register: send } } as unknown as ChronicleConnection;
    const artifacts = { eventTypes: types, constraints: constraintTypes } as IClientArtifactsProvider;
    await new Constraints('store', connection, artifacts).register();
    return send.mock.calls[0][0].Constraints;
}

describe('when registering decorated unique properties', () => {
    it('should group properties by name with all releasing events and match the fluent definition', async () => {
        const decorated = (await register([Registered, AddressChanged, Abandoned, Deleted, Reset]))[0];
        const fluent = (await register([], [FluentAddress]))[0];
        decorated.should.deep.equal(fluent);
        decorated.Type.should.equal(ConstraintType.Unique);
        decorated.RemovedWith.should.deep.equal(['decorator-abandoned', 'decorator-deleted', 'decorator-reset']);
        should.equal(decorated.Definition.Value0.IgnoreCasing, false);
        getUniquePropertyMetadata(Registered, 'address')!.message!.should.equal('Address {email} already registered');
    });
});
