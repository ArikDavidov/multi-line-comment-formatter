# Multi-Line Comment Formatter

Formatter for /\* ... \*/ style (C style) multi-line comments.

![Demo](https://raw.githubusercontent.com/ArikDavidov/multi-line-comment-formatter/main/images/demo.gif)

## Features

### Auto Line Warping

When comment line exceeds the limit (default: 65 characters) it will be wrapped and continued on the next line. Can be
disabled with `multi-line-comment-formatter.autoLineWrapping` configuration.

### Auto Format Single Line Comment Into Multi-Line Comment

If a single line comment exceeds the limit (if Auto Line Warping enabled) or if `enter` is pressed it will be formatted
into multi-line comment.

### Wrap selected comment lines

> **Note**: If you are doing this often, consider adding a [key binding](https://code.visualstudio.com/docs/getstarted/keybindings#_keyboard-shortcuts-editor) for this command.

### Auto Close Comment

Typing `/*` then pressing `Space` or `Tab` will automatically add the closing `Space` and `*/`. Can be disabled with
`multi-line-comment-formatter.autoCloseComment` configuration.

## Extension Settings

* `multi-line-comment-formatter.columnLimit`: line length limit for wrapping (default: 65 characters long)
* `multi-line-comment-formatter.autoLineWrapping`: automatically wrap lines when column limit is exceeded (default: True).
* `multi-line-comment-formatter.autoCloseComment`: automatically add ' \*/' when '/\* ' is typed (default: True).
