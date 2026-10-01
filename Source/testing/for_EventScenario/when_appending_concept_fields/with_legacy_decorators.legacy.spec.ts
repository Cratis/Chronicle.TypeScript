// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ConceptAs, field } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { unique } from '../../../events/constraints/unique.js';
import { constraint } from '../../../events/constraints/constraint.js';
import type { IConstraintBuilder } from '../../../events/constraints/IConstraintBuilder.js';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { reactor } from '../../../reactors/reactor.js';
import type { ReactorServices } from '../../../reactors/ReactorServices.js';
import { conceptScenarioBehaviors } from './concept_scenario_behaviors.fixture.js';

class AuthorName extends ConceptAs<string> { static readonly valueType = String; }
class Active extends ConceptAs<boolean> { static readonly valueType = Boolean; }

@eventType('concept-legacy-registered')
class AuthorRegistered {
    @field(AuthorName) @unique('concept-legacy-name') name: AuthorName;
    constructor(name: string) { this.name = new AuthorName(name); }
}

@eventType('concept-legacy-flag')
class FlagRecorded {
    @field(Active) @unique('concept-legacy-active') active: Active;
    constructor(active: boolean) { this.active = new Active(active); }
}

@eventType('concept-legacy-composite')
class FullNameRegistered {
    @field(AuthorName) first: AuthorName;
    @field(AuthorName) last: AuthorName;
    constructor(first: string, last: string) { this.first = new AuthorName(first); this.last = new AuthorName(last); }
}

@constraint('concept-legacy-full-name')
class FullName {
    define(builder: IConstraintBuilder) {
        builder.unique(key => key.on(FullNameRegistered, event => event.first, event => event.last).ignoreCasing());
    }
}

@eventType('concept-legacy-welcomed')
class AuthorWelcomed {
    @field(AuthorName) @unique('concept-legacy-welcome') name: AuthorName;
    constructor(name: string) { this.name = new AuthorName(name); }
}

@fromEvent(AuthorWelcomed)
@fromEvent(AuthorRegistered)
class Author {
    @field(String) id = '';
    @field(String) name = '';
}

@reactor('concept-legacy-welcomer')
class Welcomer {
    async authorRegistered(event: AuthorRegistered, context: { eventSourceId: string }, services: ReactorServices) {
        await services.eventStore.eventLog.append(context.eventSourceId, new AuthorWelcomed(String(event.name)));
    }
}

describe('when appending concept fields with legacy decorators', () => {
    conceptScenarioBehaviors({
        eventTypes: [AuthorRegistered, FlagRecorded, FullNameRegistered, AuthorWelcomed],
        constraints: [FullName],
        registered: name => new AuthorRegistered(name),
        flag: value => new FlagRecorded(value),
        composite: (first, last) => new FullNameRegistered(first, last),
        model: Author,
        reactor: Welcomer
    });
});
