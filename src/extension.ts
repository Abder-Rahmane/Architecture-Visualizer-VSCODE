import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.rootPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace is opened');
        return;
    }

    context.subscriptions.push(vscode.commands.registerCommand('archgen.generate', () => {
        const panel = vscode.window.createWebviewPanel(
            'fileExplorer',
            'File Explorer',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.html = getWebviewContent(workspaceRoot);

        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'generate':
                        panel.webview.postMessage({ command: 'showButtonLoading' });
                        const excludedPaths = message.excluded;
                        const workspaceName = path.basename(workspaceRoot);
                        const structure = generateStructure(workspaceRoot, excludedPaths, workspaceName);
                        const filePath = path.join(workspaceRoot, 'architecture.txt');
                        fs.writeFileSync(filePath, structure);
                        vscode.window.showInformationMessage('Architecture generated successfully');
                        vscode.workspace.openTextDocument(filePath).then(doc => {
                            vscode.window.showTextDocument(doc);
                            panel.webview.postMessage({ command: 'hideButtonLoading' });
                        });
                        return;
                    case 'copy':
                        vscode.env.clipboard.writeText(message.structure);
                        vscode.window.showInformationMessage('Architecture copied to clipboard');
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    }));
}

function getWebviewContent(workspaceRoot: string): string {
    const allFiles = listAllFiles(workspaceRoot);
    const fileTreeData = generateFileTreeData(allFiles);

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>File Explorer</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.12/themes/default/style.min.css" />
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                #fileTree { margin-top: 20px; }
                .icon-button { cursor: pointer; font-size: 1em; }
                .generate-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    border: solid 1px;
                    padding: 5px 10px;
                    border-radius: 5px;
                    cursor: pointer;
                    background-color: #f5f5f5;
                    display: flex;
                    align-items: center;
                    color: black;
                }
                .generate-button.loading {
                    pointer-events: none;
                    opacity: 0.6;
                }
                .loading-icon {
                    display: none;
                    margin-left: 5px;
                    font-size: 0.8em;
                    vertical-align: middle;
                }
                .loading-icon.show {
                    display: inline-block;
                }
                .spinner {
                    display: none;
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 1.5em;
                    color: #333;
                }
                .spinner.show {
                    display: block;
                }
                .folder-loading {
                    display: none;
                    margin-left: 10px;
                    font-size: 0.8em;
                    vertical-align: middle;
                }
                .folder-loading.show {
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div id="loading" class="spinner">Loading...</div>
            <h1>Select directories and files to exclude from the architecture</h1>
            <div id="fileTree"></div>
            <div class="generate-button" onclick="copyToClipboard()">
                <span>Generate Architecture</span>
                <i id="buttonLoading" class="fas fa-spinner fa-spin loading-icon"></i>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jstree/3.3.12/jstree.min.js"></script>
            <script>
                const vscode = acquireVsCodeApi();
                const fileTreeData = ${JSON.stringify(fileTreeData)};
                let generatedStructure = '';

                $(document).ready(function() {
                    $('#loading').addClass('show');
                    $('#fileTree').jstree({
                        'core': {
                            'data': fileTreeData,
                            'themes': {
                                'icons': true
                            }
                        },
                        'plugins': ['checkbox']
                    });

                    $('#fileTree').on('loaded.jstree', function() {
                        $('#loading').removeClass('show');
                    });

                    $('#fileTree').on('check_node.jstree', function(e, data) {
                        const node = data.node;
                        if (node && node.children_d.length) {
                            showFolderLoadingIcon(node.id);
                            setTimeout(() => hideFolderLoadingIcon(node.id), 2000); // Simulate loading delay
                        }
                    });

                    $('#fileTree').on('uncheck_node.jstree', function(e, data) {
                        const node = data.node;
                        hideFolderLoadingIcon(node.id);
                    });
                });

                function showFolderLoadingIcon(nodeId) {
                    const nodeElement = document.getElementById(nodeId + '_anchor');
                    if (nodeElement) {
                        const loadingIcon = document.createElement('i');
                        loadingIcon.className = 'fas fa-spinner fa-spin folder-loading';
                        loadingIcon.id = 'loading_' + nodeId;
                        nodeElement.appendChild(loadingIcon);
                        setTimeout(() => hideFolderLoadingIcon(nodeId), 2000); // Simulate loading delay
                    }
                }

                function hideFolderLoadingIcon(nodeId) {
                    const loadingIcon = document.getElementById('loading_' + nodeId);
                    if (loadingIcon) {
                        loadingIcon.remove();
                    }
                }

                function generateStructure() {
                    const selectedNodes = $('#fileTree').jstree('get_checked', true);
                    const excluded = selectedNodes.map(node => node.data.filePath);
                    vscode.postMessage({ command: 'generate', excluded });
                }

                function copyToClipboard() {
                    generateStructure();
                    vscode.postMessage({ command: 'copy', structure: generatedStructure });
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'showButtonLoading') {
                        document.querySelector('.generate-button').classList.add('loading');
                        document.getElementById('buttonLoading').classList.add('show');
                    } else if (message.command === 'hideButtonLoading') {
                        document.querySelector('.generate-button').classList.remove('loading');
                        document.getElementById('buttonLoading').classList.remove('show');
                    }
                });
            </script>
        </body>
        </html>
    `;
}

function listAllFiles(dir: string, baseDir: string = '', depth: number = 0): { label: string, filePath: string, relativePath: string, isDirectory: boolean }[] {
    let allFiles: { label: string, filePath: string, relativePath: string, isDirectory: boolean }[] = [];
    const files = fs.readdirSync(dir).sort((a, b) => {
        const aStats = fs.statSync(path.join(dir, a));
        const bStats = fs.statSync(path.join(dir, b));
        if (aStats.isDirectory() && !bStats.isDirectory()) { return -1; }
        if (!aStats.isDirectory() && bStats.isDirectory()) { return 1; }
        return a.localeCompare(b);
    });

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const relativePath = path.join(baseDir, file);

        if (stats.isDirectory()) {
            allFiles.push({ label: file, filePath: filePath, relativePath: relativePath, isDirectory: true });
            allFiles = allFiles.concat(listAllFiles(filePath, relativePath, depth + 1));
        } else {
            allFiles.push({ label: file, filePath: filePath, relativePath: relativePath, isDirectory: false });
        }
    });

    return allFiles;
}

function generateFileTreeData(files: { label: string, filePath: string, relativePath: string, isDirectory: boolean }[]): any[] {
    const fileTreeData: any[] = [];
    const fileMap: { [key: string]: any } = {};

    files.forEach(file => {
        const iconClass = file.isDirectory ? 'jstree-folder' : 'jstree-file';

        const fileNode = {
            text: file.label,
            data: { filePath: file.filePath },
            state: { opened: false, selected: false },
            children: file.isDirectory ? [] : false,
            icon: iconClass
        };

        fileMap[file.relativePath] = fileNode;

        const parentPath = path.dirname(file.relativePath);
        if (parentPath === '.') {
            fileTreeData.push(fileNode);
        } else {
            if (!fileMap[parentPath].children) {
                fileMap[parentPath].children = [];
            }
            fileMap[parentPath].children.push(fileNode);
        }
    });

    return fileTreeData;
}

function generateStructure(dir: string, excludedPaths: string[], workspaceName: string, depth: number = 0, prefix: string = ''): string {
    let structure = '';
    if (depth === 0) {
        structure += `${workspaceName}\n`;
    }
    const files = fs.readdirSync(dir).sort((a, b) => {
        const aStats = fs.statSync(path.join(dir, a));
        const bStats = fs.statSync(path.join(dir, b));
        if (aStats.isDirectory() && !bStats.isDirectory()) { return -1; }
        if (!aStats.isDirectory() && bStats.isDirectory()) { return 1; }
        return a.localeCompare(b);
    });

    files.forEach((file, index) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const isLast = index === files.length - 1;
        const currentPrefix = prefix + (depth > 0 ? (isLast ? '└── ' : '├── ') : '│   ');

        const isExcluded = excludedPaths.some(excludedPath => {
            return filePath === excludedPath || filePath.startsWith(excludedPath + path.sep);
        });

        if (!isExcluded) {
            if (stats.isDirectory()) {
                structure += `${currentPrefix}${file}\n`;
                structure += generateStructure(filePath, excludedPaths, workspaceName, depth + 1, prefix + (isLast ? '    ' : '│   '));
            } else {
                structure += `${currentPrefix}${file}\n`;
            }
        }
    });

    return structure;
}

export function deactivate() {}
