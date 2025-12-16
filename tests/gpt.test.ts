import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiClient } from "../src/aibot/gpt";
import type { ChatCompletionMessageParam } from "openai/resources";

const createMock = vi.fn();

vi.mock("openai", () => {
  class MockOpenAI {
    chat = {
      completions: {
        create: createMock
      }
    };

    constructor(_opts: any) {
      // accept options but do nothing
    }
  }

  return {
    __esModule: true,
    default: MockOpenAI
  };
});


function assistantMessage(content: string) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content
        }
      }
    ]
  };
}

function toolCallMessage() {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "sum",
                arguments: JSON.stringify({ a: 2, b: 3 })
              }
            }
          ]
        }
      }
    ]
  };
}

describe("OpenAiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns assistant messages", async () => {
    createMock.mockResolvedValueOnce(
      assistantMessage("Hello world")
    );

    const client = new OpenAiClient({
      baseURL: "http://fake",
      apiKey: "fake",
      instructions: "You are helpful"
    });

    const result = await client.runAI([
      { role: "user", content: "Hi" }
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      role: "assistant",
      content: "Hello world"
    });

    expect(createMock).toHaveBeenCalledOnce();
  });

  it("executes tools and continues the conversation", async () => {
    createMock
      .mockResolvedValueOnce(toolCallMessage())
      .mockResolvedValueOnce(
        assistantMessage("The result is 5")
      );

    const sumFn = vi.fn(async ({ a, b }) => String(a + b));

    const client = new OpenAiClient({
      baseURL: "http://fake",
      apiKey: "fake",
      instructions: "You are a calculator",
      functions: {
        sum: sumFn
      }
    });

    const result = await client.runAI([
      { role: "user", content: "Add 2 + 3" }
    ]);

    expect(sumFn).toHaveBeenCalledOnce();
    expect(sumFn).toHaveBeenCalledWith({ a: 2, b: 3 }, {});

    expect(result).toEqual([
      expect.objectContaining({ role: "assistant" }),
      {
        role: "tool",
        tool_call_id: "tool-1",
        content: "5"
      },
      expect.objectContaining({
        role: "assistant",
        content: "The result is 5"
      })
    ]);

    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("throws if tool function is unknown", async () => {
    createMock.mockResolvedValueOnce(toolCallMessage());

    const client = new OpenAiClient({
      baseURL: "http://fake",
      apiKey: "fake",
      instructions: "You are helpful",
      functions: {}
    });

    await expect(
      client.runAI([{ role: "user", content: "test" }])
    ).rejects.toThrow("Unknown tool function");
  });
});
