import type {
    ChatCompletionMessageParam,
} from "openai/resources";

export interface MessageStore {
  insertMessages(
    userId: string,
    queued: boolean,
    messages: ChatCompletionMessageParam[]
  ): Promise<ChatCompletionMessageParam[]>;

  unqueueUserMessages(
    userId: string
  ): Promise<ChatCompletionMessageParam[]>;

  readUserMessages(
    userId: string
  ): Promise<ChatCompletionMessageParam[]>;

  queuedMessages(
    userId: string
  ): Promise<ChatCompletionMessageParam[]>;
}

type MessageStoreFns = {
  insertMessages: MessageStore["insertMessages"]
  unqueueUserMessages: MessageStore["unqueueUserMessages"]
  readUserMessages: MessageStore["readUserMessages"]
  queuedMessages: MessageStore["queuedMessages"]
}

export class FunctionMessageStore implements MessageStore {
  insertMessages: MessageStore["insertMessages"];
  unqueueUserMessages: MessageStore["unqueueUserMessages"];
  readUserMessages: MessageStore["readUserMessages"];
  queuedMessages: MessageStore["queuedMessages"];

  constructor(fns: MessageStoreFns) {
    this.insertMessages = fns.insertMessages;
    this.unqueueUserMessages = fns.unqueueUserMessages;
    this.readUserMessages = fns.readUserMessages;
    this.queuedMessages = fns.queuedMessages;
  }
}

