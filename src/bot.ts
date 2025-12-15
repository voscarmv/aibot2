import { OpenAiClient } from "./aibot/gpt.js";

export const aiClient = new OpenAiClient({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_KEY as string,
    instructions: 'You are a helpful assistant.',
});

