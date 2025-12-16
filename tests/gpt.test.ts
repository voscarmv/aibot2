import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiClient } from '../src/aibot/gpt';
import type { ChatCompletionMessageParam } from 'openai/resources';

// Mock the OpenAI module
vi.mock('openai', () => {
  const OpenAI = vi.fn();
  OpenAI.prototype.chat = {
    completions: {
      create: vi.fn()
    }
  };
  return { default: OpenAI };
});

describe('OpenAiClient', () => {
  let client: OpenAiClient;
  let mockCreate: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Get reference to the mocked create function
    const OpenAI = (await import('openai')).default;
    mockCreate = OpenAI.prototype.chat.completions.create;
    
    client = new OpenAiClient({
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4',
      instructions: 'You are a helpful assistant.'
    });
  });

  describe('runAI - basic functionality', () => {
    it('should return AI response without tool calls', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Hello! How can I help you?'
          }
        }]
      };
      
      mockCreate.mockResolvedValueOnce(mockResponse);

      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await client.runAI(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        role: 'assistant',
        content: 'Hello! How can I help you?'
      });
      
      expect(mockCreate).toHaveBeenCalledTimes(1);
      
      // Verify the call was made with correct initial messages
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4');
      expect(callArgs.tools).toEqual([]);
      expect(callArgs.messages).toEqual([
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hello! How can I help you?' }
      ]);
    });

    it('should throw error when no message returned', async () => {
      mockCreate.mockResolvedValueOnce({ choices: [] });

      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.runAI(messages)).rejects.toThrow('OpenAI returned no message');
    });
  });

  describe('runAI - with tool calls', () => {
    it('should handle single tool call', async () => {
      const mockFunction = vi.fn().mockResolvedValue('Weather is sunny');
      
      client = new OpenAiClient({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        instructions: 'You are a helpful assistant.',
        tools: [{
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: {} }
          }
        }],
        functions: {
          get_weather: mockFunction
        }
      });

      // First response with tool call
      const firstResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location":"NYC"}'
              }
            }]
          }
        }]
      };

      // Second response after tool execution
      const secondResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'The weather in NYC is sunny.'
          }
        }]
      };

      mockCreate
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const messages: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'What is the weather in NYC?' }
      ];

      const result = await client.runAI(messages);

      expect(mockFunction).toHaveBeenCalledWith(
        { location: 'NYC' },
        {}
      );
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(firstResponse.choices[0].message);
      expect(result[1]).toEqual({
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'Weather is sunny'
      });
      expect(result[2]).toEqual({
        role: 'assistant',
        content: 'The weather in NYC is sunny.'
      });
    });

    it('should handle multiple tool calls', async () => {
      const mockWeather = vi.fn().mockResolvedValue('Sunny');
      const mockTime = vi.fn().mockResolvedValue('12:00 PM');
      
      client = new OpenAiClient({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        instructions: 'You are a helpful assistant.',
        tools: [
          { type: 'function', function: { name: 'get_weather', description: '', parameters: {} } },
          { type: 'function', function: { name: 'get_time', description: '', parameters: {} } }
        ],
        functions: {
          get_weather: mockWeather,
          get_time: mockTime
        }
      });

      const firstResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'get_weather', arguments: '{}' }
              },
              {
                id: 'call_2',
                type: 'function',
                function: { name: 'get_time', arguments: '{}' }
              }
            ]
          }
        }]
      };

      const secondResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Weather is sunny and time is 12:00 PM'
          }
        }]
      };

      mockCreate
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      const result = await client.runAI([{ role: 'user', content: 'Weather and time?' }]);

      expect(mockWeather).toHaveBeenCalled();
      expect(mockTime).toHaveBeenCalled();
      expect(result).toHaveLength(4); // assistant message, 2 tool results, final assistant message
    });

    it('should throw error for unknown tool', async () => {
      const firstResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'unknown_function',
                arguments: '{}'
              }
            }]
          }
        }]
      };

      mockCreate.mockResolvedValueOnce(firstResponse);

      await expect(
        client.runAI([{ role: 'user', content: 'Test' }])
      ).rejects.toThrow('Unknown tool function: unknown_function');
    });
  });

  describe('additionalInstructions', () => {
    it('should inject additional instructions before last non-tool message', async () => {
      client = new OpenAiClient({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        instructions: 'Base instructions',
        additionalInstructions: (args: any) => `User context: ${args.context}`
      });

      mockCreate.mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });

      await client.runAI(
        [{ role: 'user', content: 'Hello' }],
        {},
        { context: 'premium user' }
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toContainEqual({
        role: 'system',
        content: 'User context: premium user'
      });
    });

    it('should not inject empty additional instructions', async () => {
      mockCreate.mockResolvedValue({
        choices: [{
          message: { role: 'assistant', content: 'Response' }
        }]
      });

      await client.runAI([{ role: 'user', content: 'Hello' }]);

      const callArgs = mockCreate.mock.calls[0][0];
      const systemMessages = callArgs.messages.filter((m: any) => m.role === 'system');
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe('You are a helpful assistant.');
    });
  });

  describe('additionalToolsArgs', () => {
    it('should pass additional args to tool functions', async () => {
      const mockFunction = vi.fn().mockResolvedValue('Result');
      
      client = new OpenAiClient({
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        instructions: 'Assistant',
        tools: [{
          type: 'function',
          function: { name: 'test_tool', description: '', parameters: {} }
        }],
        functions: {
          test_tool: mockFunction
        }
      });

      mockCreate
        .mockResolvedValueOnce({
          choices: [{
            message: {
              role: 'assistant',
              tool_calls: [{
                id: 'call_1',
                type: 'function',
                function: { name: 'test_tool', arguments: '{"param":"value"}' }
              }]
            }
          }]
        })
        .mockResolvedValueOnce({
          choices: [{
            message: { role: 'assistant', content: 'Done' }
          }]
        });

      await client.runAI(
        [{ role: 'user', content: 'Test' }],
        { userId: '123', sessionId: 'abc' }
      );

      expect(mockFunction).toHaveBeenCalledWith(
        { param: 'value' },
        { userId: '123', sessionId: 'abc' }
      );
    });
  });

  describe('conversation flow', () => {
    it('should maintain conversation history', async () => {
      mockCreate
        .mockResolvedValueOnce({
          choices: [{ message: { role: 'assistant', content: 'First response' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { role: 'assistant', content: 'Second response' } }]
        });

      // First call
      await client.runAI([{ role: 'user', content: 'Hello' }]);
      
      // Verify system message was added
      expect(mockCreate.mock.calls[0][0].messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    });
  });
});