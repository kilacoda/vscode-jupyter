// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import { IServiceManager } from '../platform/ioc/types';
import { IExtensionActivationManager, IExtensionSingleActivationService } from '../platform/activation/types';
import { CommandRegistry as ExportCommandRegistry } from './import-export/commandRegistry';
import { ExtensionSideRenderer, IExtensionSideRenderer } from './renderer';
import { ActiveEditorContextService } from './context/activeEditorContext';
import { GlobalActivation } from './activation/globalActivation';
import { INotebookExporter } from '../kernels/jupyter/types';
import { JupyterExporter } from './import-export/jupyterExporter';
import { JupyterKernelServiceFactory } from './api/kernelApi';
import { IExportedKernelServiceFactory } from './api/api';
import { ApiAccessService } from './api/apiAccessService';
import { ExtensionActivationManager } from './activation/activationManager';
import { registerTypes as registerDevToolTypes } from './devTools/serviceRegistry';
import { IExtensionContext } from '../platform/common/types';

export function registerTypes(context: IExtensionContext, serviceManager: IServiceManager, isDevMode: boolean) {
    serviceManager.addSingleton<IExtensionSingleActivationService>(IExtensionSingleActivationService, GlobalActivation);
    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ActiveEditorContextService
    );

    serviceManager.addSingleton<IExtensionSingleActivationService>(
        IExtensionSingleActivationService,
        ExportCommandRegistry
    );

    serviceManager.addSingletonInstance<IExtensionSideRenderer>(IExtensionSideRenderer, new ExtensionSideRenderer());

    // Activation Manager
    serviceManager.add<IExtensionActivationManager>(IExtensionActivationManager, ExtensionActivationManager);
    serviceManager.add<INotebookExporter>(INotebookExporter, JupyterExporter);

    // API
    serviceManager.addSingleton<IExportedKernelServiceFactory>(
        IExportedKernelServiceFactory,
        JupyterKernelServiceFactory
    );
    serviceManager.addSingleton<ApiAccessService>(ApiAccessService, ApiAccessService);

    // Dev Tools
    registerDevToolTypes(context, serviceManager, isDevMode);
}
