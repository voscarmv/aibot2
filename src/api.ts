import 'dotenv/config';
import { messages } from './schema.js';
import { sql, eq, and, asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type {
    ChatCompletionMessageParam,
} from "openai/resources";
import { FunctionMessageStore } from './aibot/store.js';

const db = drizzle(process.env.DATABASE_URL!);

function parseMessages(messages: string[]): ChatCompletionMessageParam[] {
    return JSON.parse(`[${messages.join(",")}]`);
}

async function readUserMessages(user_id: string): Promise<ChatCompletionMessageParam[]> {
    const response: { message: string }[] = await db
        .select({ message: messages.message })
        .from(messages)
        .where(eq(messages.user_id, user_id))
        .orderBy(asc(messages.updated_at), asc(messages.id));
    return parseMessages(response.map(item => item.message));
}

async function unqueueUserMessages(user_id: string): Promise<ChatCompletionMessageParam[]> {
    const response: { message: string }[] = await db
        .update(messages)
        .set({ queued: false, updated_at: sql`now()` })
        .where(eq(messages.user_id, user_id))
        .returning({ message: messages.message });
    return parseMessages(response.map(item => item.message));
}

async function insertMessages(user_id: string, queued: boolean, msgs: ChatCompletionMessageParam[]): Promise<ChatCompletionMessageParam[]> {
    const response: { message: string }[] = await db
        .insert(messages)
        .values(msgs.map((msg) => (
            {
                user_id,
                queued,
                message: JSON.stringify(msg)
            }
        )))
        .returning({ message: messages.message });
    return parseMessages(response.map(item => item.message));
}

async function queuedMessages(user_id: string): Promise<ChatCompletionMessageParam[]> {
    const response: { message: string }[] = await db
        .select({ message: messages.message })
        .from(messages)
        .where(
            and(
                eq(messages.queued, true),
                eq(messages.user_id, user_id)
            ));
    return parseMessages(response.map(item => item.message));
}

export const messageStore = new FunctionMessageStore({
    readUserMessages,
    unqueueUserMessages,
    insertMessages,
    queuedMessages
});
