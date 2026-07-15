import { hashPersonalKey, PERSONAL_KEY_RE } from "../src/middleware/auth";

const key = process.argv[2];
if (!key || !PERSONAL_KEY_RE.test(key)) {
  console.error("Usage: bun run hash-key ck_<personal key>");
  process.exit(1);
}
console.log(hashPersonalKey(key));
