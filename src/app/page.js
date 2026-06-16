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

  //updater
  useEffect(() => {
    latestData.current = { tabs: tabOutCount, clicks: interactionCount, start: startTime, qId: qualtricsId, cond: condition };
  }, [tabOutCount, interactionCount, startTime, qualtricsId, condition]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('cc_sessionId');
    if (qId) setQualtricsId(qId);

    //start stopwatch
    const now = Date.now();
    setStartTime(now);
    latestData.current.start = now;

    //tab tracker
    const handleVisibilityChange = () => {
      if (document.hidden) setTabOutCount(prev => prev + 1);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    //heartbeat
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
    }, 15000); //15 seconds

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(heartbeatInterval);
    };
  }, []);

  //send
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
    <div style={{ maxWidth: '600px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Travel Planning Platform</h2>
      
      {/*header*/}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <label style={{ marginRight: '15px', fontWeight: 'bold' }}>Agent Mode:</label>
          <select 
            value={condition} 
            onChange={(e) => setCondition(e.target.value)}
            style={{ padding: '5px', borderRadius: '4px' }}
          >
            <option value="assistant">Assistant (Execution Only)</option>
            <option value="advisor">Advisor (Strategic Planner)</option>
          </select>
        </div>
      </div>

      {/*chat window*/}
      <div style={{ border: '1px solid #ccc', borderRadius: '8px', height: '400px', overflowY: 'scroll', padding: '15px', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
        {messages.length === 0 ? <p style={{ color: '#888', textAlign: 'center', marginTop: '150px' }}>Start planning your trip...</p> : null}
        
        {messages.map((msg, index) => (
          <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <span style={{ 
              background: msg.role === 'user' ? '#0070f3' : '#e0e0e0', 
              color: msg.role === 'user' ? 'white' : 'black',
              padding: '10px 14px', 
              borderRadius: '15px', 
              display: 'inline-block',
              maxWidth: '80%',
              lineHeight: '1.4'
            }}>
              {msg.content}
            </span>
          </div>
        ))}
        {isLoading && <div style={{ textAlign: 'left', color: '#888', margin: '10px 0' }}>Thinking...</div>}
      </div>

      {/*input*/}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Where do you want to go?"
          style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <button 
          onClick={sendMessage} 
          disabled={isLoading}
          style={{ padding: '12px 24px', fontSize: '16px', borderRadius: '6px', background: '#0070f3', color: 'white', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}