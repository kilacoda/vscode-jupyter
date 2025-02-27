// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

'use strict';

import { inject, injectable } from 'inversify';
import {
    NotebookDocument,
    DebugAdapterInlineImplementation,
    DebugSession,
    NotebookCell,
    DebugSessionOptions,
    DebugAdapterDescriptor,
    NotebookEditor,
    debug
} from 'vscode';
import * as path from '../../platform/vscode-path/path';
import { IKernelProvider } from '../../kernels/types';
import { IConfigurationService } from '../../platform/common/types';
import { Commands as DSCommands, EditorContexts } from '../../platform/common/constants';
import { IExtensionSingleActivationService } from '../../platform/activation/types';
import { ContextKey } from '../../platform/common/contextKey';
import { RunByLineController } from './runByLineController';
import { INotebookControllerManager } from '../types';
import { IApplicationShell, ICommandManager, IVSCodeNotebook } from '../../platform/common/application/types';
import { IPlatformService } from '../../platform/common/platform/types';
import { DebuggingTelemetry, pythonKernelDebugAdapter } from '../../kernels/debugger/constants';
import { sendTelemetryEvent } from '../../telemetry';
import { traceError, traceInfo, traceInfoIfCI } from '../../platform/logging';
import { DataScience } from '../../platform/common/utils/localize';
import { DebugCellController } from './debugCellControllers';
import { KernelDebugAdapter } from './kernelDebugAdapter';
import { assertIsDebugConfig, IpykernelCheckResult } from '../../kernels/debugger/helper';
import { IDebuggingManager, IKernelDebugAdapterConfig, KernelDebugMode } from '../../kernels/debugger/types';
import { DebuggingManagerBase } from './debuggingManagerBase';
import { noop } from '../../platform/common/utils/misc';

/**
 * The DebuggingManager maintains the mapping between notebook documents and debug sessions.
 */
