import { defineTool as sdkDefineTool, type ToolContext, type ToolDefinition, type ToolHandlerResult } from "@lovable.dev/mcp-js";
import { z } from "zod-mcp";

/**
 * SDK 3.0.5 runs both Zod generations, but its public types import the hoisted
 * `zod` peer (Zod 3 for forms under npm, Zod 4 under Bun). Keep the boundary
 * explicit and validate inputs here with the locked MCP-only Zod 4 alias.
 */
export function defineTool<Shape extends z.ZodRawShape>(definition: Omit<ToolDefinition, "inputSchema" | "outputSchema" | "handler"> & {
  inputSchema: Shape;
  outputSchema?: z.ZodType;
  handler: (args: z.output<z.ZodObject<Shape>>, ctx: ToolContext) => ToolHandlerResult | Promise<ToolHandlerResult>;
}): ToolDefinition {
  const input = z.object(definition.inputSchema).strict();
  return sdkDefineTool({
    ...definition,
    handler: async (args: unknown, ctx: ToolContext) => {
      const result = await definition.handler(input.parse(args), ctx);
      if (definition.outputSchema && result.structuredContent !== undefined) {
        return { ...result, structuredContent: definition.outputSchema.parse(result.structuredContent) };
      }
      return result;
    },
  } as unknown as ToolDefinition);
}
