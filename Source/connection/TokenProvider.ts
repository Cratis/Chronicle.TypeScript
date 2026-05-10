// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ITokenProvider } from '@cratis/chronicle.contracts';

export {
	NoOpTokenProvider,
	OAuthTokenProvider
} from '@cratis/chronicle.contracts';

export type { ITokenProvider } from '@cratis/chronicle.contracts';

export type TokenProvider = ITokenProvider;