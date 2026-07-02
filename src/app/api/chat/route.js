import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize AI and DB
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// run redis rate limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// rate limiter conditions
const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(2, "1 h"),
});

export async function POST(req) {
  try {
    // ip grabber (for rate limiting)
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    
    const { 
      messages, 
      condition, 
      qualtricsId, 
      tabOutCount, 
      interactionCount, 
      totalTimeSeconds,
      isEOP, 
      eopReason 
    } = await req.json();

    const identifier = (qualtricsId && qualtricsId !== 'local_test_run') ? qualtricsId : ip;

    if (!isEOP) {
      const { success } = await ratelimit.limit(identifier);
      if (!success) {
        return NextResponse.json(
          { error: "Message limit reached. You have completed the chat portion of the study." }, 
          { status: 429 }
        );
      }
    }

    // EOP
    if (isEOP) {
      const { error: eopError } = await supabase.from('study_logs').insert([{
        qualtrics_response_id: qualtricsId || 'local_test_run',
        condition: condition,
        user_message: `[END OF PROGRAM - ${eopReason}]`,
        ai_response: "[AUTO-SAVE]",
        tab_out_count: tabOutCount,
        interaction_count: interactionCount,
        total_time_seconds: totalTimeSeconds
      }]);
      
      if (eopError) console.error("EOP log failed:", eopError);
      return NextResponse.json({ result: "EOP logged" });
    }

    if (!messages) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    // AI Prompts
    const systemInstruction = condition === 'advisor'
      ? "You are a strategic travel advisor. Proactively evaluate logistics, challenge the user's assumptions, and offer optimized structural alternatives. Do not just blindly follow instructions."
      : "You are an execution travel assistant. Provide direct, literal answers. Do not offer unsolicited strategic guidance, and strictly follow user instructions.";

    
    const recentMessages = messages.slice(-4);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", //claude-haiku-4-5-20251001 - cheapest, sonnet 4.6 - middle, opus 4.8 - expensive
      max_tokens: 1000, 
      system: systemInstruction, 
      messages: recentMessages, 
    });

    const aiText = response.content[0].text;
    const userText = messages[messages.length - 1].content; 

    // supabase logging
    const { error: supabaseError } = await supabase.from('study_logs').insert([{
      qualtrics_response_id: qualtricsId || 'local_test_run',
      condition: condition,
      user_message: userText,
      ai_response: aiText,
      tab_out_count: tabOutCount,
      interaction_count: interactionCount,
      total_time_seconds: totalTimeSeconds
    }]);

    if (supabaseError) console.error("Supabase Logging Error:", supabaseError);

    return NextResponse.json({ result: aiText });

  } catch (error) { 
    console.error("API Wrapper Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}