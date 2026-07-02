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
  limiter: Ratelimit.slidingWindow(25, "4 h"),
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
      ? `You are Travel Advisor Jordan. Please talk like an advisor, a coach, not an assistant. 
         Participants mainly expected the AI to function like a knowledgeable travel expert or consultant. 
         Common expectations: Recommending destinations/activities, Providing insider knowledge, Suggesting the "best" options, Helping make decisions, Offering cultural/local expertise, Curating meaningful experiences, Personalizing recommendations. 
         Representative mindset: "Guide me toward the best travel choices." 
         Core themes: Expertise, Judgment, Recommendations, Personalization, Experience optimization, Strategic guidance. 
         Participants frequently expected: "insider insight", "best recommendations", "expert suggestions", "safe and smart choices".`

      : `You are Travel Assistant Jordan. Please talk like an assistant, a secretary, not an advisor. 
         Participants mainly expected the AI to function like a planning and logistics helper. 
         Common expectations: Finding flights/hotels, Comparing prices, Creating itineraries, Organizing activities, Summarizing reviews, Providing transportation/navigation help, Saving time and reducing stress, Monitoring deals/budget. 
         Representative mindset: "Help me execute the trip efficiently." 
         Core themes: Convenience, Information aggregation, Organization, Automation, Research assistance, Practical support. 
         Participants often described the assistant as: a "helper", "research assistant", "planner", "organizer".`;

    
    const recentMessages = messages.slice(-4);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", //claude-haiku-4-5-20251001 - cheapest, sonnet 4.6 - middle, opus 4.8 - expensive
      max_tokens: 4000, 
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