/* eslint-disable @typescript-eslint/no-explicit-any */
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';

import type { Session } from '@jupyterlab/services';
import { assert } from 'chai';
import { anything, instance, mock, when, verify } from 'ts-mockito';
import { getDisplayNameOrNameOfKernelConnection } from '../../../kernels/helpers';
import { PYTHON_LANGUAGE } from '../../../platform/common/constants';
import { Disposable, EventEmitter, Memento, Uri } from 'vscode';
import { CryptoUtils } from '../../../platform/common/crypto';
import { noop } from '../../core';
import {
    IJupyterConnection,
    IJupyterKernelSpec,
    IKernelFinder,
    KernelConnectionMetadata,
    LiveRemoteKernelConnectionMetadata
} from '../../../kernels/types';
import { IInterpreterService } from '../../../platform/interpreter/contracts';
import { JupyterSessionManager } from '../../../kernels/jupyter/session/jupyterSessionManager';
import { JupyterSessionManagerFactory } from '../../../kernels/jupyter/session/jupyterSessionManagerFactory';
import { RemoteKernelFinder } from '../../../kernels/jupyter/remoteKernelFinder';
import { ILocalKernelFinder, IRemoteKernelFinder } from '../../../kernels/raw/types';
import {
    ActiveKernelIdList,
    PreferredRemoteKernelIdProvider
} from '../../../kernels/jupyter/preferredRemoteKernelIdProvider';
import {
    IJupyterKernel,
    IJupyterRemoteCachedKernelValidator,
    IJupyterSessionManager
} from '../../../kernels/jupyter/types';
import { KernelFinder } from '../../../kernels/kernelFinder.node';
import { NotebookProvider } from '../../../kernels/jupyter/launcher/notebookProvider';
import { PythonExtensionChecker } from '../../../platform/api/pythonApi';
import { LocalKernelFinder } from '../../../kernels/raw/finder/localKernelFinder.node';
import { IFileSystemNode } from '../../../platform/common/platform/types.node';
import { JupyterServerUriStorage } from '../../../kernels/jupyter/launcher/serverUriStorage';
import { FileSystem } from '../../../platform/common/platform/fileSystem.node';
import { takeTopRankKernel } from './localKernelFinder.unit.test';
import { ServerConnectionType } from '../../../kernels/jupyter/launcher/serverConnectionType';
import { LocalKernelSpecsCacheKey, RemoteKernelSpecsCacheKey } from '../../../kernels/kernelFinder.base';

