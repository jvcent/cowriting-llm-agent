import { NextResponse } from "next/server";
import { AI_MODELS } from "@/services/AI";

// Don't expose API key on the client side - use server-side only
const OPENAI_API_KEY = process.env.GPT_API_KEY;

interface Message {
  sender: "user" | "assistant";
  text: string;
}

export async function POST(request: Request) {
  try {
    // Check if API key is available
    if (!OPENAI_API_KEY) {
      console.error("GPT_API_KEY environment variable is not set");
      return NextResponse.json(
        { error: "OpenAI API key is not configured" },
        { status: 500 },
      );
    }

    const { messages, systemPrompt, model } = await request.json();

    // Find the model config or use the first OpenAI model as default
    const modelConfig =
      Object.values(AI_MODELS).find(
        (m) => m.id === model && m.provider === "openai",
      ) || Object.values(AI_MODELS).find((m) => m.provider === "openai");

    if (!modelConfig) {
      throw new Error("No OpenAI model configuration found");
    }

    console.log(
      "Calling OpenAI with model:",
      modelConfig.id,
      "API key present:",
      !!OPENAI_API_KEY,
    );

    // Filter out messages with null/undefined/empty text and map them
    const filteredMessages = messages
      .filter((msg: Message) => msg.text && msg.text.trim() !== "")
      .map((msg: Message) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.text || "",
      }));

    const openAIMessages = [
      {
        role: "system",
        content:
          systemPrompt ||
          "You are a helpful teaching assistant named Bob who helps students with math problems.",
      },
      ...filteredMessages,
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelConfig.id,
        max_completion_tokens: modelConfig.maxTokens,
        temperature: modelConfig.temperature,
        messages: openAIMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error response:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ message: data.choices[0].message.content });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error calling OpenAI API:", errorMessage);
    return NextResponse.json(
      { error: "Failed to get response from OpenAI", details: errorMessage },
      { status: 500 },
    );
  }
}
