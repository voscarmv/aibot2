import { aiClient } from "./bot.js";
import { messageStore } from "./api.js";
import { ChatService } from "./aibot/chat.js";
import { Bot } from "grammy";

const chat = new ChatService({
    aiClient,
    messageStore
});

const bot = new Bot(process.env.TELEGRAM_KEY as string);

bot.on("message:text", async (ctx) => {
    const from = ctx.message.from.id;
    const content = ctx.message.text;
    console.log(new Date(), from, content);
    const aiReply = await chat.processMessages(from.toString(), content);
    aiReply.map((msg) => {
        if (typeof (msg.content) === "string") ctx.reply(msg.content);
    })
});