# Alfresco JavaScript Console for VS Code

A powerful VS Code extension that brings the Alfresco JavaScript Console directly into your IDE, allowing you to write and execute JavaScript scripts against an Alfresco repository without leaving your development environment.

## Features

- 🚀 **Script Execution** - Run JavaScript scripts directly against your Alfresco server
- 📊 **Real-time Output** - Stream script output and execution results in real-time
- ⚙️ **Parameter Control** - Configure transaction types, run-as users, and execution context
- 🔧 **Template Support** - Use FreeMarker templates for result formatting
- 📝 **Code Snippets** - Built-in Alfresco API snippets for faster development
- 🔒 **Secure Authentication** - Encrypted credential storage using VS Code's secret storage
🎯 **Context-aware** - Smart activation for JavaScript files with Alfresco-specific commands

## Quick Start

1. Install the extension
2. Open a JavaScript file
3. Configure your Alfresco server: `Ctrl+Shift+P` → "Configure Alfresco Server"
4. Write your Alfresco script using available snippets (type `alf-` for suggestions)
5. Execute with `Ctrl+Shift+R` or click the "Run in Alfresco" button

## Requirements

- VS Code 1.102.0 or higher
- Access to an Alfresco server with JavaScript Console web script installed
- Valid Alfresco user credentials

## Extension Settings

This extension contributes the following settings:

* `alfrescoJsConsole.server.url`: Alfresco server URL (e.g., https://your-server.com/alfresco)
* `alfrescoJsConsole.server.username`: Username for Alfresco authentication
* `alfrescoJsConsole.execution.defaultTransaction`: Default transaction type (`readonly` or `readwrite`)
* `alfrescoJsConsole.execution.defaultRunAs`: Default user to run scripts as

## Usage

### Basic Script Execution

1. Open or create a JavaScript file
2. Write your Alfresco script using the available API objects:
   - `companyhome` - Company Home node reference
   - `search` - Search service for finding nodes
   - `people` - People service for user management
   - `workflow` - Workflow service
   - `person` - Current user information

### Using Code Snippets

Type any of these prefixes and press Tab:
- `alf-search` - Lucene search template
- `alf-props` - Display node properties
- `alf-create` - Create new node
- `alf-people` - Query people
- `alf-home` - Get Company Home
- `alf-workflow` - Query workflows
- `alf-perms` - Display permissions
- `alf-aspects` - Display node aspects
- `alf-children` - List node children

### Advanced Parameters

Use the Alfresco Console panel (Activity Bar → Alfresco Console icon) to configure:
- **Transaction Type**: Choose between read-only and read-write operations
- **Run As User**: Execute script as a different user
- **Space/Document References**: Set execution context
- **FreeMarker Template**: Format output using templates
- **URL Arguments**: Pass additional parameters

## Sample Script

```javascript
// Sample Alfresco script
print("Hello from Alfresco!");

// Search for content
var results = search.luceneSearch("TYPE:\"cm:content\"");
print("Found " + results.length + " content items");

// Display company home info
print("Company Home: " + companyhome.name);
print("Current User: " + person.properties["cm:userName"]);
```

## Commands

- `Alfresco: Run Script` (`Ctrl+Shift+R`) - Execute current script
- `Alfresco: Configure Server` - Set up server connection
- `Alfresco: Open Console Panel` - Show parameter panel

## Known Issues

- Self-signed certificates require manual trust configuration
- Large result sets may cause output truncation
- FreeMarker template validation is not performed client-side

## Release Notes

### 0.0.1

- Initial release with core functionality
- Basic script execution and streaming output
- Configuration management with secure credential storage
- Built-in Alfresco API snippets
- Parameter control panel for advanced execution options

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
