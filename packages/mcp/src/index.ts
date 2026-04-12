#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerAreaTools } from "./tools/areas.js";
import { registerSectionTools } from "./tools/sections.js";
import { registerArchitectTools } from "./tools/architect.js";

const server = new McpServer({
  name: "todo",
  version: "0.0.1",
});

registerTaskTools(server);
registerProjectTools(server);
registerAreaTools(server);
registerSectionTools(server);
registerArchitectTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
