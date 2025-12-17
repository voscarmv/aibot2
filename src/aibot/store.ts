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
  insertMessages: (
    userId: string,
    queued: boolean,
    messages: string[]
  ) => Promise<string[]>,
  unqueueUserMessages: (
    userId: string
  ) => Promise<string[]>,
  readUserMessages: (
    userId: string
  ) => Promise<string[]>,
  queuedMessages: (
    userId: string
  ) => Promise<string[]>,
}

export class FunctionMessageStore implements MessageStore {
  insertMessages: MessageStore["insertMessages"];
  unqueueUserMessages: MessageStore["unqueueUserMessages"];
  readUserMessages: MessageStore["readUserMessages"];
  queuedMessages: MessageStore["queuedMessages"];

  constructor(fns: MessageStoreFns) {
    this.insertMessages = async (
      userId: string,
      queued: boolean,
      messages: ChatCompletionMessageParam[]
    ) => {
      const output = await fns.insertMessages(
        userId,
        queued,
        messages.map((message) => JSON.stringify(message))
      );
      return output.map((message) => JSON.parse(message));
    };
    this.unqueueUserMessages = async (userId: string) => {
      const output = await fns.unqueueUserMessages(userId);
      return output.map((message) => JSON.parse(message));
    };
    this.readUserMessages = async (userId: string) => {
      const output = await fns.readUserMessages(userId);
      return output.map((message) => JSON.parse(message));
    }
    this.queuedMessages = async (userId: string) => {
      const output = await fns.queuedMessages(userId);
      return output.map((message) => JSON.parse(message));
    } 
  }
}

