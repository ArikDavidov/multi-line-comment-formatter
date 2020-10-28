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
		const contentChange: vscode.TextDocumentContentChangeEvent = event.contentChanges[0]; // TODO: convert to for_each
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
		const endLine: vscode.TextLine = document.lineAt(startLineNumber);
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
			const txt = contentChange.text;

			const currentLineCommentMatch = startLine.text.match(/^( *)\/\* (.*)$/);
			const nextLineCommentMatch = endLine.text.match(/^ *(.*) \*\/$/);

			if (currentLineCommentMatch && nextLineCommentMatch) {
				const [, indentation, unformattedCurrentLine] = currentLineCommentMatch;
				const [, unformattedNextLine] = nextLineCommentMatch;
				const unformattedLines = [unformattedCurrentLine, unformattedNextLine];

				const formattedText = formatIntoMultiLineComment(unformattedLines, indentation, eol);

				editor.edit((editBuilder) => {
					editBuilder.replace(new vscode.Range(startLine.range.start, endLine.range.end), formattedText);
				}).then(() => {
					setCursorPosition(editor, startLineNumber + 2, 0);
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
				const [, indentation, unformattedText] = singleLineCommentMatch;
				if (contentChange.range.start.character + contentChange.text.length !== startLine.range.end.character - ' */'.length) {
					return null;
				}

				const wrappedLines = wrapText(unformattedText, indentation, columnLimit);
				const formattedText = formatIntoMultiLineComment(wrappedLines, indentation, eol);

				editor.edit((editBuilder) => {
					editBuilder.replace(startLine.range, formattedText);
				}).then(() => {
					setCursorPosition(editor, startLineNumber + 2, 0);
				});
			}
			else if (middleLineCommentMatch && cursorAtEol) {
				const [, indentation, unformattedText] = middleLineCommentMatch;
				const wrappedLines = wrapText(unformattedText, indentation, columnLimit);
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
		const configuration = vscode.workspace.getConfiguration(); // should we check the config on every invocation?
		const columnLimit = configuration.get<number>("multi-line-comment-formatter.columnLimit");

		if (editor && document && columnLimit) {
			const extendedSelectionRange = new vscode.Range(
				document.lineAt(editor.selection.start.line).range.start,
				document.lineAt(editor.selection.end.line).range.end
			);
			const text = document.getText(extendedSelectionRange);
			const lines = text.split('\n');

			// const [, indentation] = lines.find(line => /^( *)[/ ]\* /.test(line)) || '';
			const [, indentation] = lines.find(line => /^( *) \* /.test(line)) || '';

			// if (!lastElement || typeof lastElement === "string") {
			// 	acc.push([line]);
			// }
			// else {
			// 	lastElement.push(line);
			// }
			const formatted = lines.reduce((acc, line) => {
				if (line.match(/^ *\* (.*)$/)) {
					const lastElement = acc.slice(-1)[0];
					if (lastElement && Array.isArray(lastElement)) {
						lastElement.push(line);
					} else {
						acc.push([line]);
					}
				} else {
					acc.push(line);
				}
				return acc;
			}, [] as any);
			// let result = formatted.map(item => Array.isArray(item) ? updatedItem : item)
			// let result = array.map(item => item.id === updatedItem.id ? updatedItem : item)

			// const arr = [0, 0, [1, 1], 0, [1, 1, 1]];
			let result = formatted.map(item => {
				if (Array.isArray(item)) {
					console.log(item);
					return item;
				}
				else {
					return item;
				}
			});
			console.log(result);

			// const formatted = text.split('\n').reduce((acc, line) => {
			// 	const middleLineCommentMatch = line.match(/^( *) \* (.*)$/);
			// 	if (middleLineCommentMatch) {
			// 		const [, indentation, unformattedCurrentLine] = middleLineCommentMatch;
			// 		if (!acc['indentation']) {
			// 			acc['indentation'] = indentation;
			// 		}
			// 		acc['currentParagraph'].push(unformattedCurrentLine);
			// 	} else {
			// 		const unformattedText = acc['currentParagraph'].join(' ');
			// 		const wrappedLines = wrapText(unformattedText, acc['indentation'], columnLimit);
			// 		const formattedText = formatMidCommentLines(wrappedLines, acc['indentation'], eol);
			// 		acc['text'].push(formattedText);
			// 		acc['text'].push(line);
			// 	}
			// 	return acc;
			// }, { text: [] as string[], currentParagraph: [] as string[], indentation: '' });

			editor.edit((editBuilder) => {
				// const formattedText = formatted.text.join('\n');
				const formattedText = formatted.join('\n');
				editBuilder.replace(extendedSelectionRange, formattedText);
			});
		}
	});
	context.subscriptions.push(disposableListener);
	context.subscriptions.push(disposableCommand);
}

// const startLineNumber: number = editor.selection.start.line;
// const startLine: vscode.TextLine = document.lineAt(startLineNumber);

// const indentation = text.split(' * ')[0];
// if (hasOnlyBlanks(indentation)) {
// 	const unformattedText: string = text.split(eol).map(line => line.split(' * ')[1]).join(' ');
// 	const wrappedLines = wrapText(unformattedText, indentation, columnLimit);
// 	// const formattedText = lines.map(line => line.trimEnd()).map(line => indentation + ' * ' + line).join(eol);
// 	const formattedText = formatMidCommentLines(wrappedLines, indentation, eol);

// 	editor.edit((editBuilder) => {
// 		if (formattedText) {
// 			editBuilder.replace(extendedSelectionRange, formattedText);
// 		}
// 	});
// }

function hasOnlyBlanks(str: string) {
	return !str.replace(/[\t ]/g, '').length;
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
	const text = lines.map(line => line.trimEnd()).join(`\n${indentation} * `);
	return multiLineFormat.map(line => indentation + line).join(eol).replace("{text}", text);
}

function setCursorPosition(editor: vscode.TextEditor, line: number, endOffset: number) {
	const cursorPosition = editor.document.lineAt(line).range.end.translate(0, endOffset);
	editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
}

// TODO: trim trailing whitespaces
function wrapTextDepredated(text: string, columnLimit: number, eol: string) {
	const indentation = text.split(' * ')[0];
	if (!hasOnlyBlanks(indentation)) {
		console.log(`Expected: (indentation) + ' * '`);
		return null;
	}

	const length = columnLimit - indentation.length - ' * '.length;
	const unformattedText: string = text.split(eol).map(line => line.split(' * ')[1]).join(' ');
	const wrappedLines = unformattedText.match(new RegExp(`.{1,${length}}(\\b|$)`, 'g'));

	return wrappedLines?.map(line => indentation + ' * ' + line).join(eol);
}
