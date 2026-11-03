// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { handles } from '../../../events/handles.js';
import { onceOnly } from '../../../reactors/onceOnly.js';
import { replay } from '../../../reactors/replay.js';
import { getReactorEventTypes } from '../../../reactors/ReactorDispatcher.js';
import { ReducerEventDispatcher } from '../../../reducers/ReducerEventDispatcher.js';
import { getBatchMethods } from '../BatchMethods.js';
import { EventTypeObservedByMoreThanOneMethod } from '../EventTypeObservedByMoreThanOneMethod.js';
import { InvalidBatchMethod } from '../InvalidBatchMethod.js';
import { observes } from '../observes.js';
import { ReducerMixesBatchAndPerEventMethods } from '../ReducerMixesBatchAndPerEventMethods.js';

chai.should();

@eventType('discovery-account-opened')
class AccountOpened {}

@eventType('discovery-money-deposited')
class MoneyDeposited {}

class Unregistered {}

const registered = [AccountOpened, MoneyDeposited];

describe('when discovering batch methods', () => {
    it('should find each batch method with the event types it observes', () => {
        class Accounts {
            @observes(AccountOpened)
            @observes(MoneyDeposited)
            all() {}
        }
        const [method] = getBatchMethods(Accounts, registered);
        method.methodName.should.equal('all');
        [...method.eventTypes.keys()].sort().should.deep.equal(['discovery-account-opened', 'discovery-money-deposited']);
    });

    it('should refuse an event type observed by two batch methods', () => {
        class Accounts {
            @observes(AccountOpened)
            first() {}

            @observes(AccountOpened)
            second() {}
        }
        (() => getBatchMethods(Accounts, registered)).should.throw(EventTypeObservedByMoreThanOneMethod);
    });

    it('should refuse an event type that is not registered', () => {
        class Accounts {
            @observes(Unregistered)
            all() {}
        }
        (() => getBatchMethods(Accounts, registered)).should.throw(InvalidBatchMethod, 'no registered event type');
    });

    it('should refuse a batch method that also declares per-event decorators', () => {
        class WithHandles {
            @observes(AccountOpened)
            @handles(MoneyDeposited)
            all() {}
        }
        class WithReplay {
            @observes(AccountOpened)
            @replay(AccountOpened)
            all() {}
        }
        class WithOnceOnly {
            @observes(AccountOpened)
            @onceOnly()
            all() {}
        }
        (() => getBatchMethods(WithHandles, registered)).should.throw(InvalidBatchMethod, '@handles');
        (() => getBatchMethods(WithReplay, registered)).should.throw(InvalidBatchMethod, '@replay');
        (() => getBatchMethods(WithOnceOnly, registered)).should.throw(InvalidBatchMethod, '@onceOnly');
    });
});

describe('when registering a reactor with batch methods', () => {
    it('should accept batch and per-event methods for different event types', () => {
        class Accounts {
            @observes(AccountOpened)
            opened() {}

            moneyDeposited() {}
        }
        getReactorEventTypes(Accounts, registered).map(entry => entry.methodName).should.deep.equal(['moneyDeposited']);
    });

    it('should refuse an event type reaching a batch method and a conventionally named per-event method', () => {
        class Accounts {
            @observes(AccountOpened)
            opened() {}

            accountOpened() {}
        }
        (() => getReactorEventTypes(Accounts, registered)).should.throw(EventTypeObservedByMoreThanOneMethod, "'opened', 'accountOpened'");
    });

    it('should refuse an event type reaching a batch method and an explicit per-event method', () => {
        class Accounts {
            @observes(AccountOpened)
            opened() {}

            @handles(AccountOpened)
            alsoOpened() {}
        }
        (() => getReactorEventTypes(Accounts, registered)).should.throw(EventTypeObservedByMoreThanOneMethod);
    });

    it('should not treat a batch method named after an event type as a per-event method', () => {
        class Accounts {
            @observes(AccountOpened)
            accountOpened() {}
        }
        getReactorEventTypes(Accounts, registered).should.be.empty;
    });
});

describe('when registering a reducer with a batch method', () => {
    it('should register the observed event types of its batch method', () => {
        class Balance {
            @observes(AccountOpened)
            @observes(MoneyDeposited)
            reduce() {}
        }
        const dispatcher = new ReducerEventDispatcher(Balance, registered);
        dispatcher.batchMethod!.methodName.should.equal('reduce');
        dispatcher.eventTypes.map(eventType => eventType.id).sort().should.deep.equal(['discovery-account-opened', 'discovery-money-deposited']);
    });

    it('should refuse a reducer mixing a batch method and per-event methods', () => {
        class Balance {
            @observes(AccountOpened)
            reduce() {}

            moneyDeposited() {}
        }
        (() => new ReducerEventDispatcher(Balance, registered)).should.throw(ReducerMixesBatchAndPerEventMethods);
    });

    it('should refuse a reducer with two batch methods', () => {
        class Balance {
            @observes(AccountOpened)
            opened() {}

            @observes(MoneyDeposited)
            deposited() {}
        }
        (() => new ReducerEventDispatcher(Balance, registered)).should.throw(ReducerMixesBatchAndPerEventMethods);
    });
});
