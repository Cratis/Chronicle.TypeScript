// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AutoMap } from '@cratis/chronicle.contracts';
import type { JoinRecord } from '../../projections/declarative/ProjectionBuilderCore.js';

/** A compiled join entry, including the contract's optional per-join AutoMap override. */
export interface ProjectionJoinRecord extends JoinRecord {
    Value: JoinRecord['Value'] & { AutoMap?: AutoMap };
}
