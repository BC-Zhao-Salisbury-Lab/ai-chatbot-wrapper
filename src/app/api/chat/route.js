import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000, //DO NOT INCREASE TO LARGE NUMBER
      messages: [{ role: "user", content: message }],
    });

    return NextResponse.json({ reply: response.content[0].text });

  } catch (error) { //error checkers
    console.error("API Wrapper Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}