// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { inject, injectable } from 'inversify';
import { Uri } from 'vscode';
import { IServiceContainer } from '../../ioc/types';
import { JupyterSettings } from '../configSettings';
import { IWatchableJupyterSettings } from '../types';
import { SystemVariables } from '../variables/systemVariables.web';
import { BaseConfigurationService } from './service.base';

@injectable()
export class ConfigurationService extends BaseConfigurationService {
    // eslint-disable-next-line @typescript-eslint/no-useless-constructor
    constructor(@inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super(serviceContainer);
    }
    public getSettings(resource?: Uri): IWatchableJupyterSettings {
        return JupyterSettings.getInstance(resource, SystemVariables, 'web', this.workspaceService);
    }
}
