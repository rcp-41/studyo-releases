---
name: mcp-builder
description: Guides creation of high-quality MCP (Model Context Protocol) servers for integrating external APIs and services with LLMs using Python or TypeScript.
---

# MCP Server Development Guide

A systematic guide for building production-quality MCP servers that integrate external APIs and services with AI models.

## When to Use This Skill

- Building a new MCP server from scratch
- Integrating an external API with Claude
- Creating tools for Claude to use via MCP
- Debugging or improving existing MCP servers

## Overview

MCP (Model Context Protocol) servers expose tools, resources, and prompts to AI models. This skill guides you through the full development lifecycle.

## Process

### Phase 1: Deep Research and Planning

1. **Understand the API/Service**:
   - Read all API documentation thoroughly
   - Identify authentication methods (API key, OAuth, Bearer token)
   - List all endpoints you want to expose as tools

2. **Plan the MCP tools**:
   - Each API endpoint → one MCP tool
   - Define input schemas (parameter names, types, required/optional)
   - Define output format (what Claude sees as the result)

3. **Choose implementation language**:
   - **Python**: Use `mcp` package (`pip install mcp`)
   - **TypeScript**: Use `@modelcontextprotocol/sdk` package

### Phase 2: Implementation

#### Python Template

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import httpx

server = Server("my-server")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="tool_name",
            description="What this tool does",
            inputSchema={
                "type": "object",
                "properties": {
                    "param1": {"type": "string", "description": "Description"}
                },
                "required": ["param1"]
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "tool_name":
        # Call API
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://api.example.com/{arguments['param1']}")
        return [TextContent(type="text", text=response.text)]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

#### TypeScript Template

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'tool_name',
    description: 'What this tool does',
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Description' }
      },
      required: ['param1']
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'tool_name') {
    const response = await fetch(`https://api.example.com/${request.params.arguments?.param1}`);
    const data = await response.text();
    return { content: [{ type: 'text', text: data }] };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Phase 3: Review and Refine

- Test each tool individually
- Verify error handling
- Check authentication flows
- Validate input/output schemas

### Phase 4: Claude Desktop Configuration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["/path/to/server.py"],
      "env": {
        "API_KEY": "your-key-here"
      }
    }
  }
}
```

## Best Practices

- Always handle errors gracefully and return informative error messages
- Use environment variables for API keys, never hardcode
- Include rate limiting awareness
- Return structured data when possible
- Write clear tool descriptions so Claude knows when to use them
