import { agentPrompt } from '../lib/prompt.ts';

const text = agentPrompt({
  origin: 'https://stipend-delta.vercel.app',
  token: 'stp_PPz9HtM0a_2ldUocB3qXpSc4',
});
console.log(text);
