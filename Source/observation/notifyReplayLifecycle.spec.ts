// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ReplayState } from '@cratis/chronicle.contracts';
import { notifyReplayLifecycle } from './notifyReplayLifecycle';

describe('notifyReplayLifecycle', () => {
    describe('when the replay state is None', () => {
        it('should not call any hook even when the instance implements both contracts', async () => {
            const beginReplay = vi.fn();
            const endReplay = vi.fn();
            const beginReplayPartition = vi.fn();
            const endReplayPartition = vi.fn();

            await notifyReplayLifecycle(
                { beginReplay, endReplay, beginReplayPartition, endReplayPartition },
                ReplayState.REPLAY_STATE_None,
                'some-partition');

            expect(beginReplay).not.toHaveBeenCalled();
            expect(endReplay).not.toHaveBeenCalled();
            expect(beginReplayPartition).not.toHaveBeenCalled();
            expect(endReplayPartition).not.toHaveBeenCalled();
        });
    });

    describe('when the replay state is BeginReplay and the instance implements ICanBeNotifiedWhenReplay', () => {
        it('should call beginReplay', async () => {
            const beginReplay = vi.fn();
            const endReplay = vi.fn();

            await notifyReplayLifecycle({ beginReplay, endReplay }, ReplayState.BeginReplay, '');

            expect(beginReplay).toHaveBeenCalledTimes(1);
            expect(endReplay).not.toHaveBeenCalled();
        });
    });

    describe('when the replay state is EndReplay and the instance implements ICanBeNotifiedWhenReplay', () => {
        it('should call endReplay', async () => {
            const beginReplay = vi.fn();
            const endReplay = vi.fn();

            await notifyReplayLifecycle({ beginReplay, endReplay }, ReplayState.EndReplay, '');

            expect(endReplay).toHaveBeenCalledTimes(1);
            expect(beginReplay).not.toHaveBeenCalled();
        });
    });

    describe('when the replay state is BeginReplayPartition and the instance implements ICanBeNotifiedWhenPartitionReplayed', () => {
        it('should call beginReplayPartition with the partition', async () => {
            const beginReplayPartition = vi.fn();
            const endReplayPartition = vi.fn();

            await notifyReplayLifecycle({ beginReplayPartition, endReplayPartition }, ReplayState.BeginReplayPartition, 'partition-1');

            expect(beginReplayPartition).toHaveBeenCalledWith('partition-1');
            expect(endReplayPartition).not.toHaveBeenCalled();
        });
    });

    describe('when the replay state is EndReplayPartition and the instance implements ICanBeNotifiedWhenPartitionReplayed', () => {
        it('should call endReplayPartition with the partition', async () => {
            const beginReplayPartition = vi.fn();
            const endReplayPartition = vi.fn();

            await notifyReplayLifecycle({ beginReplayPartition, endReplayPartition }, ReplayState.EndReplayPartition, 'partition-1');

            expect(endReplayPartition).toHaveBeenCalledWith('partition-1');
            expect(beginReplayPartition).not.toHaveBeenCalled();
        });
    });

    describe('when the instance does not implement either contract', () => {
        it('should not throw for any replay state', async () => {
            const instance = {};

            await expect(notifyReplayLifecycle(instance, ReplayState.BeginReplay, '')).resolves.toBeUndefined();
            await expect(notifyReplayLifecycle(instance, ReplayState.EndReplay, '')).resolves.toBeUndefined();
            await expect(notifyReplayLifecycle(instance, ReplayState.BeginReplayPartition, 'p')).resolves.toBeUndefined();
            await expect(notifyReplayLifecycle(instance, ReplayState.EndReplayPartition, 'p')).resolves.toBeUndefined();
        });
    });

    describe('when the instance only implements ICanBeNotifiedWhenReplay but the state is partition-scoped', () => {
        it('should not call anything', async () => {
            const beginReplay = vi.fn();
            const endReplay = vi.fn();

            await notifyReplayLifecycle({ beginReplay, endReplay }, ReplayState.BeginReplayPartition, 'partition-1');

            expect(beginReplay).not.toHaveBeenCalled();
            expect(endReplay).not.toHaveBeenCalled();
        });
    });
});