suite(`Remote Kernel Finder`, () => {
    let disposables: Disposable[] = [];
    let preferredRemoteKernelIdProvider: PreferredRemoteKernelIdProvider;
    let remoteKernelFinder: IRemoteKernelFinder;
    let localKernelFinder: ILocalKernelFinder;
    let kernelFinder: IKernelFinder;
    let fs: IFileSystemNode;
    let memento: Memento;
    let jupyterSessionManager: IJupyterSessionManager;
    const dummyEvent = new EventEmitter<number>();
    let interpreterService: IInterpreterService;
    let cachedRemoteKernelValidator: IJupyterRemoteCachedKernelValidator;
    const connInfo: IJupyterConnection = {
        url: 'http://foobar',
        type: 'jupyter',
        localLaunch: false,
        baseUrl: 'http://foobar',
        displayName: 'foobar connection',
        disconnected: dummyEvent.event,
        token: '',
        hostName: 'foobar',
        rootDirectory: Uri.file('.'),
        dispose: noop
    };
    const defaultPython3Name = 'python3';
    const python3spec: IJupyterKernelSpec = {
        display_name: 'Python 3 on Disk',
        name: defaultPython3Name,
        argv: ['/usr/bin/python3'],
        language: 'python',
        executable: 'specFilePath'
    };
    const python2spec: IJupyterKernelSpec = {
        display_name: 'Python 2 on Disk',
        name: 'python2',
        argv: ['/usr/bin/python'],
        language: 'python',
        executable: 'specFilePath'
    };
    const juliaSpec: IJupyterKernelSpec = {
        display_name: 'Julia on Disk',
        name: 'julia',
        argv: ['/usr/bin/julia'],
        language: 'julia',
        executable: 'specFilePath'
    };
    const interpreterSpec: IJupyterKernelSpec = {
        display_name: 'Conda interpreter kernel',
        name: defaultPython3Name,
        argv: ['python'],
        language: 'python',
        executable: 'specFilePath'
    };
    const python3Kernels: IJupyterKernel[] = ['1', '2', '3'].map((id) => {
        return {
            name: python3spec.display_name,
            lastActivityTime: new Date(),
            numberOfConnections: 1,
            id
        };
    });
    const python3Sessions: Session.IModel[] = ['S1', 'S2', 'S3'].map((sid, i) => {
        return {
            id: sid,
            name: sid,
            path: '.',
            type: '',
            kernel: {
                id: python3Kernels[i].id!,
                name: python3Kernels[i].name,
                model: {}
            }
        };
    });

    setup(() => {
        memento = mock<Memento>();
        when(memento.get(ActiveKernelIdList, anything())).thenReturn([]);
        const crypto = mock(CryptoUtils);
        when(crypto.createHash(anything(), anything())).thenCall((d, _c) => {
            return d.toLowerCase();
        });
        preferredRemoteKernelIdProvider = new PreferredRemoteKernelIdProvider(instance(memento), instance(crypto));
        jupyterSessionManager = mock(JupyterSessionManager);
        const jupyterSessionManagerFactory = mock(JupyterSessionManagerFactory);
        when(jupyterSessionManagerFactory.create(anything())).thenResolve(instance(jupyterSessionManager));
        interpreterService = mock<IInterpreterService>();
        localKernelFinder = mock(LocalKernelFinder);
        when(localKernelFinder.listKernels(anything(), anything())).thenResolve([]);
        const extensionChecker = mock(PythonExtensionChecker);
        when(extensionChecker.isPythonExtensionInstalled).thenReturn(true);

        remoteKernelFinder = new RemoteKernelFinder(
            instance(jupyterSessionManagerFactory),
            instance(interpreterService),
            instance(extensionChecker),
            false
        );

        const notebookProvider = mock(NotebookProvider);
        when(notebookProvider.connect(anything())).thenResolve(connInfo);
        fs = mock(FileSystem);
        when(fs.deleteLocalFile(anything())).thenResolve();
        when(fs.localFileExists(anything())).thenResolve(true);
        const serverUriStorage = mock(JupyterServerUriStorage);
        when(serverUriStorage.getUri()).thenResolve(connInfo.baseUrl);
        when(serverUriStorage.getRemoteUri()).thenResolve(connInfo.baseUrl);
        const connectionType = mock<ServerConnectionType>();
        when(connectionType.isLocalLaunch).thenReturn(false);
        when(connectionType.setIsLocalLaunch(anything())).thenResolve();
        const onDidChangeEvent = new EventEmitter<void>();
        disposables.push(onDidChangeEvent);
        when(connectionType.onDidChange).thenReturn(onDidChangeEvent.event);
        cachedRemoteKernelValidator = mock<IJupyterRemoteCachedKernelValidator>();
        when(cachedRemoteKernelValidator.isValid(anything())).thenResolve(true);
        kernelFinder = new KernelFinder(
            instance(localKernelFinder),
            remoteKernelFinder,
            preferredRemoteKernelIdProvider,
            instance(notebookProvider),
            instance(memento),
            instance(fs),
            instance(serverUriStorage),
            instance(connectionType),
            instance(cachedRemoteKernelValidator)
        );
    });
    teardown(() => {
        disposables.forEach((d) => d.dispose());
    });
    test('Kernels found', async () => {
        when(jupyterSessionManager.getRunningKernels()).thenResolve([]);
        when(jupyterSessionManager.getRunningSessions()).thenResolve([]);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([
            python3spec,
            python2spec,
            juliaSpec,
            interpreterSpec
        ]);
        const kernels = await remoteKernelFinder.listKernels(undefined, connInfo);
        assert.equal(kernels.length, 4, 'Not enough kernels returned');
        assert.equal(
            getDisplayNameOrNameOfKernelConnection(kernels[0]),
            'Python 3 on Disk',
            'Did not find correct python kernel'
        );
        assert.equal(
            getDisplayNameOrNameOfKernelConnection(kernels[1]),
            'Python 2 on Disk',
            'Did not find correct python 2 kernel'
        );
        assert.equal(
            getDisplayNameOrNameOfKernelConnection(kernels[2]),
            'Julia on Disk',
            'Did not find correct julia kernel'
        );
    });
    test('Live sessions', async () => {
        when(jupyterSessionManager.getRunningKernels()).thenResolve(python3Kernels);
        when(jupyterSessionManager.getRunningSessions()).thenResolve(python3Sessions);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([
            python3spec,
            python2spec,
            juliaSpec,
            interpreterSpec
        ]);
        const kernels = await remoteKernelFinder.listKernels(undefined, connInfo);
        const liveKernels = kernels.filter((k) => k.kind === 'connectToLiveRemoteKernel');
        assert.equal(liveKernels.length, 3, 'Live kernels not found');
    });
    test('Can match based on notebook metadata', async () => {
        when(jupyterSessionManager.getRunningKernels()).thenResolve(python3Kernels);
        when(jupyterSessionManager.getRunningSessions()).thenResolve(python3Sessions);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([
            python3spec,
            python2spec,
            juliaSpec,
            interpreterSpec
        ]);

        // Try python
        let kernel = await kernelFinder.rankKernels(undefined, {
            language_info: { name: PYTHON_LANGUAGE },
            orig_nbformat: 4
        });
        assert.ok(kernel, 'No python kernel found matching notebook metadata');

        // Julia
        kernel = await kernelFinder.rankKernels(undefined, {
            language_info: { name: 'julia' },
            orig_nbformat: 4
        });
        assert.ok(kernel, 'No julia kernel found matching notebook metadata');

        // Python 2
        kernel = await kernelFinder.rankKernels(undefined, {
            kernelspec: {
                display_name: 'Python 2 on Disk',
                name: 'python2'
            },
            language_info: { name: PYTHON_LANGUAGE },
            orig_nbformat: 4
        });
        assert.ok(kernel, 'No python2 kernel found matching notebook metadata');
    });
    test('Can match based on session id', async () => {
        when(jupyterSessionManager.getRunningKernels()).thenResolve(python3Kernels);
        when(jupyterSessionManager.getRunningSessions()).thenResolve(python3Sessions);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([
            python3spec,
            python2spec,
            juliaSpec,
            interpreterSpec
        ]);
        let activeKernelIdList: unknown = [];
        when(memento.update(anything(), anything())).thenCall((key, value) => {
            if (key === ActiveKernelIdList) {
                activeKernelIdList = value as any;
            }
            return Promise.resolve();
        });
        when(memento.get(ActiveKernelIdList, anything())).thenCall(() => activeKernelIdList);
        const uri = Uri.file('/usr/foobar/foo.ipynb');
        await preferredRemoteKernelIdProvider.storePreferredRemoteKernelId(uri, '2');

        const kernel = takeTopRankKernel(await kernelFinder.rankKernels(uri));
        assert.ok(kernel, 'Kernel not found for uri');
        assert.equal(kernel?.kind, 'connectToLiveRemoteKernel', 'Live kernel not found');
        assert.equal(
            (kernel as LiveRemoteKernelConnectionMetadata).kernelModel.name,
            python3Kernels[1].name,
            'Wrong live kernel returned'
        );

        verify(memento.update(ActiveKernelIdList, anything())).once();
    });
    test('Do not return cached remote kernelspecs or live kernels', async () => {
        const liveRemoteKernel: LiveRemoteKernelConnectionMetadata = {
            baseUrl: 'baseUrl1',
            id: '1',
            kernelModel: {
                lastActivityTime: new Date(),
                model: {
                    id: '1',
                    name: '',
                    path: '',
                    type: '',
                    kernel: {
                        id: '1',
                        name: ''
                    }
                },
                name: '',
                numberOfConnections: 0
            },
            kind: 'connectToLiveRemoteKernel',
            serverId: 'serverId1'
        };
        const cachedKernels: KernelConnectionMetadata[] = [
            {
                baseUrl: 'baseUrl1',
                id: '1',
                kernelSpec: {
                    argv: [],
                    display_name: '',
                    name: '',
                    executable: ''
                },
                kind: 'startUsingRemoteKernelSpec',
                serverId: 'serverId1'
            },
            liveRemoteKernel
        ];
        when(cachedRemoteKernelValidator.isValid(anything())).thenResolve(false);
        when(memento.get<KernelConnectionMetadata[]>(LocalKernelSpecsCacheKey, anything())).thenReturn([]);
        when(memento.get<KernelConnectionMetadata[]>(RemoteKernelSpecsCacheKey, anything())).thenReturn(cachedKernels);
        when(jupyterSessionManager.getRunningKernels()).thenResolve([]);
        when(jupyterSessionManager.getRunningSessions()).thenResolve([]);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([]);

        const kernels = await kernelFinder.listKernels(Uri.file('a.ipynb'), undefined, 'useCache');
        assert.lengthOf(kernels, 0);

        verify(cachedRemoteKernelValidator.isValid(liveRemoteKernel)).once();
    });
    test('Return cached remote live kernel if used', async () => {
        const liveRemoteKernel: LiveRemoteKernelConnectionMetadata = {
            baseUrl: 'baseUrl1',
            id: '1',
            kernelModel: {
                lastActivityTime: new Date(),
                model: {
                    id: '1',
                    name: '',
                    path: '',
                    type: '',
                    kernel: {
                        id: '1',
                        name: ''
                    }
                },
                name: '',
                numberOfConnections: 0
            },
            kind: 'connectToLiveRemoteKernel',
            serverId: 'serverId1'
        };
        const cachedKernels: KernelConnectionMetadata[] = [
            {
                baseUrl: 'baseUrl1',
                id: '1',
                kernelSpec: {
                    argv: [],
                    display_name: '',
                    name: '',
                    executable: ''
                },
                kind: 'startUsingRemoteKernelSpec',
                serverId: 'serverId1'
            },
            liveRemoteKernel
        ];
        when(cachedRemoteKernelValidator.isValid(anything())).thenResolve(false);
        when(cachedRemoteKernelValidator.isValid(liveRemoteKernel)).thenResolve(true);
        when(memento.get<KernelConnectionMetadata[]>(LocalKernelSpecsCacheKey, anything())).thenReturn([]);
        when(memento.get<KernelConnectionMetadata[]>(RemoteKernelSpecsCacheKey, anything())).thenReturn(cachedKernels);
        when(jupyterSessionManager.getRunningKernels()).thenResolve([]);
        when(jupyterSessionManager.getRunningSessions()).thenResolve([]);
        when(jupyterSessionManager.getKernelSpecs()).thenResolve([]);

        const kernels = await kernelFinder.listKernels(Uri.file('a.ipynb'), undefined, 'useCache');
        assert.lengthOf(kernels, 1);
        assert.deepEqual(kernels, [liveRemoteKernel]);

        verify(cachedRemoteKernelValidator.isValid(liveRemoteKernel)).once();
    });
});
