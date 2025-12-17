import { aiClient } from "./bot.js";
import { messageStore } from "./api.js";
import { ChatService } from "./aibot/chat.js";
import { Bot } from "grammy";
import "dotenv/config";
import type { ChatCompletionMessageParam } from "openai/resources";

const chat = new ChatService({
    aiClient,
    messageStore
});
if (!process.env.TELEGRAM_KEY) {
    throw new Error("TELEGRAM_KEY is not defined");
}
const bot = new Bot(process.env.TELEGRAM_KEY);

bot.on("message:text", async (ctx) => {
    const from = ctx.message.from.id.toString();
    const content = ctx.message.text;
    console.log(new Date(), "from:", from, content);
    const reply = (messages: ChatCompletionMessageParam[]) => messages.map(
        (msg: ChatCompletionMessageParam) => {
            console.log(new Date(), "to:", from, msg.content);
            if (typeof (msg.content) === "string")
                if (msg.role === "assistant")
                    ctx.reply(msg.content)
        }
    );
    chat.processMessages(from, content, reply);
});

bot.start();