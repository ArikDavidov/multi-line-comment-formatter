"use strict";

import * as vscode from 'vscode';

const startSequence = '/*';
const endSequence = '*/';
const singleLineCommentFormat = '/*  */';
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
		const configuration = vscode.workspace.getConfiguration();
		const autoCloseComment = configuration.get<boolean>("multi-line-comment-formatter.autoCloseComment");
		const autoLineWrapping = configuration.get<boolean>("multi-line-comment-formatter.autoLineWrapping");
		const columnLimit = configuration.get<number>("multi-line-comment-formatter.columnLimit");

		const contentChange: vscode.TextDocumentContentChangeEvent = event.contentChanges[0]; // TODO: convert to for_each
		if (!contentChange.text) {
			return null;
		}

		if (!vscode.window.activeTextEditor) {
			return null;
		}
		const editor = vscode.window.activeTextEditor;
		const document = editor.document;
		const startLineNumber: number = editor.selection.start.line;
		const startLine: vscode.TextLine = document.lineAt(startLineNumber);
		const eol = document.eol === vscode.EndOfLine.LF ? '\n' : `\r\n`;

		if (autoCloseComment && hasOnlyBlanks(contentChange.text)) {
			// >>>>>>>>>>> Move to autoCloseComment()
			if (contentChange.range.start.character + contentChange.text.length !== startLine.range.end.character) {
				console.log('Cursor is not at the end of the line.');
				return null;
			}

			const startPosition = startLine.range.start.translate(0, startLine.firstNonWhitespaceCharacterIndex);
			const previousNonWhitespaceCharacters = new vscode.Range(
				startPosition,
				contentChange.range.start
			);
			if (document.getText(previousNonWhitespaceCharacters) !== '/*') {
				return null;
			}

			const rangeToReplace = new vscode.Range(
				startPosition,
				startLine.range.end
			);
			editor.edit((editBuilder) => {
				editBuilder.replace(rangeToReplace, singleLineCommentFormat);
			}).then(() => {
				// Move the cursor back into the comment
				const cursorPosition = rangeToReplace.start.translate(0, 3);
				editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
			});
			// >>>>>>>>>>> Move to autoCloseComment()
		}


		if (contentChange.text.startsWith(eol)) {
			// >>>>>>>>>>> Move to formatSingleLineToMultiLine()
			// const startLineNumber: number = editor.selection.start.line;
			const startLineText: string = document.lineAt(startLineNumber).text.trim();
			const endLineText: string = document.lineAt(startLineNumber + 1).text.trim(); // TODO: fix
			const startPosition = startLine.range.start.translate(0, startLine.firstNonWhitespaceCharacterIndex);

			if (startLineText.startsWith("/*") && !startLineText.startsWith("/**") && endLineText.endsWith("*/")) {
				const rangeToReplace = new vscode.Range(
					startPosition,
					startPosition.translate(1, 0)
				);

				const unformattedText = startLineText.replace(/^\s*\/\*\s*/g, "");

				const indentation = '    ';
				console.log(['/*', ` * ${unformattedText}`, ' * ', ''].join(`\n${indentation}`));

				editor.edit((editBuilder) => {
					editBuilder.replace(rangeToReplace,
						"/*\n" + "    " + " * " + unformattedText + "\n" + "    " + " * " + "\n" + "    ");
				}).then(() => {
					// Move the cursor back into the comment
					const cursorPosition = rangeToReplace.end.translate(1, 3);
					editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
				});
			}
			// >>>>>>>>>>> Move to formatSingleLineToMultiLine()
		}
		else if (autoLineWrapping && editor.selection.start.character === columnLimit) {
			if (contentChange.text.length !== 1) {
				console.log('Change longer than 1 char');
				return null;
			}
			const singleLineCommentMatch = startLine.text.match(/^( *)\/\* (.*) \*\/$/);
			if (singleLineCommentMatch) {
				const [, indentation, unformattedText] = singleLineCommentMatch;
				if (contentChange.range.start.character + contentChange.text.length !== startLine.range.end.character - ' */'.length) {
					return null;
				}

				var formattedText = multiLineFormat.map(line => indentation + line).join(eol).replace("{text}", unformattedText);

				editor.edit((editBuilder) => {
					editBuilder.replace(startLine.range, formattedText);
					// });
				}).then(() => {
					const secondLineText: string = document.lineAt(startLineNumber + 1).text; // TODO: fix
					const formattedText = wrapText(secondLineText, columnLimit, eol);
					// editBuilder.replace(startLine.range, formattedText);
					// Move the cursor back into the comment
					// const cursorPosition = startLine.range.end.translate(1, 3);
					// editor.selection = new vscode.Selection(cursorPosition, cursorPosition);
				});
			}

			// >>>>>>>>>>> Move to wrapLines()
			if (contentChange.text.length !== 1) {
				console.log('Change longer than 1 char');
				return null;
			}
			if (contentChange.range.start.character + contentChange.text.length !== startLine.range.end.character) {
				console.log('Cursor is not at the end of the line.');
				return null;
			}

			const lastBlankCharacterRange = new vscode.Range(
				startLine.range.start.translate(0, startLine.text.lastIndexOf("\s")),
				startLine.range.start.translate(0, startLine.text.lastIndexOf("\s") + 1)
			);

			editor.edit((editBuilder) => {
				editBuilder.replace(lastBlankCharacterRange, eol);
			});
			// >>>>>>>>>>> Move to wrapLines()
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
			const formattedText = wrapText(document.getText(extendedSelectionRange), columnLimit, eol);

			editor.edit((editBuilder) => {
				if (formattedText) {
					editBuilder.replace(extendedSelectionRange, formattedText);
				}
			});
		}

	});
	context.subscriptions.push(disposableListener);
	context.subscriptions.push(disposableCommand);
}

function hasOnlyBlanks(str: string) {
	return !str.replace(/[\t ]/g, '').length;
}

// TODO: trim trailing whitespaces
function wrapText(text: string, columnLimit: number, eol: string) {
	const indentation = text.split(' * ')[0];
	if (!hasOnlyBlanks(indentation)) {
		console.log(`Expected: (indentation) + ' * '`);
		return null;
	}

	const length = columnLimit - indentation.length - ' * '.length;
	const unformattedText: string = text.split(eol).map(line => line.split(' * ')[1]).join(' ');
	const rewrapedLines = unformattedText.match(new RegExp(`.{1,${length}}(\\s|$)`, 'g'));

	return rewrapedLines?.map(line => indentation + ' * ' + line).join(eol);
}
