// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ReadModels } from '../../ReadModels.js';
import { Book } from '../given/Book.js';

const should = chai.should();

for (const borrowed of [true, false]) {
    describe(`when reading a model-bound projection after a book is ${borrowed ? 'borrowed' : 'returned'} without registration fields`, () => {
        let result: Book;

        beforeEach(async () => {
            const connection = {
                readModels: { getInstanceByKey: vi.fn().mockResolvedValue({ ReadModel: JSON.stringify({ id: 'book', borrowed }) }) }
            } as unknown as ChronicleConnection;
            const artifacts = { readModels: [Book], projections: [], reducers: [] } as unknown as IClientArtifactsProvider;
            const readModels = new ReadModels('store', 'tenant', connection, artifacts, 'sink');
            result = await readModels.getInstanceById(Book, 'book');
        });

        it('should restore the model type', () => result.should.be.instanceOf(Book));
        it('should keep the title null', () => should.equal(result.title, null));
        it('should keep the isbn null', () => should.equal(result.isbn, null));
        it('should restore the borrowed state', () => result.borrowed.should.equal(borrowed));
    });
}
