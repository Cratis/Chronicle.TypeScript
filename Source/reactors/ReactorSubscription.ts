// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { prepareReactor } from './prepareReactor.js';

/** A locally validated subscription, shared by subsequent observation attempts. */
export type ReactorSubscription = ReturnType<typeof prepareReactor>;
