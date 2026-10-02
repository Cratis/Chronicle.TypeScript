// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { subject } from '../../../compliance/subject.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { subjectBehaviors } from './subject_behaviors.fixture.js';

class PersonId extends ConceptAs<string> { static readonly valueType = String; }

@eventType('subject-standard-string')
class PersonalData {
    @subject() @field(String) personId: string;
    constructor(personId: string) { this.personId = personId; }
}

@eventType('subject-standard-concept')
class ConceptPersonalData {
    @subject() @field(PersonId) personId: PersonId;
    constructor(personId: string) { this.personId = new PersonId(personId); }
}

@eventType('subject-standard-unannotated')
class UnannotatedData { @field(String) id = 'not-the-subject'; }

describe('when appending subject annotations with standard decorators', () => {
    subjectBehaviors({
        types: [PersonalData, ConceptPersonalData, UnannotatedData],
        annotated: value => new PersonalData(value),
        concept: value => new ConceptPersonalData(value),
        unannotated: () => new UnannotatedData()
    });
});
