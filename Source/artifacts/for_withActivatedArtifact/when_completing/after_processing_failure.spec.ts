// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import type { ArtifactActivationContext } from '../../ArtifactActivationContext.js';
import { ArtifactCompletionFailed } from '../../ArtifactCompletionFailed.js';
import { withActivatedArtifact } from '../../withActivatedArtifact.js';

chai.should();

describe('when completing a lease after a processing failure', () => {
    it('should retain both original errors and dispose after completion', async () => {
        const processingError = new Error('processing');
        const completionError = new Error('completion');
        const steps: string[] = [];
        const activator = () => ({ instance: {}, complete: () => { steps.push('complete'); throw completionError; },
            dispose: () => { steps.push('dispose'); } });
        let failure: unknown;
        try {
            await withActivatedArtifact(Object, {} as ArtifactActivationContext, activator, async () => {
                steps.push('process');
                throw processingError;
            });
        } catch (error) {
            failure = error;
        }
        failure.should.be.instanceOf(ArtifactCompletionFailed);
        const completionFailure = failure as ArtifactCompletionFailed;
        completionFailure.processingError.should.equal(processingError);
        completionFailure.completionError.should.equal(completionError);
        completionFailure.cause.should.equal(completionError);
        steps.should.deep.equal(['process', 'complete', 'dispose']);
    });
});
