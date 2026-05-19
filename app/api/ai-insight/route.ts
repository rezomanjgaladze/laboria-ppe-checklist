import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("API KEY EXISTS:", !!process.env.OPENAI_API_KEY);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional occupational safety expert. Provide clear and structured recommendations.",
        },
        {
          role: "user",
          content: JSON.stringify(body),
        },
      ],
    });

    return NextResponse.json({
      result: completion.choices[0].message.content,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "AI request failed.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
