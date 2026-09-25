// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ConstraintType } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { EventSequence } from '../../../eventSequences/EventSequence.js';
import { EventSequenceId } from '../../../eventSequences/EventSequenceId.js';
import type { IUnitOfWorkManager } from '../../../transactions/IUnitOfWorkManager.js';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import { eventType } from '../../eventTypeDecorator.js';
import { constraint } from '../constraint.js';
import { Constraints } from '../Constraints.js';
import type { IConstraint } from '../IConstraint.js';
import type { IConstraintBuilder } from '../IConstraintBuilder.js';
import { unique, getUniquePropertyMetadata } from '../unique.js';
import { removeConstraint } from '../removeConstraint.js';

class Registered { address = ''; }
class AddressChanged { contact = ''; }
class Abandoned {}
class Deleted {}
class OnlyOnce {}
class Alternate {}
class Reset {}
class DefaultName { value = ''; }
class DefaultEventType {}

for (const [type, id] of [
    [Registered, 'decorator-registered'], [AddressChanged, 'decorator-changed'],
    [Abandoned, 'decorator-abandoned'], [Deleted, 'decorator-deleted'],
    [OnlyOnce, 'decorator-once'], [Alternate, 'decorator-alternate'],
    [Reset, 'decorator-reset'], [DefaultName, 'decorator-default'],
    [DefaultEventType, 'decorator-default-event']
] as const) eventType(id)(type);

// Invoke the legacy decorators explicitly, without the standard decorator context.
unique('SharedAddress', 'Address {email} already registered')(Registered.prototype, 'address');
unique('SharedAddress')(AddressChanged.prototype, 'contact');
unique()(DefaultName.prototype, 'value');
unique()(DefaultEventType);
unique('OneRegistration', 'Already registered')(OnlyOnce);
unique('OneRegistration')(Alternate);
removeConstraint('SharedAddress')(Abandoned);
removeConstraint('SharedAddress')(Deleted);
removeConstraint('OneRegistration')(Reset);
removeConstraint('SharedAddress')(Reset);

class FluentAddress implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique => {
            unique.on(Registered, event => event.address);
            unique.on(AddressChanged, event => event.contact);
            unique.withMessage('Address {email} already registered');
            unique.removedWith(Abandoned).removedWith(Deleted).removedWith(Reset);
        });
    }
}
constraint('SharedAddress')(FluentAddress);

class FluentRegistration implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(OnlyOnce, 'Already registered', 'OneRegistration');
    }
}
constraint('OneRegistration')(FluentRegistration);

async function register(artifacts: IClientArtifactsProvider) {
    const send = vi.fn().mockResolvedValue({});
    const connection = { constraints: { register: send } } as unknown as ChronicleConnection;
    await new Constraints('store', connection, artifacts).register();
    return send.mock.calls[0][0].Constraints;
}

const eventTypes = [Registered, AddressChanged, Abandoned, Deleted, OnlyOnce, Alternate, Reset, DefaultName, DefaultEventType];
const artifacts = (constraints: (new () => IConstraint)[] = [], types: Function[] = eventTypes): IClientArtifactsProvider => ({
    eventTypes: types, constraints
}) as unknown as IClientArtifactsProvider;

describe('when registering legacy unique decorators', () => {
    it('groups property constraints by name with all releasing events and matches the fluent definition', async () => {
        const decorated = (await register(artifacts())).find((item: { Name: string }) => item.Name === 'SharedAddress');
        const fluent = (await register(artifacts([FluentAddress], []))).find((item: { Name: string }) => item.Name === 'SharedAddress');
        expect(decorated).toEqual(fluent);
        expect(decorated.Type).toBe(ConstraintType.Unique);
        expect(decorated.RemovedWith).toEqual(['decorator-abandoned', 'decorator-deleted', 'decorator-reset']);
        expect(decorated.Definition.Value0.IgnoreCasing).toBe(false);
        expect(getUniquePropertyMetadata(Registered, 'address')?.message).toBe('Address {email} already registered');
    });

    it('resolves fixed messages and detail placeholders without changing unknown violations', async () => {
        const constraints = new Constraints('store', { constraints: { register: vi.fn() } } as unknown as ChronicleConnection, artifacts());
        await constraints.discover();
        expect(constraints.resolveMessageFor({
            constraintId: 'SharedAddress', message: 'Kernel default', details: { email: 'user@example.com' }
        }).message).toBe('Address user@example.com already registered');
        const violation = { constraintId: 'unknown', message: 'Kernel default', details: {} };
        expect(constraints.resolveMessageFor(violation)).toBe(violation);

        const connection = {
            eventSequences: { append: vi.fn().mockResolvedValue({ Response: {
                SequenceNumber: 0n, Errors: [], ConstraintViolations: [{
                    ConstraintId: 'OneRegistration', Message: 'Kernel default', Details: {}
                }]
            } }) }
        } as unknown as ChronicleConnection;
        const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'namespace', connection,
            {} as IUnitOfWorkManager, constraints.resolveMessageFor.bind(constraints));
        const result = await sequence.append('source', new OnlyOnce());
        expect(result.constraintViolations[0].message).toBe('Already registered');
    });

    it('uses the property name as the default constraint name', async () => {
        const definitions = await register(artifacts());
        expect(definitions.find((item: { Name: string }) => item.Name === 'value')?.Definition.Value0.EventDefinitions)
            .toEqual([{ EventTypeId: 'decorator-default', Properties: ['value'] }]);
    });

    it('uses the class name rather than the event type id when no name is specified', async () => {
        const definitions = await register(artifacts([], [DefaultEventType]));
        expect(definitions[0].Name).toBe('DefaultEventType');
        expect(definitions[0].Definition.Value1.EventTypeIds).toEqual(['decorator-default-event']);
    });

    it('registers a unique event class with the same definition as its fluent equivalent', async () => {
        const decorated = (await register(artifacts([], [OnlyOnce])))[0];
        const fluent = (await register(artifacts([FluentRegistration], [])))[0];
        expect(decorated).toEqual(fluent);
    });

    it('groups unique event types and releases the name from each matching event', async () => {
        const decorated = (await register(artifacts())).find((item: { Name: string }) => item.Name === 'OneRegistration');
        const fluent = (await register(artifacts([FluentRegistration], []))).find((item: { Name: string }) => item.Name === 'OneRegistration');
        expect(decorated.Type).toBe(ConstraintType.UniqueEventType);
        expect(decorated.Definition.Value1.EventTypeIds).toEqual(['decorator-once', 'decorator-alternate']);
        expect(decorated.RemovedWith).toEqual(['decorator-reset']);
        expect(decorated.Scope).toEqual(fluent.Scope);
        expect(decorated.Definition.Value1.EventTypeIds[0]).toBe(fluent.Definition.Value1.EventTypeIds[0]);
    });
});
