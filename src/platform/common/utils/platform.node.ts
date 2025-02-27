// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { Uri } from 'vscode';
import * as os from 'os';
import { fsPathToUri } from '../../vscode-path/utils';
import { EnvironmentVariables } from '../variables/types';
import { getOSType, OSType } from './platform';
export * from './platform';

// Home path depends upon OS
const homePath = os.homedir();

export function getEnvironmentVariable(key: string): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (process.env as any as EnvironmentVariables)[key];
}

export function getPathEnvironmentVariable(): string | undefined {
    return getEnvironmentVariable('Path') || getEnvironmentVariable('PATH');
}

export function getUserHomeDir(): Uri | undefined {
    if (getOSType() === OSType.Windows) {
        return fsPathToUri(getEnvironmentVariable('USERPROFILE') || homePath);
    }
    const homeVar = getEnvironmentVariable('HOME') || getEnvironmentVariable('HOMEPATH') || homePath;

    // Make sure if linux, it uses linux separators
    return fsPathToUri(homeVar?.replace(/\\/g, '/'));
}
