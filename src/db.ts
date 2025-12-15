import OpenAI from "openai";
import type {
    ChatCompletionMessageFunctionToolCall,
    ChatCompletionMessageParam,
    ChatCompletionTool,
    ChatCompletionMessage,
    ChatCompletionMessageToolCall } from "openai/resources";

export interface AiClient {
    runAI(messages: ChatCompletionMessageParam[]): Promise<void>;
}

export class OpenAiClient implements AiClient {
    #openai: OpenAI;
    constructor(
        private apiKey: string,
        private model: string = 'gpt-4',
        private instructions: string,
        private additionalInstructions: () => string = () => { return ''; },
        private tools: ChatCompletionTool[],
        private functions: Record<string, (arg1: object, arg2: object) => Promise<string>>
    ) {
        this.#openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_KEY
        });
    }
    // #parseMessages(messages: string[]): ChatCompletionMessageParam[] {
    //     return JSON.parse(`[${messages.join(",")}]`);
    // }
    async #callTool(tool_call: ChatCompletionMessageFunctionToolCall, additionalArgs: object) {
        const tool_call_id = tool_call?.id;
        const functionName = tool_call?.function.name;
        const functionArgs = JSON.parse(tool_call?.function.arguments || '{}');
        const fn = this.functions[functionName as keyof typeof this.functions] as (arg1: object, arg2: object) => Promise<string>;
        const content = await fn(functionArgs, additionalArgs);
        return {
            tool_call_id,
            content
        }
    }
    async #gpt(
        messages: ChatCompletionMessageParam[],
        tools: ChatCompletionTool[]):
        Promise<{
            message: ChatCompletionMessage | undefined,
            tool_calls: ChatCompletionMessageToolCall[] | undefined
        }> {
        const completion = await this.#openai.chat.completions.create({
            messages,
            tools,
            model: 'deepseek-chat',
        });
        const message = completion?.choices?.[0]?.message;
        const tool_calls = message?.tool_calls;
        return {
            message,
            tool_calls
        };
    }
    async runAI(messages: ChatCompletionMessageParam[]): Promise<void> {
        return;
    }
}