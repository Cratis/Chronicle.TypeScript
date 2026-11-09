// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { chai, describe, it } from 'vitest';
import { contractsSupportChildrenOrdering } from '../childrenOrderingSupport.js';

chai.should();

// The contracts version this expectation was verified against. Bumping the contracts fails the first spec on purpose:
// re-check children ordering support for the new version, then update both the version and the expectation together.
const verifiedContractsVersion = '19.150.0';
const supportedInVerifiedVersion = true;

const pinnedContractsVersion = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    dependencies: Record<string, string>;
}).dependencies['@cratis/chronicle.contracts'];

describe('when detecting children ordering support in the pinned contracts', () => {
    it('should be verified against the pinned contracts version', () => pinnedContractsVersion.should.equal(verifiedContractsVersion));
    it('should match the verified support', () => contractsSupportChildrenOrdering().should.equal(supportedInVerifiedVersion));
});
