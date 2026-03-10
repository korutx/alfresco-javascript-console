# Alfresco JavaScript Console

Run JavaScript scripts against an Alfresco repository from VS Code or the command line.

Supports both [OOTBee JavaScript Console](https://github.com/AlfrescoLabs/ootbee-support-tools) (actively maintained) and the original fme AG JavaScript Console, with automatic variant detection.

## Installation

### VS Code Extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=korutx.alfresco-javascript-console), or search for "Alfresco Javascript Console" in VS Code extensions.

### CLI

```bash
npm install -g alfresco-javascript-console
```

## VS Code Extension

### Quick Start

1. Install the extension
2. Configure your server: `Ctrl+Shift+P` → "Configure Alfresco Server"
3. Open a JavaScript file and press `Ctrl+Shift+R` to execute

### Features

- **Script Execution** — Run scripts directly against Alfresco with real-time streaming output
- **Multi-Profile** — Manage multiple Alfresco server connections and switch between them
- **Parameter Control** — Configure transaction type, run-as user, space/document context, and FreeMarker templates
- **Code Snippets** — Built-in Alfresco API snippets (type `alf-` for suggestions)
- **Secure Storage** — Credentials stored in VS Code's secret storage

### Commands

| Command | Shortcut | Description |
|---|---|---|
| Run Script | `Ctrl+Shift+R` | Execute current script against Alfresco |
| Configure Server | | Set up server connection |
| Open Console Panel | | Show execution parameter panel |
| Add Server Profile | | Add a new server profile |
| Switch Server Profile | | Switch active profile |
| Edit Server Profile | | Edit an existing profile |
| Delete Server Profile | | Remove a profile |

### Settings

| Setting | Description |
|---|---|
| `alfrescoJsConsole.server.url` | Alfresco server URL |
| `alfrescoJsConsole.server.consoleVariant` | Console variant: `auto`, `ootbee`, or `fme` |
| `alfrescoJsConsole.server.username` | Username for authentication |
| `alfrescoJsConsole.execution.defaultTransaction` | Default transaction type (`readonly` / `readwrite`) |
| `alfrescoJsConsole.execution.defaultRunAs` | Default run-as user |

### Code Snippets

Type any prefix and press Tab:

`alf-search` · `alf-props` · `alf-create` · `alf-people` · `alf-home` · `alf-workflow` · `alf-perms` · `alf-aspects` · `alf-children`

## CLI

Zero-dependency command-line tool for running Alfresco scripts from the terminal or CI pipelines.

### Usage

```bash
# Run a script file
alfresco-js-console run script.js --server https://localhost:8080/alfresco --username admin --password admin

# Read from stdin
cat script.js | alfresco-js-console run -

# Use a saved profile
alfresco-js-console run script.js

# With FreeMarker template
alfresco-js-console run script.js --template output.ftl

# JSON output (for scripting/AI tooling)
alfresco-js-console run script.js --json
```

### Profile Management

```bash
# Add a profile
alfresco-js-console profile add

# List profiles
alfresco-js-console profile list

# Switch active profile
alfresco-js-console profile switch <name>

# Delete a profile
alfresco-js-console profile delete <name>
```

Profiles are stored in `~/.alfresco-js-console/config.json` with `0600` permissions.

### FreeMarker Templates

Pass a FreeMarker template file with `--template` to format script output. Populate the template model by setting properties on the `model` object in your script:

**script.js:**
```javascript
var children = companyhome.children;
model.nodes = children;
model.user = person.properties["cm:userName"];
```

**output.ftl:**
```ftl
User: ${user}

<#list nodes as node>
  ${node.name} (${node.typeShort}) - ${node.nodeRef}
</#list>
```

```bash
alfresco-js-console run script.js --template output.ftl
```

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Script execution error |
| 2 | Configuration or usage error |

## Sample Script

```javascript
// print() streams output in real-time
print("Hello from Alfresco!");
print("Company Home: " + companyhome.name);
print("Current User: " + person.properties["cm:userName"]);

var children = companyhome.children;
print("Company Home has " + children.length + " children:");
for (var i = 0; i < Math.min(children.length, 5); i++) {
    print("  - " + children[i].name);
}

// model.* populates FreeMarker template variables
model.nodes = children;
model.user = person.properties["cm:userName"];
```

## Requirements

- Access to an Alfresco server with JavaScript Console webscript installed
- Valid Alfresco user credentials
- VS Code extension: VS Code 1.99.0+
- CLI: Node.js 20+

## License

MIT
