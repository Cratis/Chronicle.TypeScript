// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { subject } from '../../../compliance/subject.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { subjectBehaviors } from './subject_behaviors.fixture.js';

class PersonId extends ConceptAs<string> { static readonly valueType = String; }
class PersonalData { constructor(readonly personId: string) {} }
class DerivedPersonalData extends PersonalData {}
class ConceptPersonalData { constructor(readonly personId: PersonId) {} }
class UnannotatedData { id = 'not-the-subject'; }

subject()(PersonalData.prototype, 'personId');
field(String)(PersonalData.prototype, 'personId');
eventType('subject-legacy-string')(PersonalData);
eventType('subject-legacy-derived')(DerivedPersonalData);
subject()(ConceptPersonalData.prototype, 'personId');
field(PersonId)(ConceptPersonalData.prototype, 'personId');
eventType('subject-legacy-concept')(ConceptPersonalData);
field(String)(UnannotatedData.prototype, 'id');
eventType('subject-legacy-unannotated')(UnannotatedData);

describe('when appending subject annotations with legacy decorators', () => {
    subjectBehaviors({
        types: [PersonalData, DerivedPersonalData, ConceptPersonalData, UnannotatedData],
        annotated: value => new PersonalData(value),
        inherited: value => new DerivedPersonalData(value),
        concept: value => new ConceptPersonalData(new PersonId(value)),
        unannotated: () => new UnannotatedData()
    });
});
