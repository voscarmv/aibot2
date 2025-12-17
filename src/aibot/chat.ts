import { type AiClient } from "./gpt.js";
import { type MessageStore } from "./store.js";
import type {
    ChatCompletionMessageParam,
} from "openai/resources";

type ChatParams = {
    aiClient: AiClient, messageStore: MessageStore
}

export class ChatService {
    #aiClient: AiClient;
    #messageStore: MessageStore;
    #busy = new Set<string>();

    constructor(params: ChatParams) {
        this.#aiClient = params.aiClient;
        this.#messageStore = params.messageStore;
    }
    #reply(messages: ChatCompletionMessageParam[], replyFn: any) {
        messages.map(
            (msg: ChatCompletionMessageParam) => {
                if (typeof (msg.content) === "string")
                    if (msg.role === "assistant")
                        replyFn(msg.content);
            }
        );
    }
    async processMessages(
        user_id: string,
        content: string,
        replyFn: any = () => null,
        additionalToolsArgs?: object,
        additionalInstructionsArgs?: object):
        Promise<
            string[]
        > {
        await this.#messageStore.insertMessages(user_id, true, [{ role: 'user', content }]);
        if (this.#busy.has(user_id)) {
            return [];
        }
        this.#busy.add(user_id);
        let output: ChatCompletionMessageParam[] = [];
        let queued = await this.#messageStore.queuedMessages(user_id);
        while (queued.length > 0) {
            await this.#messageStore.unqueueUserMessages(user_id);
            const msgs = await this.#messageStore.readUserMessages(user_id);
            const reply = await this.#aiClient.runAI(msgs, additionalToolsArgs, additionalInstructionsArgs);
            await this.#messageStore.insertMessages(user_id, false, reply);
            output = output.concat(reply);
            queued = await this.#messageStore.queuedMessages(user_id);
        }
        this.#busy.delete(user_id);
        this.#reply(output, replyFn);
        return output.map((message)=>JSON.stringify(message));
    }
}
