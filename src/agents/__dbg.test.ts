import { it } from "vitest";
import { compileDepth } from "@/agents/maxRichPromptCompiler";
import { NOTION_DEPTH } from "@/agents/__fixtures__/maxNotionFixture";
it("dbg", () => {
  const c = compileDepth(NOTION_DEPTH, 3000, { sessionSummary: "Confiance élevée, il a fait un aveu." });
  console.log(JSON.stringify(c.selection, null, 1));
});
