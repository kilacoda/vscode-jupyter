/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { assert, use } from 'chai';

import { anything, instance, mock, verify, when } from 'ts-mockito';
import { EventEmitter } from 'vscode';
import { JupyterConnection } from '../../../kernels/jupyter/jupyterConnection';
import { ServerConnectionType } from '../../../kernels/jupyter/launcher/serverConnectionType';
import {
    IJupyterServerUriStorage,
    IJupyterSessionManager,
    IJupyterSessionManagerFactory,
    IJupyterUriProviderRegistration
} from '../../../kernels/jupyter/types';
import { disposeAllDisposables } from '../../../platform/common/helpers';
import { IDisposable } from '../../../platform/common/types';
import * as chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);
suite('Jupyter Connection', async () => {
    let jupyterConnection: JupyterConnection;
    let registrationPicker: IJupyterUriProviderRegistration;
    let sessionManagerFactory: IJupyterSessionManagerFactory;
    let serverConnectionType: ServerConnectionType;
    let sessionManager: IJupyterSessionManager;
    let serverUriStorage: IJupyterServerUriStorage;
    const disposables: IDisposable[] = [];
    setup(() => {
        registrationPicker = mock<IJupyterUriProviderRegistration>();
        sessionManagerFactory = mock<IJupyterSessionManagerFactory>();
        serverConnectionType = mock<ServerConnectionType>();
        sessionManager = mock<IJupyterSessionManager>();
        serverUriStorage = mock<IJupyterServerUriStorage>();
        jupyterConnection = new JupyterConnection(
            instance(registrationPicker),
            instance(sessionManagerFactory),
            disposables,
            instance(serverConnectionType),
            instance(serverUriStorage)
        );

        (instance(sessionManager) as any).then = undefined;
        when(sessionManagerFactory.create(anything(), anything())).thenResolve(instance(sessionManager));
        const serverConnectionChangeEvent = new EventEmitter<void>();
        disposables.push(serverConnectionChangeEvent);

        when(serverConnectionType.onDidChange).thenReturn(serverConnectionChangeEvent.event);

        jupyterConnection.activate();
    });
    teardown(() => {
        disposeAllDisposables(disposables);
    });

    test('Ensure event handler is added', () => {
        verify(serverConnectionType.onDidChange).once();
    });
    test('Validation will result in fetching kernels and kernelspecs', async () => {
        const uri = 'http://localhost:8888/?token=1234';
        when(sessionManager.dispose()).thenResolve();
        when(sessionManager.getKernelSpecs()).thenResolve([]);
        when(sessionManager.getRunningKernels()).thenResolve([]);

        await jupyterConnection.validateRemoteUri(uri);

        verify(sessionManager.getKernelSpecs()).once();
        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.dispose()).once();
    });
    test('Validation will fail if fetching kernels fail', async () => {
        const uri = 'http://localhost:8888/?token=1234';
        when(sessionManager.dispose()).thenResolve();
        when(sessionManager.getKernelSpecs()).thenResolve([]);
        when(sessionManager.getRunningKernels()).thenReject(new Error('Kaboom kernels failure'));

        await assert.isRejected(jupyterConnection.validateRemoteUri(uri), 'Kaboom kernels failure');

        verify(sessionManager.getKernelSpecs()).once();
        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.dispose()).once();
    });
    test('Validation will fail if fetching kernelspecs fail', async () => {
        const uri = 'http://localhost:8888/?token=1234';
        when(sessionManager.dispose()).thenResolve();
        when(sessionManager.getKernelSpecs()).thenReject(new Error('Kaboom kernelspec failure'));
        when(sessionManager.getRunningKernels()).thenResolve([]);

        await assert.isRejected(jupyterConnection.validateRemoteUri(uri), 'Kaboom kernelspec failure');

        verify(sessionManager.getKernelSpecs()).once();
        verify(sessionManager.getRunningKernels()).once();
        verify(sessionManager.dispose()).once();
    });
});
