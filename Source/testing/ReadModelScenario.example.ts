// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { eventType } from '../events/eventTypeDecorator.js';
import { reducer } from '../reducers/reducer.js';
import { ReadModelScenario } from './index.js';

class BookBorrowed {
    constructor(readonly title: string) {}
}
eventType('book-borrowed')(BookBorrowed);

class BookStatus {
    title = '';
}

class BookStatusReducer {
    bookBorrowed(event: BookBorrowed): BookStatus {
        return { title: event.title };
    }
}
reducer('book-status-reducer', undefined, BookStatus)(BookStatusReducer);

/** An in-process read model example compiled with the SDK. */
export async function readModelScenarioExample(): Promise<BookStatus | null> {
    const scenario = new ReadModelScenario(BookStatus);
    scenario.given.forEventSource('book-42').events(new BookBorrowed('Dune'));
    return await scenario.instanceForEventSourceId('book-42');
}
