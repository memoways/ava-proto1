import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import type { Plugin, ResolvedConfig } from "vite";

/** SDK 3.0.5 externalizes npm aliases by name. Deno needs their real pinned specifier. */
export function lovableMcpPlugin(): Plugin {
  const plugin = mcpPlugin();
  const hook = plugin.configResolved;
  const configure = typeof hook === "function" ? hook : hook?.handler;
  plugin.configResolved = async function (config: ResolvedConfig) {
    if (!configure) throw new Error("Lovable MCP config hook unavailable");
    return configure.call(this, {
      ...config,
      resolve: {
        ...config.resolve,
        alias: [...config.resolve.alias, { find: "zod-mcp", replacement: "npm:zod@4.6.6" }],
      },
    });
  };
  return plugin;
}
