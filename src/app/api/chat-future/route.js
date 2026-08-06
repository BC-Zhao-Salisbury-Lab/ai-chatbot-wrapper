import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize AI and DB
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// run redis rate limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Create a large sliding window for the final reward phase
const ratelimitFuture = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(500, "4 h") });

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

    const baseIdentifier = (qualtricsId && qualtricsId !== 'local_test_run') ? qualtricsId : ip;
    const dbCondition = `future_${condition}`;

    if (!isEOP) {
      // Append the condition so the 500 limit is unique to that specific URL
      const redisKey = `${baseIdentifier}_future_${condition}`;
      
      const { success } = await ratelimitFuture.limit(redisKey);
      
      if (!success) {
        return NextResponse.json(
          { error: "You have reached the 500-message limit for this future planning link." }, 
          { status: 429 }
        );
      }
    }

    // EOP Logging
    if (isEOP) {
      const { error: eopError } = await supabase.from('study_logs').insert([{
        qualtrics_response_id: qualtricsId || 'local_test_run',
        condition: dbCondition,
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
      ? `You are Travel Advisor Jordan. Speak like an advisor, guide, and coach, not an assistant... (truncated for brevity)`
      : `You are Travel Assistant Jordan. Speak like an assistant, secretary, and sidekick, not an advisor... (truncated for brevity)`;

    const recentMessages = messages.slice(-10);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", 
      max_tokens: 4000, 
      system: systemInstruction, 
      messages: recentMessages, 
    });

    const aiText = response.content[0].text;
    const userText = messages[messages.length - 1].content; 

    // supabase logging
    const { error: supabaseError } = await supabase.from('study_logs').insert([{
      qualtrics_response_id: qualtricsId || 'local_test_run',
      condition: dbCondition,
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