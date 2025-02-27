// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { BaseError } from './types';

export class JupyterSelfCertsError extends BaseError {
    constructor(message: string) {
        super('jupyterselfcert', message);
    }
    public static isSelfCertsError(err: Error) {
        return err.message.indexOf('reason: self signed certificate') >= 0;
    }
}
