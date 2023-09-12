import * as monaco from 'monaco-editor';
import * as vscode from 'vscode';
import 'vscode/default-extensions/theme-defaults';
import 'vscode/default-extensions/python';
import { updateUserConfiguration } from 'vscode/service-override/configuration';
import { LogLevel } from 'vscode/services';
import { createConfiguredEditor, createModelReference } from 'vscode/monaco';
import { ExtensionHostKind, registerExtension } from 'vscode/extensions';
import { initServices, MonacoLanguageClient } from 'monaco-languageclient';
import { CloseAction, ErrorAction } from 'vscode-languageclient';
import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
  toSocket,
} from 'vscode-ws-jsonrpc';
import {
  RegisteredFileSystemProvider,
  registerFileSystemOverlay,
  RegisteredMemoryFile,
} from 'vscode/service-override/files';

// import { buildWorkerDefinition } from 'monaco-editor-workers';
import { useEffect } from 'react';
// buildWorkerDefinition(
//   '../../../../node_modules/monaco-editor-workers/dist/workers/',
//   new URL('', window.location.href).href,
//   false
// );

const LSPConnectedEditor = ({ uiac }) => {
  const languageId = 'python';
  let languageClient;

  useEffect(() => {
    // initalize and run python lang server client
    startPythonClient();
  }, []);

  const createWebSocket = (url) => {
    const webSocket = new WebSocket(url);
    webSocket.onopen = async () => {
      const socket = toSocket(webSocket);
      const reader = new WebSocketMessageReader(socket);
      const writer = new WebSocketMessageWriter(socket);
      languageClient = createLanguageClient({
        reader,
        writer,
      });
      await languageClient.start();
      reader.onClose(() => languageClient.stop());
    };
    return webSocket;
  };

  const createUrl = (
    hostname,
    port,
    path,
    searchParams = {},
    secure = window.location.protocol === 'https:'
  ) => {
    const protocol = secure ? 'wss' : 'ws';
    const url = new URL(`${protocol}://${hostname}:${port}${path}`);

    for (let [key, value] of Object.entries(searchParams)) {
      if (value instanceof Array) {
        value = value.join(',');
      }
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  };

  const createLanguageClient = (transports) => {
    return new MonacoLanguageClient({
      name: 'Pyright Language Client',
      clientOptions: {
        // use a language id as a document selector
        documentSelector: [languageId],
        // disable the default error handler
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
        // pyright requires a workspace folder to be present, otherwise it will not work
        workspaceFolder: {
          index: 0,
          name: 'workspace',
          uri: monaco.Uri.parse('/tmp'),
        },
        synchronize: {
          fileEvents: [vscode.workspace.createFileSystemWatcher('**')],
        },
      },
      // create a language client connection from the JSON RPC connection on demand
      connectionProvider: {
        get: () => {
          return Promise.resolve(transports);
        },
      },
    });
  };

  const startPythonClient = async () => {
    try {
      // init vscode-api
      await initServices({
        enableModelService: true,
        enableThemeService: true,
        enableTextmateService: true,
        configureConfigurationService: {
          defaultWorkspaceUri: '/tmp',
        },
        enableLanguagesService: true,
        enableKeybindingsService: true,
        debugLogging: true,
        logLevel: LogLevel.Debug,
      });

      const extension = {
        name: 'python-client',
        publisher: 'monaco-languageclient-project',
        version: '1.0.0',
        engines: {
          vscode: '^1.78.0',
        },
        contributes: {
          languages: [
            {
              id: languageId,
              aliases: ['Python'],
              extensions: ['.py', '.pyi'],
            },
          ],
          commands: [
            {
              command: 'pyright.restartserver',
              title: 'Pyright: Restart Server',
              category: 'Pyright',
            },
            {
              command: 'pyright.organizeimports',
              title: 'Pyright: Organize Imports',
              category: 'Pyright',
            },
          ],
          keybindings: [
            {
              key: 'ctrl+k',
              command: 'pyright.restartserver',
              when: 'editorTextFocus',
            },
          ],
        },
      };
      registerExtension(extension, ExtensionHostKind.LocalProcess);

      updateUserConfiguration(`{
        "editor.fontSize": 14,
        "workbench.colorTheme": "Default Dark+"
    }`);
      // Possible Values for color theme: Default Dark+, High Contrast

      const fileSystemProvider = new RegisteredFileSystemProvider(false);
      fileSystemProvider.registerFile(
        new RegisteredMemoryFile(
          vscode.Uri.file('/tmp/hello.py'),
          uiac || '# start your code here'
        )
      );
      registerFileSystemOverlay(1, fileSystemProvider);

      // create the web socket and configure to start the language client on open, can add extra parameters to the url if needed.
      createWebSocket(
        createUrl(
          'localhost',
          30000,
          '/pyright',
          {
            // Used to parse an auth token or additional parameters such as import IDs to the language server
            authorization: 'UserAuth',
            // By commenting above line out and commenting below line in, connection to language server will be denied.
            // authorization: 'FailedUserAuth'
          },
          false
        )
      );

      const registerCommand = async (cmdName, handler) => {
        // commands sould not be there, but it demonstrates how to retrieve list of all external commands
        const commands = await vscode.commands.getCommands(true);
        if (!commands.includes(cmdName)) {
          vscode.commands.registerCommand(cmdName, handler);
        }
      };
      // always exectute the command with current language client
      await registerCommand('pyright.restartserver', (...args) => {
        languageClient.sendRequest('workspace/executeCommand', {
          command: 'pyright.restartserver',
          arguments: args,
        });
      });
      await registerCommand('pyright.organizeimports', (...args) => {
        languageClient.sendRequest('workspace/executeCommand', {
          command: 'pyright.organizeimports',
          arguments: args,
        });
      });

      // use the file create before
      const modelRef = await createModelReference(
        monaco.Uri.file('/tmp/hello.py')
      );
      modelRef.object.setLanguageId(languageId);

      // create monaco editor
      createConfiguredEditor(document.getElementById('container'), {
        model: modelRef.object.textEditorModel,
        automaticLayout: true,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const getCodeFromEditor = () => {
    const editor = monaco.editor.getModels()[0];
    const code = editor.getValue();
    console.log(code);
  };

  const setCodeOnEditor = () => {
    const editor = monaco.editor.getModels()[0];
    if (uiac) {
      editor.setValue(uiac);
    }
  };

  return (
    <div>
      <button onClick={getCodeFromEditor}>Get Code</button>
      <button onClick={setCodeOnEditor}>Set Code</button>
      <div
        id="container"
        style={{ width: '600px', height: '500px', border: '1px solid grey' }}
      ></div>
    </div>
  );
};

export default LSPConnectedEditor;
