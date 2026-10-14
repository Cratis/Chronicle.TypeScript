// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { field } from '@cratis/fundamentals';
import { fromEvent } from '../../../projections/modelBound/fromEvent.js';
import { setValue } from '../../../projections/modelBound/setValue.js';
import { BookRegistered } from './BookRegistered.js';
import { BookBorrowed } from './BookBorrowed.js';
import { BookReturned } from './BookReturned.js';

export class Book {
    id = '';
    title: string | null = null;
    isbn: string | null = null;
    borrowed = false;
}
field(String)(Book.prototype, 'id');
field(String)(Book.prototype, 'title');
field(String)(Book.prototype, 'isbn');
field(Boolean)(Book.prototype, 'borrowed');
fromEvent(BookRegistered)(Book);
fromEvent(BookBorrowed)(Book);
fromEvent(BookReturned)(Book);
setValue(BookBorrowed, true)(Book.prototype, 'borrowed');
setValue(BookReturned, false)(Book.prototype, 'borrowed');
