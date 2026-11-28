import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, so tests can read the committed page and data files. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const readRepo = (file) => readFileSync(path.join(ROOT, file), "utf8");
