// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ChronicleConnection } from '../connection';
import { PIIManager } from './PIIManager';

function createPIIManager() {
    const deleteEncryptionKeyMock = vi.fn().mockResolvedValue(undefined);
    const allowNewEncryptionKeyMock = vi.fn().mockResolvedValue(undefined);
    const connection = {
        compliance: {
            deleteEncryptionKey: deleteEncryptionKeyMock,
            allowNewEncryptionKey: allowNewEncryptionKeyMock
        }
    } as unknown as ChronicleConnection;

    const manager = new PIIManager('test-store', 'test-namespace', connection);
    return { manager, deleteEncryptionKeyMock, allowNewEncryptionKeyMock };
}

describe('PIIManager', () => {
    describe('when deleting an encryption key', () => {
        it('should call the compliance service with the event store, namespace, and identifier', async () => {
            const { manager, deleteEncryptionKeyMock } = createPIIManager();

            await manager.deleteEncryptionKey('some-subject');

            expect(deleteEncryptionKeyMock).toHaveBeenCalledWith({
                EventStore: 'test-store',
                Namespace: 'test-namespace',
                Identifier: 'some-subject'
            });
        });
    });

    describe('when allowing a new encryption key', () => {
        it('should call the compliance service with the event store, namespace, and identifier', async () => {
            const { manager, allowNewEncryptionKeyMock } = createPIIManager();

            await manager.allowNewEncryptionKeyFor('some-subject');

            expect(allowNewEncryptionKeyMock).toHaveBeenCalledWith({
                EventStore: 'test-store',
                Namespace: 'test-namespace',
                Identifier: 'some-subject'
            });
        });
    });
});
