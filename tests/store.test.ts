import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FunctionMessageStore, type MessageStore } from '../src/aibot/store';
import type { ChatCompletionMessageParam } from 'openai/resources';

describe('FunctionMessageStore', () => {
  let mockInsertMessages: MessageStore['insertMessages'];
  let mockUnqueueUserMessages: MessageStore['unqueueUserMessages'];
  let mockReadUserMessages: MessageStore['readUserMessages'];
  let mockQueuedMessages: MessageStore['queuedMessages'];
  let store: FunctionMessageStore;

  beforeEach(() => {
    mockInsertMessages = vi.fn();
    mockUnqueueUserMessages = vi.fn();
    mockReadUserMessages = vi.fn();
    mockQueuedMessages = vi.fn();

    store = new FunctionMessageStore({
      insertMessages: mockInsertMessages,
      unqueueUserMessages: mockUnqueueUserMessages,
      readUserMessages: mockReadUserMessages,
      queuedMessages: mockQueuedMessages
    });
  });

  describe('constructor', () => {
    it('should initialize with provided functions', () => {
      expect(store.insertMessages).toBe(mockInsertMessages);
      expect(store.unqueueUserMessages).toBe(mockUnqueueUserMessages);
      expect(store.readUserMessages).toBe(mockReadUserMessages);
      expect(store.queuedMessages).toBe(mockQueuedMessages);
    });
  });

  describe('insertMessages', () => {
    it('should call the provided insertMessages function with correct params', async () => {
      const userId = 'user123';
      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];
      const expectedResult = [...messages];

      (mockInsertMessages as any).mockResolvedValue(expectedResult);

      const result = await store.insertMessages(userId, false, messages);

      expect(mockInsertMessages).toHaveBeenCalledWith(userId, false, messages);
      expect(mockInsertMessages).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle queued messages', async () => {
      const userId = 'user456';
      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Test message' }
      ];

      (mockInsertMessages as any).mockResolvedValue(messages);

      await store.insertMessages(userId, true, messages);

      expect(mockInsertMessages).toHaveBeenCalledWith(userId, true, messages);
    });

    it('should handle empty messages array', async () => {
      const userId = 'user789';
      const messages: ChatCompletionMessageParam[] = [];

      (mockInsertMessages as any).mockResolvedValue(messages);

      const result = await store.insertMessages(userId, false, messages);

      expect(mockInsertMessages).toHaveBeenCalledWith(userId, false, messages);
      expect(result).toEqual([]);
    });

    it('should handle multiple message types', async () => {
      const userId = 'user999';
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Question' },
        { role: 'assistant', content: 'Answer' },
        { 
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'test', arguments: '{}' }
          }]
        },
        { role: 'tool', tool_call_id: 'call_1', content: 'Result' }
      ];

      (mockInsertMessages as any).mockResolvedValue(messages);

      const result = await store.insertMessages(userId, false, messages);

      expect(mockInsertMessages).toHaveBeenCalledWith(userId, false, messages);
      expect(result).toEqual(messages);
    });

    it('should propagate errors from insertMessages', async () => {
      const error = new Error('Database connection failed');
      (mockInsertMessages as any).mockRejectedValue(error);

      await expect(
        store.insertMessages('user123', false, [])
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('unqueueUserMessages', () => {
    it('should call the provided unqueueUserMessages function', async () => {
      const userId = 'user123';
      const expectedMessages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Queued message 1' },
        { role: 'user', content: 'Queued message 2' }
      ];

      (mockUnqueueUserMessages as any).mockResolvedValue(expectedMessages);

      const result = await store.unqueueUserMessages(userId);

      expect(mockUnqueueUserMessages).toHaveBeenCalledWith(userId);
      expect(mockUnqueueUserMessages).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle no queued messages', async () => {
      const userId = 'user456';
      (mockUnqueueUserMessages as any).mockResolvedValue([]);

      const result = await store.unqueueUserMessages(userId);

      expect(result).toEqual([]);
    });

    it('should propagate errors from unqueueUserMessages', async () => {
      const error = new Error('Queue error');
      (mockUnqueueUserMessages as any).mockRejectedValue(error);

      await expect(
        store.unqueueUserMessages('user123')
      ).rejects.toThrow('Queue error');
    });
  });

  describe('readUserMessages', () => {
    it('should call the provided readUserMessages function', async () => {
      const userId = 'user123';
      const expectedMessages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' }
      ];

      (mockReadUserMessages as any).mockResolvedValue(expectedMessages);

      const result = await store.readUserMessages(userId);

      expect(mockReadUserMessages).toHaveBeenCalledWith(userId);
      expect(mockReadUserMessages).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle user with no message history', async () => {
      const userId = 'newuser';
      (mockReadUserMessages as any).mockResolvedValue([]);

      const result = await store.readUserMessages(userId);

      expect(result).toEqual([]);
    });

    it('should propagate errors from readUserMessages', async () => {
      const error = new Error('Read error');
      (mockReadUserMessages as any).mockRejectedValue(error);

      await expect(
        store.readUserMessages('user123')
      ).rejects.toThrow('Read error');
    });
  });

  describe('queuedMessages', () => {
    it('should call the provided queuedMessages function', async () => {
      const userId = 'user123';
      const expectedMessages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Queued 1' },
        { role: 'user', content: 'Queued 2' }
      ];

      (mockQueuedMessages as any).mockResolvedValue(expectedMessages);

      const result = await store.queuedMessages(userId);

      expect(mockQueuedMessages).toHaveBeenCalledWith(userId);
      expect(mockQueuedMessages).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedMessages);
    });

    it('should handle no queued messages', async () => {
      const userId = 'user456';
      (mockQueuedMessages as any).mockResolvedValue([]);

      const result = await store.queuedMessages(userId);

      expect(result).toEqual([]);
    });

    it('should propagate errors from queuedMessages', async () => {
      const error = new Error('Query failed');
      (mockQueuedMessages as any).mockRejectedValue(error);

      await expect(
        store.queuedMessages('user123')
      ).rejects.toThrow('Query failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle a typical message flow', async () => {
      const userId = 'user123';
      
      // Initially no messages
      (mockReadUserMessages as any).mockResolvedValue([]);
      let messages = await store.readUserMessages(userId);
      expect(messages).toEqual([]);

      // Insert new messages
      const newMessages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ];
      (mockInsertMessages as any).mockResolvedValue(newMessages);
      await store.insertMessages(userId, false, newMessages);

      // Read messages again
      (mockReadUserMessages as any).mockResolvedValue(newMessages);
      messages = await store.readUserMessages(userId);
      expect(messages).toEqual(newMessages);
    });

    it('should handle queued and unqueued workflow', async () => {
      const userId = 'user123';
      
      // Insert queued messages
      const queuedMsgs: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Queued message' }
      ];
      (mockInsertMessages as any).mockResolvedValue(queuedMsgs);
      await store.insertMessages(userId, true, queuedMsgs);

      // Check queued messages
      (mockQueuedMessages as any).mockResolvedValue(queuedMsgs);
      const queued = await store.queuedMessages(userId);
      expect(queued).toEqual(queuedMsgs);

      // Unqueue messages
      (mockUnqueueUserMessages as any).mockResolvedValue(queuedMsgs);
      const unqueued = await store.unqueueUserMessages(userId);
      expect(unqueued).toEqual(queuedMsgs);

      // No more queued messages
      (mockQueuedMessages as any).mockResolvedValue([]);
      const remaining = await store.queuedMessages(userId);
      expect(remaining).toEqual([]);
    });

    it('should handle concurrent operations for different users', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      const messages1: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'User 1 message' }
      ];
      const messages2: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'User 2 message' }
      ];

      (mockInsertMessages as any)
        .mockResolvedValueOnce(messages1)
        .mockResolvedValueOnce(messages2);

      const [result1, result2] = await Promise.all([
        store.insertMessages(user1, false, messages1),
        store.insertMessages(user2, false, messages2)
      ]);

      expect(result1).toEqual(messages1);
      expect(result2).toEqual(messages2);
      expect(mockInsertMessages).toHaveBeenCalledTimes(2);
    });
  });
});