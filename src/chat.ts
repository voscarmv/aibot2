import { type AiClient } from "./gpt.js";
import { type DbApi } from "./db.js";

export class ChatService {
  constructor(
    private aiClient: AiClient,
    private dbApi: DbApi
  ) {}
  async processMessages(): Promise<void> {
    // Process loop for message queue
    // involving DB/API/backend operations and GPT processing
  }
}