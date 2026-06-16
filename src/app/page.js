"use client";

import { useState, useEffect, useRef } from 'react';

export default function Home() {

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [condition, setCondition] = useState('assistant'); 
  const [isLoading, setIsLoading] = useState(false);


  const [qualtricsId, setQualtricsId] = useState('local_test');
  const [tabOutCount, setTabOutCount] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [startTime, setStartTime] = useState(null);


  const latestData = useRef({ tabs: 0, clicks: 0, start: null, qId: 'local_test', cond: 'assistant' });


  useEffect(() => {
    latestData.current = { tabs: tabOutCount, clicks: interactionCount, start: startTime, qId: qualtricsId, cond: condition };
  }, [tabOutCount, interactionCount, startTime, qualtricsId, condition]);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('cc_sessionId');
    if (qId) setQualtricsId(qId);

    const now = Date.now();
    setStartTime(now);
    latestData.current.start = now; 

    const handleVisibilityChange = () => {
      if (document.hidden) setTabOutCount(prev => prev + 1);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const heartbeatInterval = setInterval(() => {
      const data = latestData.current;
      if (!data.start) return;

      const elapsedSeconds = Math.floor((Date.now() - data.start) / 1000);

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [], 
          condition: data.cond,
          qualtricsId: data.qId,
          tabOutCount: data.tabs,
          interactionCount: data.clicks,
          totalTimeSeconds: elapsedSeconds,
          isHeartbeat: true 
        }),
      }).catch(err => console.log("Heartbeat skipped")); 
    }, 15000); 

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(heartbeatInterval);
    };
  }, []);

  //send funct
  const sendMessage = async () => {
    if (!input.trim()) return;

    const currentInteractions = interactionCount + 1;
    setInteractionCount(currentInteractions);
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newMessages,
          condition: condition,
          qualtricsId: qualtricsId,
          tabOutCount: tabOutCount,
          interactionCount: currentInteractions,
          totalTimeSeconds: elapsedSeconds
        }),
      });

      const data = await response.json();

      if (data.result) {
        setMessages([...newMessages, { role: 'assistant', content: data.result }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  //frontend
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
    }}>
      
      {/*window*/}
      <div style={{ 
        width: '100%', 
        maxWidth: '500px', 
        background: '#ffffff', 
        borderRadius: '24px', 
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/*header*/}
        <div style={{ padding: '30px 24px 20px 24px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✈️</div>
          <h2 style={{ margin: '0 0 16px 0', color: '#111827', fontSize: '22px', fontWeight: '700' }}>
            Travel Planner
          </h2>
          
          {/*buttons*/}
          <div style={{ 
            display: 'flex', 
            backgroundColor: '#f3f4f6', 
            padding: '6px', 
            borderRadius: '16px',
            gap: '6px'
          }}>
            <button 
              onClick={() => setCondition('assistant')}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                backgroundColor: condition === 'assistant' ? '#ffffff' : 'transparent',
                color: condition === 'assistant' ? '#2563eb' : '#6b7280',
                boxShadow: condition === 'assistant' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Assistant
            </button>

            <button 
              onClick={() => setCondition('advisor')}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap', // Stops the text from wrapping
                backgroundColor: condition === 'advisor' ? '#ffffff' : 'transparent',
                color: condition === 'advisor' ? '#2563eb' : '#6b7280',
                boxShadow: condition === 'advisor' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Advisor
            </button>
          </div>
        </div>

        {/*chat history*/}
        <div style={{ 
          height: '450px', 
          overflowY: 'auto', 
          padding: '24px', 
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/*empty*/}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#6b7280', margin: 'auto', padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.5 }}>👋</div>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5' }}>
                Hi! I'm your AI travel {condition}. <br/>
                Tell me where you'd like to go!
              </p>
            </div>
          )}
          
          {messages.map((msg, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' 
            }}>
              <div style={{ 
                background: msg.role === 'user' ? '#2563eb' : '#ffffff', 
                color: msg.role === 'user' ? '#ffffff' : '#1f2937',
                border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                padding: '12px 18px', 
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                maxWidth: '85%',
                fontSize: '15px',
                lineHeight: '1.5',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          
          {/*typing indicator*/}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #e5e7eb',
                padding: '12px 18px', 
                borderRadius: '18px 18px 18px 4px',
                color: '#9ca3af',
                fontSize: '14px',
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                <span style={{ animation: 'blink 1.4s infinite both' }}>•</span>
                <span style={{ animation: 'blink 1.4s infinite both', animationDelay: '0.2s' }}>•</span>
                <span style={{ animation: 'blink 1.4s infinite both', animationDelay: '0.4s' }}>•</span>
              </div>
            </div>
          )}
        </div>

        {/*input*/}
        <div style={{ padding: '20px 24px', backgroundColor: '#ffffff', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            backgroundColor: '#f9fafb',
            padding: '6px',
            borderRadius: '24px',
            border: '1px solid #e5e7eb'
          }}>
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Plan me a 5-day trip to Tokyo..."
              style={{ 
                flex: 1, 
                padding: '10px 16px', 
                fontSize: '15px', 
                background: 'transparent', 
                border: 'none', 
                outline: 'none',
                color: '#111827'
              }}
            />
            <button 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim()}
              style={{ 
                padding: '10px 20px', 
                fontSize: '15px', 
                fontWeight: '600',
                borderRadius: '20px', 
                background: isLoading || !input.trim() ? '#93c5fd' : '#2563eb', 
                color: 'white', 
                border: 'none', 
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s ease'
              }}
            >
              Send
            </button>
          </div>
        </div>

      </div>
      
      {/*css*/}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}} />
    </div>
  );
}