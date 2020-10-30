"use strict";

import * as vscode from 'vscode';

const multiLineFormat = [
    '/*',
    ' * {text}',
    ' */'
];

export function activate(context: vscode.ExtensionContext) {
    const disposableListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) {
            return null;
        }
        const contentChange: vscode.TextDocumentContentChangeEvent = event.contentChanges[0];
        if (!contentChange.text) {
            return null;
        }

        const configuration = vscode.workspace.getConfiguration();
        const autoCloseComment = configuration.get<boolean>("multi-line-comment-formatter.autoCloseComment");
        const autoLineWrapping = configuration.get<boolean>("multi-line-comment-formatter.autoLineWrapping");
        const columnLimit = configuration.get<number>("multi-line-comment-formatter.columnLimit");

        if (!vscode.window.activeTextEditor) {
            return null;
        }
        const editor = vscode.window.activeTextEditor;
        const document = editor.document;
        const startLineNumber: number = editor.selection.start.line;
        const startLine: vscode.TextLine = document.lineAt(startLineNumber);
        const nextLine: vscode.TextLine = document.lineAt(startLineNumber + 1);
        const cursorOffset: number = contentChange.range.start.character + contentChange.text.length;
        const cursorAtEol = cursorOffset === startLine.range.end.character;
        const eol = document.eol === vscode.EndOfLine.LF ? '\n' : `\r\n`;

        if (autoCloseComment && hasOnlyBlanks(contentChange.text)) {
            const startSequenceMatched = startLine.text.split('/*')[1] === contentChange.text;

            if (editor.selection.isEmpty && cursorAtEol && startSequenceMatched) {
                editor.edit((editBuilder) => {
                    editBuilder.replace(startLine.range, startLine.text.trimEnd() + '  */');
                }).then(() => {
                    setCursorPosition(editor, startLineNumber, -3);
                });
            }
        }

        if (contentChange.text.startsWith(eol)) {
            const currentAndNextLines = new vscode.Range(startLine.range.start, nextLine.range.end);
            const commentMatch = document.getText(currentAndNextLines).match(/^( *)\/\* (.*)\n *(.*) \*\//);

            if (commentMatch) {
                const [, indentation, ...unformattedLines] = commentMatch;
                const formattedText = formatIntoMultiLineComment(unformattedLines, indentation, eol);

                editor.edit((editBuilder) => {
                    editBuilder.replace(currentAndNextLines, formattedText);
                }).then(() => {
                    setCursorPosition(editor, startLineNumber + 2, -unformattedLines[1].trimEnd().length);
                });
            }
        }
        else if (autoLineWrapping && editor.selection.start.character === columnLimit) {
            if (contentChange.text.length !== 1) {
                return null;
            }
            const singleLineCommentMatch = startLine.text.match(/^( *)\/\* (.*) \*\/$/);
            const middleLineCommentMatch = startLine.text.match(/^( *) \* (.*)$/);
            if (singleLineCommentMatch) {
                const [, indentation, unformattedLine] = singleLineCommentMatch;
                if (contentChange.range.start.character + contentChange.text.length !== startLine.range.end.character - ' */'.length) {
                    return null;
                }
                const wrappedLines = wrapText(unformattedLine, indentation, columnLimit);
                const formattedText = formatIntoMultiLineComment(wrappedLines, indentation, eol);

                editor.edit((editBuilder) => {
                    editBuilder.replace(startLine.range, formattedText);
                }).then(() => {
                    setCursorPosition(editor, startLineNumber + 2, 0);
                });
            }
            else if (middleLineCommentMatch && cursorAtEol) {
                const [, indentation, unformattedLine] = middleLineCommentMatch;
                const wrappedLines = wrapText(unformattedLine, indentation, columnLimit);
                const formattedText = formatMidCommentLines(wrappedLines, indentation, eol);

                editor.edit((editBuilder) => {
                    editBuilder.replace(startLine.range, formattedText);
                }).then(() => {
                    setCursorPosition(editor, startLineNumber + 1, 0);
                });
            }
        }
    });

    const disposableCommand = vscode.commands.registerCommand('multi-line-comment-formatter.wrapSelectedLines', () => {
        const editor = vscode.window?.activeTextEditor;
        const document = editor?.document;
        const eol = document?.eol === vscode.EndOfLine.LF ? '\n' : `\r\n`;
        const configuration = vscode.workspace.getConfiguration();
        const columnLimit = configuration.get<number>("multi-line-comment-formatter.columnLimit");

        if (editor && document && columnLimit) {
            const extendedSelectionRange = new vscode.Range(
                document.lineAt(editor.selection.start.line).range.start,
                document.lineAt(editor.selection.end.line).range.end
            );
            const text = document.getText(extendedSelectionRange);
            const lines = text.split('\n');

            const indentation = lines.find(line => /^ * \* /.test(line))?.split(' * ')[0] || '';
            const aggregatedLines = lines.reduce((acc, line) => {
                const middleLineNonEmptyCommentMatch = line.match(/^ * \* (.*\S.*)$/);
                if (middleLineNonEmptyCommentMatch) {
                    const unformattedLine = middleLineNonEmptyCommentMatch[1].trimEnd();
                    const lastElement = acc.slice(-1)[0];
                    if (lastElement && Array.isArray(lastElement)) {
                        lastElement.push(unformattedLine);
                    } else {
                        acc.push([unformattedLine]);
                    }
                } else {
                    acc.push(line);
                }
                return acc;
            }, [] as any);

            let formattedText = aggregatedLines.map((item: any) => {
                if (typeof item === "string") {
                    return item;
                }
                const unformattedParagraph = item.join(' ');
                const wrappedLines = wrapText(unformattedParagraph, indentation, columnLimit);
                return formatMidCommentLines(wrappedLines, indentation, eol);
            }).join('\n');

            editor.edit((editBuilder) => {
                editBuilder.replace(extendedSelectionRange, formattedText);
            });
        }
    });
    context.subscriptions.push(disposableListener);
    context.subscriptions.push(disposableCommand);
}

function hasOnlyBlanks(str: string) {
    return (/^[\t ]*$/.test(str));
}

function wrapText(text: string, indentation: string, columnLimit: number) {
    const length = columnLimit - indentation.length - ' * '.length;
    const wrappedLines = text.match(new RegExp(`.{1,${length}}(\\b|$)`, 'g'));
    return wrappedLines ? wrappedLines : [];
}

function formatMidCommentLines(lines: string[], indentation: string, eol: string) {
    return lines.map(line => line.trimEnd()).map(line => indentation + ' * ' + line).join(eol);
}

function formatIntoMultiLineComment(lines: string[], indentation: string, eol: string) {
    lines = lines.map(line => line.trimEnd());
    return [
        `${indentation}/*`,
        `${indentation} * ${lines[0]}`,
        `${indentation} * ${lines[1]}`,
        `${indentation} */`
    ].join(eol);
}

// function formatIntoMultiLineComment(lines: string[], indentation: string, eol: string) {
// 	const text = lines.map(line => line.trimEnd()).join(`\n${indentation} * `);
// 	return multiLineFormat.map(line => indentation + line).join(eol).replace("{text}", text);
// }

function setCursorPosition(editor: vscode.TextEditor, line: number, endOffset: number) {
    const cursorPosition: vscode.Position = editor.document.lineAt(line).range.end.translate(0, endOffset);
    editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
}
