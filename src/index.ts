import { aiClient } from "./bot.js";
import { messageStore } from "./api.js";
import { ChatService } from "./aibot/chat.js";
import { Bot, type Context } from "grammy";
import "dotenv/config";

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
    await chat.enqueueMessage(from, content);
    if (!chat.isBusy(from)) {
        (async () => {
            const aiReply = await chat.processMessages(from);
            aiReply.map((msg) => {
                if (typeof (msg.content) === "string") {
                    console.log(new Date(), "to:", from, msg.content);
                    ctx.reply(msg.content);
                }
            });
        })();
    }
});

bot.start();