# Zentao CLI

![npm](https://img.shields.io/npm/v/zentao-cli) ![Node.js](https://img.shields.io/node/v/zentao-cli) ![License](https://img.shields.io/npm/l/zentao-cli)

[简体中文](README.md) | English

A command-line tool for ZenTao that lets you access and manage ZenTao data from your favorite terminal, with support for AI agents.

## Features

* Built on ZenTao RESTful API 2.0, covering more than 40 modules and 300 API operations, with version compatibility checks before each request
* Run without installation using `npx zentao-cli`
* Log in through your browser, store only tokens instead of passwords, and switch between multiple accounts
* Select fields, filter and sort data, and explicitly convert HTML to Markdown
* Built for AI agents, with comprehensive help and Markdown and JSON output
* Install skills into AI agents with `zentao skill install`
* Run a local stdio or remote HTTP MCP service, with each client using its own ZenTao token

## Requirements

* Node.js 18 or later
* ZenTao Open Source `22.0`, Biz `biz13.0`, Max `max8.0`, or IPD `ipd5.0` or later

Some operations require a newer ZenTao version. The CLI checks compatibility and reports any requirements before sending a request. See [API coverage and version compatibility](docs/cli-usage.md#api-覆盖与版本兼容).

## Quick start

The source includes command changes that have not been released. For installed 0.4.3 packages, follow the local `--help` output.

```bash
# Install globally
npm install -g zentao-cli

# Alternatively, install with Bun or run without installation
# bun install -g zentao-cli
# npx zentao-cli
# pnpm dlx zentao-cli

# Log in: a browser opens for you to enter your ZenTao URL, username, and password
zentao login

# List products
zentao product list
```

In a terminal without a graphical environment, use `zentao login --no-browser` for interactive login. For environment variables, account switching, and logout, see [Authentication](docs/cli-usage.md#用户验证).

## Common commands

Commands follow the format `zentao <module> <action> [target] [options]`. Use `list` for lists and `get` for details; omitting the action displays help.

### Products

```bash
# List products
zentao product list

# View product details
zentao product get 1

# Create a product
zentao product create --name="New product"

# Update a product's name
zentao product update 1 --name="Updated product name"

# Delete a product
zentao product delete 1
```

### Bugs

```bash
# List bugs for product #1
zentao bug list --product=1

# View bug details
zentao bug get 329

# Resolve a bug
zentao bug resolve 329 --resolution=fixed
```

### Stories and tasks

```bash
# List stories for product #1
zentao story list --product=1

# Create a task in execution #10
zentao task create --name="Implement login" --execution-id=10
```

### Filtering and output formats

```bash
# Show only the selected fields
zentao product list --fields=id,name

# Filter by a condition
zentao bug list --product=1 --filter 'status=active'

# Fuzzy search
zentao story list --product=1 --search=login --search-fields=title

# Sort by a field
zentao bug list --product=1 --sort=id:desc

# Output JSON for use in scripts
zentao product list --format=json
```

### Help

```bash
# Show all commands
zentao help

# Show a module's available actions and parameters
zentao bug --help

# Show an action's parameters and minimum ZenTao version
zentao bug resolve --help
```

### Get a token

Use `zentao token` when you need a token for a script or MCP configuration:

```bash
# Read the saved token for the current account or a specific account
zentao token
zentao token 'admin@https://zentao.example.com'

# Obtain a new token without saving it to the CLI configuration
zentao token --server https://zentao.example.com --user admin --password '<password>'
```

By default, the command outputs only the token on a single line. Reading a saved token does not validate it over the network, modify the configuration, or switch accounts. See [Get a token](docs/cli-usage.md#获取-token).

For more features, including piped input, batch operations, pagination, and configuration management, see the [CLI guide](docs/cli-usage.md).

The CLI sends a versioned operation marker by default; MCP markers distinguish stdio from HTTP. Use `--assistant 'AI <codex>'` to replace the marker for one invocation, `--assistant ''` to disable it once, or `zentao config set autoAssistant false` to disable automatic markers for the current profile. MCP tools accept a top-level `assistant` string for per-call overrides. See [Operation markers](docs/cli-usage.md#操作来源标记).

## Use with AI agents

There are three ways to use ZenTao with AI agents:

| Method | Use case | CLI installation required |
| --- | --- | --- |
| Skill | Personal use; the agent runs CLI commands in a terminal | Yes |
| Local MCP | Personal use; the agent accesses the CLI through MCP tools | Yes |
| Remote MCP | A shared company deployment; users connect with their own tokens | No |

For full instructions, see [Use ZenTao with agents](docs/use-zentao-in-agents.md).

### Use skills

```bash
# Install, log in, and install skills (choose the target agent interactively)
npm install -g zentao-cli && zentao login && zentao skill install

# Specify the target agent directly; all installs into every supported agent
zentao skill install claude-code
zentao skill install all

# Export all built-in skills to a directory
zentao skill export ./skills
```

Supported agents include Claude Code, Cursor, Cherry Studio, Codex, OpenCode, VS Code, Antigravity, and Gemini. After installation, ask your agent questions in natural language:

```txt
What products are available in ZenTao?

Which stories are under development for product xxx?

What risks are associated with story xxx?
```

When an agent starts the login flow, it should use `zentao login --web` and keep the process running until the user finishes authentication in the browser. In CI or containers, you can inject credentials through environment variables or mount a configuration file. The agent can first run `zentao auth status --format=json` to confirm which account is in use; the output contains no token or password. See [Credentials for agents, CI, and containers](docs/use-zentao-in-agents.md#agentci-与容器中的凭据).

### Use local MCP

```bash
# Install, log in, and configure local stdio MCP (choose the target agent interactively)
npm install -g zentao-cli && zentao login && zentao add-mcp
```

`zentao add-mcp` reuses the current account's token and does not write your ZenTao password to the agent configuration. Add startup options to `args` in the MCP configuration to limit access:

```bash
# Allow only read operations and restrict the available modules
zentao mcp --read-only --modules product,story,task,bug

# Split each module into separate read and write tools for separate client permissions
zentao mcp --split-tools --modules product,story,task,bug
```

For the generated configuration format and all startup options, see [MCP service](docs/cli-usage.md#mcp-服务).

### Use remote MCP

`zentao mcp-server` is designed for a shared deployment managed by a company administrator. Users need only the service URL and their own ZenTao tokens, without installing zentao-cli. ZenTao handles requests according to each account's permissions.

```bash
# On the server, start the service with a fixed ZenTao site URL
zentao mcp-server https://zentao.example.com
```

After startup, open `http://127.0.0.1:9090/start`. Users can obtain their personal tokens on this page and copy the connection instructions for an agent to help with setup. Administrators must expose both `/start` and `/mcp` through an HTTPS reverse proxy.

* For administrators: [ZenTao MCP deployment guide](docs/mcp-server.md)
* For users: [Connect an agent to the ZenTao MCP service](docs/mcp-user-guide.md)

## Documentation

The linked guides and changelog are currently in Chinese.

| Document | Description |
| --- | --- |
| [Interactive command reference (HTML)](docs/command-reference.html) | Open in a browser to search commands and parameters, and filter by module and action type |
| [Command, parameter, and usage reference](docs/command-reference.md) | All built-in commands, module actions, parameter types, required fields, allowed values, and usage examples |
| [CLI guide](docs/cli-usage.md) | Authentication, data access and operations, data processing, output formats, configuration, and more |
| [Use ZenTao with agents](docs/use-zentao-in-agents.md) | Use ZenTao in AI agents through skills or MCP |
| [ZenTao MCP deployment guide](docs/mcp-server.md) | Deploy a shared remote MCP service, configure an HTTPS reverse proxy, and make it available to users |
| [Connect an agent to the ZenTao MCP service](docs/mcp-user-guide.md) | Obtain a personal ZenTao token and configure remote MCP in an agent |
| [Development guide](docs/development.md) | Technology stack, project structure, testing, and builds |
| [Technical design and implementation](docs/implementation.md) | Internal API calling rules, authentication, and persistent configuration |
| [Troubleshooting and error reference](docs/errors.md) | Error code reference (Exxxx) |
| [Roadmap](docs/roadmap.md) | Planned features and improvements |
| [Changelog](CHANGES.md) | Changes in each release |

<!-- repository-only:start -->
## Contributing

Issues and pull requests are welcome. For development setup, project structure, testing, and builds, see the [Development guide](docs/development.md).
<!-- repository-only:end -->

## License

[MIT](LICENSE)
