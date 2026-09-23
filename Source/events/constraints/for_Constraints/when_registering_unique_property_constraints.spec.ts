// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { ConstraintType } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts';
import type { ChronicleConnection } from '../../../connection';
import { eventType } from '../../eventTypeDecorator';
import { ConstraintBuilder } from '../ConstraintBuilder';
import { constraint } from '../constraint';
import { Constraints } from '../Constraints';
import type { IConstraint } from '../IConstraint';
import type { IConstraintBuilder } from '../IConstraintBuilder';

const should = chai.should();

class AddressReserved { emailAddress = ''; }
class AddressReleased {}
class AddressExpired {}
class AddressRevoked {}
eventType('address-reserved')(AddressReserved);
eventType('address-released')(AddressReleased);
eventType('address-expired')(AddressExpired);
eventType('address-revoked')(AddressRevoked);

async function registerConstraint(constraintType: new () => IConstraint) {
    const register = vi.fn().mockResolvedValue({});
    const connection = { constraints: { register } } as unknown as ChronicleConnection;
    const artifacts = {
        eventTypes: [], readModels: [], reactors: [], reducers: [], seeders: [], constraints: [constraintType],
        projections: [], webhooks: [], eventTypeMigrations: [], globalForHandlers: []
    } as IClientArtifactsProvider;
    const constraints = new Constraints('store', connection, artifacts);
    await constraints.register();
    return register.mock.calls[0][0];
}

function propertyConstraint(...removalEvents: Function[]): new () => IConstraint {
    class ReservedAddressConstraint implements IConstraint {
        define(builder: IConstraintBuilder): void {
            builder.perEventSourceType().perEventStreamType().perEventStreamId()
                .unique(unique => {
                    unique.on(AddressReserved, event => event.emailAddress).ignoreCasing();
                    removalEvents.forEach(eventType => unique.removedWith(eventType));
                });
        }
    }
    constraint('reserved-address')(ReservedAddressConstraint);
    return ReservedAddressConstraint;
}

describe('when registering a unique property constraint without removal events', () => {
    it('should register no removal event types', async () => {
        const request = await registerConstraint(propertyConstraint());
        request.Constraints[0].RemovedWith.should.deep.equal([]);
    });
});

describe('when registering a unique property constraint with one removal event', () => {
    it('should register the removal event type', async () => {
        const request = await registerConstraint(propertyConstraint(AddressReleased));
        request.Constraints[0].RemovedWith.should.deep.equal(['address-released']);
    });
});

describe('when registering a unique property constraint with several removal events', () => {
    let request: Awaited<ReturnType<typeof registerConstraint>>;
    beforeEach(async () => {
        request = await registerConstraint(propertyConstraint(AddressReleased, AddressExpired, AddressRevoked));
    });

    it('should register all removal event types in declaration order', () => {
        request.Constraints[0].RemovedWith.should.deep.equal(['address-released', 'address-expired', 'address-revoked']);
    });

    it('should preserve the event properties, casing setting and scope', () => {
        const registered = request.Constraints[0];
        registered.Type.should.equal(ConstraintType.Unique);
        registered.Definition.Value0.EventDefinitions.should.deep.equal([
            { EventTypeId: 'address-reserved', Properties: ['emailAddress'] }
        ]);
        registered.Definition.Value0.IgnoreCasing.should.be.true;
        registered.Scope.should.deep.equal({ EventSourceType: '*', EventStreamType: '*', EventStreamId: '*' });
        request.EventStore.should.equal('store');
    });
});

describe('when registering a unique property constraint with duplicate removal events', () => {
    it('should register each event type only once in first-registration order', async () => {
        const request = await registerConstraint(propertyConstraint(AddressReleased, AddressExpired, AddressReleased, AddressRevoked, AddressExpired));
        request.Constraints[0].RemovedWith.should.deep.equal(['address-released', 'address-expired', 'address-revoked']);
    });
});

describe('when registering a legacy single-field unique property capture', () => {
    it('should retain the singular removal event type', async () => {
        class LegacyConstraint implements IConstraint {
            define(builder: IConstraintBuilder): void {
                (builder as ConstraintBuilder).capture.uniqueConstraint = {
                    eventDefinitions: [{ eventTypeId: 'address-reserved', properties: ['emailAddress'] }],
                    ignoreCasing: false,
                    removedWithEventTypeId: 'address-released'
                };
            }
        }
        constraint('legacy-address')(LegacyConstraint);
        const request = await registerConstraint(LegacyConstraint);
        request.Constraints[0].RemovedWith.should.deep.equal(['address-released']);
    });
});

describe('when registering a unique property capture with legacy and accumulated removal events', () => {
    it('should retain both the legacy event and new events without duplicates', async () => {
        class MixedCaptureConstraint implements IConstraint {
            define(builder: IConstraintBuilder): void {
                (builder as ConstraintBuilder).capture.uniqueConstraint = {
                    eventDefinitions: [{ eventTypeId: 'address-reserved', properties: ['emailAddress'] }],
                    ignoreCasing: false,
                    removedWithEventTypeId: 'address-released',
                    removedWithEventTypeIds: ['address-expired', 'address-revoked', 'address-expired']
                };
            }
        }
        constraint('mixed-address')(MixedCaptureConstraint);
        const request = await registerConstraint(MixedCaptureConstraint);
        request.Constraints[0].RemovedWith.should.deep.equal(['address-released', 'address-expired', 'address-revoked']);
    });
});

describe('when capturing several removal events through the fluent builder', () => {
    it('should retain the last event in the legacy singular field', () => {
        const builder = new ConstraintBuilder('reserved-address');
        builder.unique(unique => unique.removedWith(AddressReleased).removedWith(AddressExpired));
        should.equal(builder.capture.uniqueConstraint?.removedWithEventTypeId, 'address-expired');
        builder.capture.uniqueConstraint!.removedWithEventTypeIds!.should.deep.equal(['address-released', 'address-expired']);
    });
});
