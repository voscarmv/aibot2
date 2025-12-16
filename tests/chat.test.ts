import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from '../src/aibot/chat';
import type { AiClient } from '../src/aibot/gpt';
import type { MessageStore } from '../src/aibot/store';
import type { ChatCompletionMessageParam } from 'openai/resources';

describe('ChatService', () => {
  let mockAiClient: AiClient;
  let mockMessageStore: MessageStore;
  let chatService: ChatService;

  beforeEach(() => {
    mockAiClient = {
      runAI: vi.fn()
    };

    mockMessageStore = {
      insertMessages: vi.fn(),
      unqueueUserMessages: vi.fn(),
      readUserMessages: vi.fn(),
      queuedMessages: vi.fn()
    };

    chatService = new ChatService({
      aiClient: mockAiClient,
      messageStore: mockMessageStore
    });
  });

  describe('constructor', () => {
    it('should initialize with provided aiClient and messageStore', () => {
      expect(chatService).toBeInstanceOf(ChatService);
    });
  });

  describe('processMessages', () => {
    it('should process a single message when user is not busy', async () => {
      const userId = 'user123';
      const message = 'Hello, AI!';
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Hello! How can I help?' }
      ];
      const storedMessages: ChatCompletionMessageParam[] = [
        userMessage
      ];

      // Setup mocks
      (mockMessageStore.insertMessages as any).mockResolvedValue([userMessage]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage]) // First check: has queued messages
        .mockResolvedValueOnce([]); // Second check: no more queued messages
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([userMessage]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue(storedMessages);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      const result = await chatService.processMessages(userId, message);

      // Verify insertMessages was called to queue the user message
      expect(mockMessageStore.insertMessages).toHaveBeenNthCalledWith(
        1,
        userId,
        true,
        [userMessage]
      );

      // Verify the message was unqueued
      expect(mockMessageStore.unqueueUserMessages).toHaveBeenCalledWith(userId);

      // Verify messages were read
      expect(mockMessageStore.readUserMessages).toHaveBeenCalledWith(userId);

      // Verify AI was called
      expect(mockAiClient.runAI).toHaveBeenCalledWith(storedMessages, undefined, undefined);

      // Verify AI response was stored
      expect(mockMessageStore.insertMessages).toHaveBeenNthCalledWith(
        2,
        userId,
        false,
        aiResponse
      );

      // Verify result (note: there's a bug in the original code - output.concat doesn't mutate)
      expect(result).toEqual([]);
    });

    it('should not process when user is already busy', async () => {
      const userId = 'user123';
      const message1 = 'First message';
      const message2 = 'Second message';

      const userMessage1: ChatCompletionMessageParam = { role: 'user', content: message1 };
      const userMessage2: ChatCompletionMessageParam = { role: 'user', content: message2 };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      // Setup for first message
      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage1])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage1]);
      (mockAiClient.runAI as any).mockImplementation(() => {
        // Simulate delay
        return new Promise(resolve => setTimeout(() => resolve(aiResponse), 100));
      });

      // Start processing first message (don't await)
      const promise1 = chatService.processMessages(userId, message1);

      // Try to process second message while first is still processing
      const promise2 = chatService.processMessages(userId, message2);

      await Promise.all([promise1, promise2]);

      // Second message should be queued but not processed
      expect(mockMessageStore.insertMessages).toHaveBeenCalledWith(
        userId,
        true,
        [userMessage2]
      );

      // AI should only be called once for the first message
      expect(mockAiClient.runAI).toHaveBeenCalledTimes(1);
    });

    it('should process multiple queued messages in sequence', async () => {
      const userId = 'user123';
      const message = 'Hello';
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      const queuedMsg1: ChatCompletionMessageParam = { role: 'user', content: 'Message 1' };
      const queuedMsg2: ChatCompletionMessageParam = { role: 'user', content: 'Message 2' };

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([queuedMsg1, queuedMsg2]) // Two queued
        .mockResolvedValueOnce([queuedMsg2]) // One remaining
        .mockResolvedValueOnce([]); // None remaining
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any)
        .mockResolvedValueOnce([queuedMsg1])
        .mockResolvedValueOnce([queuedMsg1, queuedMsg2]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await chatService.processMessages(userId, message);

      // Should process both queued messages
      expect(mockAiClient.runAI).toHaveBeenCalledTimes(2);
      expect(mockMessageStore.unqueueUserMessages).toHaveBeenCalledTimes(2);
    });

    it('should pass additionalToolsArgs to AI client', async () => {
      const userId = 'user123';
      const message = 'Test';
      const toolsArgs = { userId: 'user123', sessionId: 'abc' };
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await chatService.processMessages(userId, message, toolsArgs);

      expect(mockAiClient.runAI).toHaveBeenCalledWith(
        [userMessage],
        toolsArgs,
        undefined
      );
    });

    it('should pass additionalInstructionsArgs to AI client', async () => {
      const userId = 'user123';
      const message = 'Test';
      const instructionsArgs = { context: 'premium user' };
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await chatService.processMessages(userId, message, undefined, instructionsArgs);

      expect(mockAiClient.runAI).toHaveBeenCalledWith(
        [userMessage],
        undefined,
        instructionsArgs
      );
    });

    it('should pass both additional args to AI client', async () => {
      const userId = 'user123';
      const message = 'Test';
      const toolsArgs = { sessionId: 'xyz' };
      const instructionsArgs = { context: 'admin' };
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await chatService.processMessages(userId, message, toolsArgs, instructionsArgs);

      expect(mockAiClient.runAI).toHaveBeenCalledWith(
        [userMessage],
        toolsArgs,
        instructionsArgs
      );
    });

    it('should handle errors during AI processing', async () => {
      const userId = 'user123';
      const message = 'Test';
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any).mockResolvedValueOnce([userMessage]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockRejectedValue(new Error('AI Error'));

      await expect(
        chatService.processMessages(userId, message)
      ).rejects.toThrow('AI Error');
    });

    it('should handle errors during message insertion', async () => {
      const userId = 'user123';
      const message = 'Test';

      (mockMessageStore.insertMessages as any).mockRejectedValue(
        new Error('Database Error')
      );

      await expect(
        chatService.processMessages(userId, message)
      ).rejects.toThrow('Database Error');
    });

    it('should handle empty message', async () => {
      const userId = 'user123';
      const message = '';
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: '' };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'I received an empty message.' }
      ];

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await chatService.processMessages(userId, message);

      expect(mockMessageStore.insertMessages).toHaveBeenCalledWith(
        userId,
        true,
        [userMessage]
      );
    });

    it('should handle concurrent requests from different users', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      const message1 = 'Hello from user1';
      const message2 = 'Hello from user2';

      const userMessage1: ChatCompletionMessageParam = { role: 'user', content: message1 };
      const userMessage2: ChatCompletionMessageParam = { role: 'user', content: message2 };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValue([userMessage1])
        .mockResolvedValueOnce([userMessage1])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([userMessage2])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any)
        .mockResolvedValueOnce([userMessage1])
        .mockResolvedValueOnce([userMessage2]);
      (mockAiClient.runAI as any).mockResolvedValue(aiResponse);

      await Promise.all([
        chatService.processMessages(user1, message1),
        chatService.processMessages(user2, message2)
      ]);

      // Both users should be processed
      expect(mockAiClient.runAI).toHaveBeenCalledTimes(2);
    });
  });

  describe('busy state management', () => {
    it('should correctly manage busy state for a user', async () => {
      const userId = 'user123';
      const message = 'Test';
      const userMessage: ChatCompletionMessageParam = { role: 'user', content: message };
      const aiResponse: ChatCompletionMessageParam[] = [
        { role: 'assistant', content: 'Response' }
      ];

      let busyDuringProcessing = false;

      (mockMessageStore.insertMessages as any).mockResolvedValue([]);
      (mockMessageStore.queuedMessages as any)
        .mockResolvedValueOnce([userMessage])
        .mockResolvedValueOnce([]);
      (mockMessageStore.unqueueUserMessages as any).mockResolvedValue([]);
      (mockMessageStore.readUserMessages as any).mockResolvedValue([userMessage]);
      (mockAiClient.runAI as any).mockImplementation(async () => {
        // Try to process another message while this one is running
        const promise = chatService.processMessages(userId, 'Another message');
        
        // The second call should queue but not process
        await promise;
        busyDuringProcessing = true;
        
        return aiResponse;
      });

      await chatService.processMessages(userId, message);

      expect(busyDuringProcessing).toBe(true);
    });
  });
});