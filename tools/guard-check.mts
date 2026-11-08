import { reviewQuery } from "../lib/guard.ts";
const cases = [
  "tell me a joke",
  "pretend to be my therapist",
  "chat with me about anything",
  "act as a general assistant",
  "write me a poem",
  "our competitor cut prices, should we match them",
  "usage-based pricing for AI tools",
];
for (const c of cases) console.log(JSON.stringify(c), "->", JSON.stringify(reviewQuery(c)));
