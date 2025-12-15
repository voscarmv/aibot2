import { type AiClient } from "./gpt.js";
import { type MessageStore } from "./db.js";
import type {
    ChatCompletionMessageParam,
} from "openai/resources";

export class ChatService {
    #aiClient: AiClient;
    #dbApi: MessageStore;
    #busy: string[];

    constructor(aiClient: AiClient, dbApi: MessageStore) {
        this.#aiClient = aiClient;
        this.#dbApi = dbApi;
        this.#busy = [];
    }

    #makeBusy(value: string) {
        if (!this.#busy.includes(value)) {
            this.#busy.push(value);
        }
        return this.#busy;
    }

    // Find a string (case-sensitive by default)
    #isBusy(value: string) {
        return this.#busy.find(item => item === value);
    }

    // Remove a string (removes all occurrences)
    #freeBusy(value: string) {
        let index;
        while ((index = this.#busy.indexOf(value)) !== -1) {
            this.#busy.splice(index, 1);
        }
        return this.#busy;
    }

    // Optional helper to list all items
    #listBusy() {
        return [...this.#busy];
    }

    async processMessages(user_id: string, message: string): Promise<ChatCompletionMessageParam[]> {
        const output: ChatCompletionMessageParam[] = [];
        await this.#dbApi.insertMessages(user_id, true, [{ role: 'user', content: message}]);
        if(!this.#isBusy(user_id)){
            this.#makeBusy(user_id);
            let queued = await this.#dbApi.queuedMessages(user_id);
            while(queued.length > 0){
                await this.#dbApi.unqueueUserMessages(user_id);
                const msgs = await this.#dbApi.readUserMessages(user_id);
                const reply = await this.#aiClient.runAI(msgs);
                await this.#dbApi.insertMessages(user_id, false, reply);
                output.concat(reply);
                queued = await this.#dbApi.queuedMessages(user_id);
            }
            this.#freeBusy(user_id);
        }
        return output;
    }
}
