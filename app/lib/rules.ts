import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const RULES_PATH = join(process.cwd(), ".user-rules.md");

/**
 * Reads the raw content of the user rules file.
 * Returns empty string if the file does not exist.
 */
export async function readRules(): Promise<string> {
  try {
    return await readFile(RULES_PATH, "utf-8");
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw err;
  }
}

/**
 * Parses the rules file and returns an array of rule strings (without the leading "- ").
 */
export async function listRules(): Promise<string[]> {
  const content = await readRules();
  if (!content.trim()) return [];
  return content
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

/**
 * Appends a new rule to the file. Creates the file if it doesn't exist.
 */
export async function addRule(ruleText: string): Promise<void> {
  const content = await readRules();
  const newContent = content
    ? content.trimEnd() + "\n" + `- ${ruleText}\n`
    : `- ${ruleText}\n`;
  await writeFile(RULES_PATH, newContent, "utf-8");
  console.log(`[Rules] Added rule: "${ruleText}"`);
}

/**
 * Removes a rule by case-insensitive substring match.
 * Returns true if a rule was removed, false if no match found.
 */
export async function removeRule(ruleText: string): Promise<boolean> {
  const rules = await listRules();
  const lowerSearch = ruleText.toLowerCase();
  const idx = rules.findIndex((r) => r.toLowerCase().includes(lowerSearch));
  if (idx === -1) {
    console.log(`[Rules] Rule not found for removal: "${ruleText}"`);
    return false;
  }
  const removed = rules.splice(idx, 1)[0];
  const newContent = rules.length > 0
    ? rules.map((r) => `- ${r}`).join("\n") + "\n"
    : "";
  await writeFile(RULES_PATH, newContent, "utf-8");
  console.log(`[Rules] Removed rule: "${removed}"`);
  return true;
}
