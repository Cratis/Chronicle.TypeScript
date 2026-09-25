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
import { unique } from '../unique.js';
import { removeConstraint } from '../removeConstraint.js';

const should = chai.should();
class OnlyOnce {}
class Alternate {}
class Reset {}
class DefaultName { value = ''; }
class DefaultEventType {}
for (const [type, id] of [
    [OnlyOnce, 'decorator-once'], [Alternate, 'decorator-alternate'], [Reset, 'decorator-reset'],
    [DefaultName, 'decorator-default'], [DefaultEventType, 'decorator-default-event']
] as const) eventType(id)(type);
unique()(DefaultName.prototype, 'value');
unique()(DefaultEventType);
unique('OneRegistration', 'Already registered')(OnlyOnce);
unique('OneRegistration')(Alternate);
removeConstraint('OneRegistration')(Reset);

class FluentRegistration implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.uniqueFor(OnlyOnce, 'Already registered', 'OneRegistration');
    }
}
constraint('OneRegistration')(FluentRegistration);

async function register(types: Function[], constraintTypes: (new () => IConstraint)[] = []) {
    const send = vi.fn().mockResolvedValue({});
    const connection = { constraints: { register: send } } as unknown as ChronicleConnection;
    const artifacts = { eventTypes: types, constraints: constraintTypes } as IClientArtifactsProvider;
    await new Constraints('store', connection, artifacts).register();
    return send.mock.calls[0][0].Constraints;
}

describe('when registering decorated event types', () => {
    it('should use the property name as the default property constraint name', async () => {
        const definitions = await register([DefaultName]);
        definitions[0].Name.should.equal('value');
        definitions[0].Definition.Value0.EventDefinitions.should.deep.equal([{ EventTypeId: 'decorator-default', Properties: ['value'] }]);
    });

    it('should use the class name rather than the event type id as the default event constraint name', async () => {
        const definitions = await register([DefaultEventType]);
        definitions[0].Name.should.equal('DefaultEventType');
        definitions[0].Definition.Value1.EventTypeIds.should.deep.equal(['decorator-default-event']);
    });

    it('should match the fluent unique event type definition', async () => {
        const decorated = (await register([OnlyOnce]))[0];
        const fluent = (await register([], [FluentRegistration]))[0];
        decorated.should.deep.equal(fluent);
    });

    it('should group class-level unique declarations sharing a name', async () => {
        const definitions = await register([OnlyOnce, Alternate, Reset]);
        definitions.length.should.equal(1);
        definitions[0].Type.should.equal(ConstraintType.UniqueEventType);
        definitions[0].Definition.Value1.EventTypeIds.should.deep.equal(['decorator-once', 'decorator-alternate']);
        definitions[0].RemovedWith.should.deep.equal(['decorator-reset']);
    });

    it('should retain the first supplied message when the first declaration has none', async () => {
        class First {}
        class Second {}
        class Third {}
        eventType('first-registration')(First);
        eventType('second-registration')(Second);
        eventType('third-registration')(Third);
        unique('SharedRegistration')(First);
        unique('SharedRegistration', 'Second message')(Second);
        unique('SharedRegistration', 'Third message')(Third);
        const artifacts = { eventTypes: [First, Second, Third], constraints: [] } as IClientArtifactsProvider;
        const constraints = new Constraints('store', {} as ChronicleConnection, artifacts);
        await constraints.discover();
        constraints.resolveMessageFor({ constraintId: 'SharedRegistration', message: 'Kernel', details: {} }).message
            .should.equal('Second message');
    });
});
