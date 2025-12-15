import { type AiClient } from "./gpt.js";
import { type DbApi } from "./db.js";

export class ChatService {
  #aiClient: AiClient;
  #dbApi: DbApi;

  constructor(aiClient: AiClient, dbApi: DbApi) {
    this.#aiClient = aiClient;
    this.#dbApi = dbApi;
  }

  async processMessages(): Promise<void> {
    // this.#aiClient
    // this.#dbApi
  }
}
