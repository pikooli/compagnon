import { addRule, listRules, removeRule } from "@/app/lib/rules";
import type { BrainContext } from "@/app/lib/brain/tools";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Factory: creates a save_rule tool that persists a user preference to disk.
 * Checks for duplicates before saving.
 */
export function createSaveRuleTool(_ctx: BrainContext) {
  return tool(
    async ({ rule }): Promise<string> => {
      console.log(`[Brain:save_rule] Called with rule: "${rule}"`);
      try {
        const existing = await listRules();
        console.log(`[Brain:save_rule] Existing rules (${existing.length}):`, existing);
        const lowerRule = rule.toLowerCase();
        const isDuplicate = existing.some(
          (r) =>
            r.toLowerCase().includes(lowerRule) ||
            lowerRule.includes(r.toLowerCase()),
        );
        if (isDuplicate) {
          console.log(`[Brain:save_rule] Duplicate detected, skipping`);
          return "This rule already exists or is very similar to an existing one. No changes made.";
        }
        await addRule(rule);
        console.log(`[Brain:save_rule] Rule saved successfully`);
        return `Got it! I've saved this preference: "${rule}". I'll keep this in mind going forward.`;
      } catch (err) {
        console.error("[Brain:save_rule] Failed:", err);
        return "I wasn't able to save that preference right now.";
      }
    },
    {
      name: "save_rule",
      description:
        "Saves a user preference or rule to remember for future interactions. Use this when the user expresses a preference, constraint, or rule about how they want things done — explicitly (e.g. 'no meetings after 6pm') or implicitly (e.g. 'I hate morning meetings'). Also use this when you detect an implicit preference from context.",
      schema: z.object({
        rule: z
          .string()
          .describe(
            "The rule or preference to save, stated clearly and concisely, e.g. 'No meetings after 6pm — family time'",
          ),
      }),
    },
  );
}

/**
 * Factory: creates a remove_rule tool that deletes a user preference from disk.
 */
export function createRemoveRuleTool(_ctx: BrainContext) {
  return tool(
    async ({ rule }): Promise<string> => {
      try {
        const removed = await removeRule(rule);
        if (removed) {
          return "Done! I've removed that preference. I'll no longer follow it.";
        }
        const current = await listRules();
        if (current.length === 0) {
          return "You don't have any saved preferences to remove.";
        }
        return `I couldn't find a matching rule. Here are your current preferences:\n${current.map((r) => `- ${r}`).join("\n")}`;
      } catch (err) {
        console.error("[Brain:remove_rule] Failed:", err);
        return "I wasn't able to remove that preference right now.";
      }
    },
    {
      name: "remove_rule",
      description:
        "Removes a previously saved user preference or rule. Use when the user says something like 'actually I'm fine with evening meetings now' or 'forget that rule about formal emails' or 'remove the rule about morning meetings'.",
      schema: z.object({
        rule: z
          .string()
          .describe(
            "The rule to remove — can be an approximate description, doesn't need to match exactly",
          ),
      }),
    },
  );
}

/**
 * Factory: creates a list_rules tool that returns all saved user preferences.
 */
export function createListRulesTool(_ctx: BrainContext) {
  return tool(
    async (): Promise<string> => {
      try {
        const rules = await listRules();
        if (rules.length === 0) {
          return "You don't have any saved preferences or rules yet. You can tell me things like 'no meetings after 6pm' and I'll remember them.";
        }
        return `Here are your current preferences:\n${rules.map((r) => `- ${r}`).join("\n")}`;
      } catch (err) {
        console.error("[Brain:list_rules] Failed:", err);
        return "I wasn't able to retrieve your preferences right now.";
      }
    },
    {
      name: "list_rules",
      description:
        "Lists all saved user preferences and rules. Use when the user asks 'what are my rules?', 'what preferences do you know about?', 'what did I tell you about my preferences?', or similar.",
      schema: z.object({}),
    },
  );
}
