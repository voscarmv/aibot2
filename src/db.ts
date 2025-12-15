import type {
    ChatCompletionMessageParam,
} from "openai/resources";

export interface DbApi {
    insertMessages: (user_id: string, queued: boolean, messages: ChatCompletionMessageParam[]) => Promise<ChatCompletionMessageParam[]>,
    unqueueUserMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>,
    readUserMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>,
    queuedMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>
};

type DbApiFunctions = {
    insertMessagesFunc: (user_id: string, queued: boolean, messages: ChatCompletionMessageParam[]) => Promise<ChatCompletionMessageParam[]>,
    unqueueUserMessagesFunc: (user_id: string) => Promise<ChatCompletionMessageParam[]>,
    readUserMessagesFunc: (user_id: string) => Promise<ChatCompletionMessageParam[]>,
    queuedMessagesFunc: (user_id: string) => Promise<ChatCompletionMessageParam[]>
}

export class DbApiClient implements DbApi {
    public insertMessages: (user_id: string, queued: boolean, messages: ChatCompletionMessageParam[]) => Promise<ChatCompletionMessageParam[]>;
    public unqueueUserMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>;
    public readUserMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>;
    public queuedMessages: (user_id: string) => Promise<ChatCompletionMessageParam[]>;
    constructor({
        insertMessagesFunc,
        unqueueUserMessagesFunc,
        readUserMessagesFunc,
        queuedMessagesFunc
    }: DbApiFunctions) {
        this.insertMessages = insertMessagesFunc;
        this.unqueueUserMessages = unqueueUserMessagesFunc;
        this.readUserMessages = readUserMessagesFunc;
        this.queuedMessages = queuedMessagesFunc;
    }
}