@injectable()
export class DebuggingManager
    extends DebuggingManagerBase
    implements IExtensionSingleActivationService, IDebuggingManager
{
    private debuggingInProgress: ContextKey;
    private runByLineInProgress: ContextKey;
    private notebookToRunByLineController = new Map<NotebookDocument, RunByLineController>();

    public constructor(
        @inject(IKernelProvider) kernelProvider: IKernelProvider,
        @inject(INotebookControllerManager) notebookControllerManager: INotebookControllerManager,
        @inject(ICommandManager) commandManager: ICommandManager,
        @inject(IApplicationShell) appShell: IApplicationShell,
        @inject(IVSCodeNotebook) vscNotebook: IVSCodeNotebook,
        @inject(IConfigurationService) private readonly settings: IConfigurationService,
        @inject(IPlatformService) private readonly platform: IPlatformService
    ) {
        super(kernelProvider, notebookControllerManager, commandManager, appShell, vscNotebook);
        this.debuggingInProgress = new ContextKey(EditorContexts.DebuggingInProgress, commandManager);
        this.runByLineInProgress = new ContextKey(EditorContexts.RunByLineInProgress, commandManager);
        this.updateToolbar(false);
        this.updateCellToolbar(false);

        this.disposables.push(
            vscNotebook.onDidChangeActiveNotebookEditor(
                (e?: NotebookEditor) => {
                    if (e) {
                        this.updateCellToolbar(this.isDebugging(e.notebook));
                        this.updateToolbar(this.isDebugging(e.notebook));
                    }
                },
                this,
                this.disposables
            )
        );
    }

    public override async activate() {
        await super.activate();
        this.disposables.push(
            // factory for kernel debug adapters
            debug.registerDebugAdapterDescriptorFactory(pythonKernelDebugAdapter, {
                createDebugAdapterDescriptor: async (session) => this.createDebugAdapterDescriptor(session)
            }),
            this.commandManager.registerCommand(DSCommands.DebugNotebook, async () => {
                const editor = this.vscNotebook.activeNotebookEditor;
                await this.tryToStartDebugging(KernelDebugMode.Everything, editor);
            }),

            this.commandManager.registerCommand(DSCommands.RunByLine, async (cell: NotebookCell | undefined) => {
                sendTelemetryEvent(DebuggingTelemetry.clickedRunByLine);
                const editor = this.vscNotebook.activeNotebookEditor;
                if (!cell) {
                    const range = editor?.selections[0];
                    if (range) {
                        cell = editor?.notebook.cellAt(range.start);
                    }
                }

                if (!cell) {
                    return;
                }

                await this.tryToStartDebugging(KernelDebugMode.RunByLine, editor, cell);
            }),

            this.commandManager.registerCommand(DSCommands.RunByLineNext, (cell: NotebookCell | undefined) => {
                if (!cell) {
                    const editor = this.vscNotebook.activeNotebookEditor;
                    const range = editor?.selections[0];
                    if (range) {
                        cell = editor?.notebook.cellAt(range.start);
                    }
                }

                if (!cell) {
                    return;
                }

                if (this.notebookInProgress.has(cell.notebook)) {
                    return;
                }

                const controller = this.notebookToRunByLineController.get(cell.notebook);
                if (controller && controller.debugCell.document.uri.toString() === cell.document.uri.toString()) {
                    controller.continue();
                }
            }),

            this.commandManager.registerCommand(DSCommands.RunByLineStop, () => {
                const editor = this.vscNotebook.activeNotebookEditor;
                if (editor) {
                    const controller = this.notebookToRunByLineController.get(editor.notebook);
                    if (controller) {
                        sendTelemetryEvent(DebuggingTelemetry.endedSession, undefined, {
                            reason: 'withKeybinding'
                        });
                        controller.stop();
                    }
                }
            }),

            this.commandManager.registerCommand(DSCommands.RunAndDebugCell, async (cell: NotebookCell | undefined) => {
                sendTelemetryEvent(DebuggingTelemetry.clickedRunAndDebugCell);
                const editor = this.vscNotebook.activeNotebookEditor;
                if (!cell) {
                    const range = editor?.selections[0];
                    if (range) {
                        cell = editor?.notebook.cellAt(range.start);
                    }
                }

                if (!cell) {
                    return;
                }

                await this.tryToStartDebugging(KernelDebugMode.Cell, editor, cell);
            })
        );
    }

    public getDebugMode(notebook: NotebookDocument): KernelDebugMode | undefined {
        const controller = this.notebookToRunByLineController.get(notebook);
        return controller?.getMode();
    }

    protected override onDidStopDebugging(_notebook: NotebookDocument) {
        this.updateToolbar(false);
        this.updateCellToolbar(false);
    }

    private updateToolbar(debugging: boolean) {
        this.debuggingInProgress.set(debugging).ignoreErrors();
    }

    private updateCellToolbar(runningByLine: boolean) {
        this.runByLineInProgress.set(runningByLine).ignoreErrors();
    }

    private async tryToStartDebugging(mode: KernelDebugMode, editor?: NotebookEditor, cell?: NotebookCell) {
        traceInfoIfCI(`Starting debugging with mode ${mode}`);

        if (!editor) {
            this.appShell.showErrorMessage(DataScience.noNotebookToDebug()).then(noop, noop);
            return;
        }

        if (this.notebookInProgress.has(editor.notebook)) {
            traceInfo(`Cannot start debugging. Already debugging this notebook`);
            return;
        }

        if (this.isDebugging(editor.notebook)) {
            traceInfo(`Cannot start debugging. Already debugging this notebook document. Toolbar should update`);
            this.updateToolbar(true);
            if (mode === KernelDebugMode.RunByLine) {
                this.updateCellToolbar(true);
            }
            return;
        }

        const checkIpykernelAndStart = async (allowSelectKernel = true): Promise<void> => {
            const ipykernelResult = await this.checkForIpykernel6(editor.notebook);
            switch (ipykernelResult) {
                case IpykernelCheckResult.NotInstalled:
                    // User would have been notified about this, nothing more to do.
                    return;
                case IpykernelCheckResult.Outdated:
                case IpykernelCheckResult.Unknown: {
                    this.promptInstallIpykernel6().then(noop, noop);
                    return;
                }
                case IpykernelCheckResult.Ok: {
                    switch (mode) {
                        case KernelDebugMode.Everything: {
                            await this.startDebugging(editor.notebook);
                            this.updateToolbar(true);
                            return;
                        }
                        case KernelDebugMode.Cell:
                            if (cell) {
                                await this.startDebuggingCell(editor.notebook, KernelDebugMode.Cell, cell);
                                this.updateToolbar(true);
                            }
                            return;
                        case KernelDebugMode.RunByLine:
                            if (cell) {
                                await this.startDebuggingCell(editor.notebook, KernelDebugMode.RunByLine, cell);
                                this.updateToolbar(true);
                                this.updateCellToolbar(true);
                            }
                            return;
                        default:
                            return;
                    }
                }
                case IpykernelCheckResult.ControllerNotSelected: {
                    if (allowSelectKernel) {
                        await this.commandManager.executeCommand('notebook.selectKernel', { notebookEditor: editor });
                        await checkIpykernelAndStart(false);
                    }
                }
            }
        };

        try {
            this.notebookInProgress.add(editor.notebook);
            await checkIpykernelAndStart();
        } catch (e) {
            traceInfo(`Error starting debugging: ${e}`);
        } finally {
            this.notebookInProgress.delete(editor.notebook);
        }
    }
    private async startDebuggingCell(
        doc: NotebookDocument,
        mode: KernelDebugMode.Cell | KernelDebugMode.RunByLine,
        cell: NotebookCell
    ) {
        const config: IKernelDebugAdapterConfig = {
            type: pythonKernelDebugAdapter,
            name: path.basename(doc.uri.toString()),
            request: 'attach',
            justMyCode: true,
            // add a property to the config to know if the session is runByLine
            __mode: mode,
            __cellIndex: cell.index
        };
        const opts: DebugSessionOptions | undefined =
            mode === KernelDebugMode.RunByLine
                ? { debugUI: { simple: true }, suppressSaveBeforeStart: true }
                : { suppressSaveBeforeStart: true };
        return this.startDebuggingConfig(doc, config, opts);
    }

    private async startDebugging(doc: NotebookDocument) {
        const config: IKernelDebugAdapterConfig = {
            type: pythonKernelDebugAdapter,
            name: path.basename(doc.uri.toString()),
            request: 'attach',
            internalConsoleOptions: 'neverOpen',
            justMyCode: false,
            __mode: KernelDebugMode.Everything
        };
        return this.startDebuggingConfig(doc, config);
    }

    protected override async createDebugAdapterDescriptor(
        session: DebugSession
    ): Promise<DebugAdapterDescriptor | undefined> {
        const config = session.configuration;
        assertIsDebugConfig(config);
        const activeDoc = config.__interactiveWindowNotebookUri
            ? this.vscNotebook.notebookDocuments.find(
                  (doc) => doc.uri.toString() === config.__interactiveWindowNotebookUri
              )
            : this.vscNotebook.activeNotebookEditor?.notebook;
        if (activeDoc) {
            // TODO we apparently always have a kernel here, clean up typings
            const kernel = await this.ensureKernelIsRunning(activeDoc);
            const debug = this.getDebuggerByUri(activeDoc);

            if (debug) {
                if (kernel?.session) {
                    const adapter = new KernelDebugAdapter(
                        session,
                        debug.document,
                        kernel.session,
                        kernel,
                        this.platform
                    );

                    if (config.__mode === KernelDebugMode.RunByLine && typeof config.__cellIndex === 'number') {
                        const cell = activeDoc.cellAt(config.__cellIndex);
                        const controller = new RunByLineController(
                            adapter,
                            cell,
                            this.commandManager,
                            kernel!,
                            this.settings
                        );
                        adapter.setDebuggingDelegate(controller);
                        this.notebookToRunByLineController.set(debug.document, controller);
                    } else if (config.__mode === KernelDebugMode.Cell && typeof config.__cellIndex === 'number') {
                        const cell = activeDoc.cellAt(config.__cellIndex);
                        const controller = new DebugCellController(adapter, cell, kernel!, this.commandManager);
                        adapter.setDebuggingDelegate(controller);
                    }

                    this.trackDebugAdapter(debug.document, adapter);

                    // Wait till we're attached before resolving the session
                    debug.resolve(session);
                    return new DebugAdapterInlineImplementation(adapter);
                } else {
                    this.appShell.showInformationMessage(DataScience.kernelWasNotStarted()).then(noop, noop);
                }
            }
        }
        traceError('Debug sessions should start only from the cell toolbar command');
        return;
    }
}
