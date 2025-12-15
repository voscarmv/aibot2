import OpenAI from "openai";
import type {
    ChatCompletionMessageFunctionToolCall,
    ChatCompletionMessageParam,
    ChatCompletionTool,
    ChatCompletionMessage,
    ChatCompletionMessageToolCall
} from "openai/resources";

export interface AiClient {
    runAI(messages: ChatCompletionMessageParam[]): Promise<ChatCompletionMessageParam[]>;
}

export class OpenAiClient implements AiClient {
    #openai: OpenAI;
    constructor(
        private baseURL: string,
        private apiKey: string,
        private model: string = 'gpt-4',
        private instructions: string,
        private additionalInstructions: (arg0: object) => string = ({ }) => { return ''; },
        private tools: ChatCompletionTool[],
        private functions: Record<string, (arg1: object, arg2: object) => Promise<string>>,
    ) {
        this.#openai = new OpenAI({
            baseURL: this.baseURL,
            apiKey: this.apiKey
        });
    }
    // #parseMessages(messages: string[]): ChatCompletionMessageParam[] {
    //     return JSON.parse(`[${messages.join(",")}]`);
    // }
    async #callTool(
        tool_call: ChatCompletionMessageFunctionToolCall,
        additionalArgs: object):
        Promise<{
            tool_call_id: string,
            content: string
        }> {
        const tool_call_id = tool_call?.id;
        const functionName = tool_call?.function.name;
        const functionArgs = JSON.parse(tool_call?.function.arguments || '{}');
        if (!functionName || !this.functions[functionName]) {
            throw new Error(`Unknown tool function: ${functionName}`);
        }
        const fn = this.functions[functionName];
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
            model: this.model,
        });
        const message = completion?.choices?.[0]?.message;
        if (!message) {
            throw new Error("OpenAI returned no message");
        }
        const tool_calls = message?.tool_calls;
        return {
            message,
            tool_calls
        };
    }
    async runAI(messages: ChatCompletionMessageParam[], additionalArgs: object = {}, additionalInstructionsArgs: object = {}): Promise<ChatCompletionMessageParam[]> {
        const output: ChatCompletionMessageParam[] = [];
        const conversation: ChatCompletionMessageParam[] = [...messages];
        conversation.unshift({
            role: 'system',
            content: this.instructions
        });
        const replies = async () => {
            const addInst = this.additionalInstructions(additionalInstructionsArgs);
            if (addInst.length > 0) {
                let insertIndex = 0;
                for (let i = conversation.length - 1; i >= 0; i--) {
                    if (conversation[i]?.role !== 'tool') {
                        insertIndex = i;
                        break;
                    }
                }
                conversation.splice(insertIndex, 0, {
                    role: 'system',
                    content: addInst
                });
            }
            const reply = await this.#gpt(conversation, this.tools);
            if (!reply.message) {
                throw new Error("OpenAI returned no message");
            }
            output.push(reply.message);
            conversation.push(reply.message);
            if (reply.tool_calls) {
                for (let i = 0; i < reply.tool_calls.length; i++) {
                    if(!reply.tool_calls[i]){
                        throw Error(' Tool call undefined')
                    }
                    const result = await this.#callTool(reply.tool_calls[i], additionalArgs)
                    output.push({
                        role: 'tool',
                        tool_call_id: result.tool_call_id,
                        content: result.content || ''
                    });
                    conversation.push({
                        role: 'tool',
                        tool_call_id: result.tool_call_id,
                        content: result.content || ''
                    });
                }
                await replies();
            }
        };
        await replies();
        return output;
    }
}