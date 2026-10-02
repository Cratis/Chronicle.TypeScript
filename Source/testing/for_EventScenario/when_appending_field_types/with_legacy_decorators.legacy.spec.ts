// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { unique } from '../../../events/constraints/unique.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { reactor } from '../../../reactors/reactor.js';
import { reducer } from '../../../reducers/reducer.js';
import { fieldScenarioBehaviors } from './field_scenario_behaviors.fixture.js';

class Identifier extends ConceptAs<Guid> { static readonly valueType = Guid; }
class Amount extends ConceptAs<number> { static readonly valueType = Number; }
class Occurred extends ConceptAs<Date> { static readonly valueType = Date; }

const identifier = () => Guid.parse('abcdef01-abcd-abcd-abcd-abcdef012345');
const occurred = () => new Date('2025-01-02T03:04:05.123Z');

class Payload {
    @field(Number) amount = 1.5;
    @field(Guid) identifier = identifier();
    @field(Date) occurred = occurred();
}

@eventType('FieldTypesRecorded')
class FieldsRecorded {
    @field(Number) amount = 1.5;
    @field(Guid) identifier = identifier();
    @field(Date) occurred = occurred();
    @field(Amount) amountConcept = new Amount(1e-7);
    @field(Identifier) identifierConcept = new Identifier(identifier());
    @field(Occurred) occurredConcept = new Occurred(occurred());
    @field(Payload) payload = new Payload();
    @field(Object) arbitrary = { nested: { number: 9007199254740992 }, values: [true, 1.5] };
}

@reactor('FieldTypesReactor')
class Echo {
    fieldsRecorded(event: FieldsRecorded) { return Object.assign(new FieldsRecorded(), event); }
}

class StoredFields {}
class StoreFields {
    fieldsRecorded(event: FieldsRecorded) { return event; }
}
reducer('FieldTypesReducer', undefined, StoredFields)(StoreFields);

@fromEvent(FieldsRecorded)
class ScalarProjection {
    @field(String) id = '';
    @field(Number) amount = 0;
    @field(Guid) identifier = Guid.empty;
    @field(Date) occurred = new Date(0);
}

@fromEvent(FieldsRecorded)
class ObjectProjection {
    @field(String) id = '';
    @field(Object) payload = {};
}

@fromEvent(FieldsRecorded)
class HashProjection {
    @field(String) id = '';
    @field(String) @setFrom(FieldsRecorded, '$eventContext(Hash)') hash = '';
}

@eventType('OracleFieldGuid')
class GuidClaimed {
    @field(Guid) key = identifier();
}
@eventType('OracleFieldNumber')
class NumberClaimed {
    @field(Number) key = 1;
}
@constraint('OracleFieldKey')
class GuidKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(GuidClaimed, event => event.key)); }
}
@constraint('OracleFieldKey')
class NumberKey {
    define(builder: IConstraintBuilder) { builder.unique(key => key.on(NumberClaimed, event => event.key)); }
}
@eventType('ConceptGuidClaimed')
class ConceptGuidClaimed {
    @field(Identifier) @unique('ConceptGuidKey') key = new Identifier(identifier());
}
@eventType('ConceptNumberClaimed')
class ConceptNumberClaimed {
    @field(Amount) @unique('ConceptNumberKey') key = new Amount(42);
}
@eventType('DateClaimed')
class DateClaimed {
    @field(Date) @unique('DateKey') key = occurred();
}
@eventType('ConceptDateClaimed')
class ConceptDateClaimed {
    @field(Occurred) @unique('ConceptDateKey') key = new Occurred(occurred());
}
@eventType('ObjectClaimed')
class ObjectClaimed {
    @field(Object) @unique('ObjectKey') key = { amount: 1.5 };
}

describe('when appending field types with legacy decorators', () => {
    fieldScenarioBehaviors({ recorded: FieldsRecorded, reactor: Echo, model: StoredFields, reducer: StoreFields,
        projection: ScalarProjection, objectProjection: ObjectProjection, hashProjection: HashProjection,
        guid: GuidClaimed, number: NumberClaimed, guidConstraint: GuidKey, numberConstraint: NumberKey, guidConcept: ConceptGuidClaimed, numberConcept: ConceptNumberClaimed,
        rejected: [DateClaimed, ConceptDateClaimed, ObjectClaimed] });
});
