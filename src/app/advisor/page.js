"use client";

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

export default function AdvisorPage() {
  const condition = 'advisor'; 

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I am Jordan, your AI Advisor for all your travel needs. What's in your mind?" }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [isLimitReached, setIsLimitReached] = useState(false);

  // Tracking Data
  const [qualtricsId, setQualtricsId] = useState('local_test');
  const [tabOutCount, setTabOutCount] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [startTime, setStartTime] = useState(null);

  // Refs for UI and Tracking
  const latestData = useRef({ tabs: 0, clicks: 0, start: null, qId: 'local_test', cond: condition });
  const inactivityTimer = useRef(null);
  const TIMEOUT_DURATION = 5 * 60 * 1000; 
  
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    latestData.current = { tabs: tabOutCount, clicks: interactionCount, start: startTime, qId: qualtricsId, cond: condition };
  }, [tabOutCount, interactionCount, startTime, qualtricsId]);

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

    const logEOP = (reason) => {
      const data = latestData.current;
      if (!data.start) return; 
      const elapsedSeconds = Math.floor((Date.now() - data.start) / 1000);

      fetch('/api/chat', {
        method: 'POST',
        keepalive: true, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [], 
          condition: data.cond,
          qualtricsId: data.qId,
          tabOutCount: data.tabs,
          interactionCount: data.clicks,
          totalTimeSeconds: elapsedSeconds,
          isEOP: true,
          eopReason: reason
        }),
      }).catch(err => console.log("EOP log failed"));
    };

    const resetTimeout = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        logEOP('inactivity_timeout');
      }, TIMEOUT_DURATION);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener('beforeunload', () => logEOP('tab_closed'));
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);
    
    resetTimeout(); 

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener('beforeunload', () => logEOP('tab_closed'));
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, []);

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLimitReached) return;

    const currentInteractions = interactionCount + 1;
    setInteractionCount(currentInteractions);
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

    const newMessages = [...messages, { role: 'user', content: input }];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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

      if (response.status === 429) {
        setIsLimitReached(true);
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: "**System Message:** You have reached the maximum number of messages allowed for this study. Please return to Qualtrics to complete the final survey." 
        }]);
        return;
      }

      if (data.result) {
        setMessages([...newMessages, { role: 'assistant', content: data.result }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="layout-bg" style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter", system-ui, -apple-system, sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
        <h2 style={{ margin: '0', color: '#0f172a', fontSize: '15px', fontWeight: '600' }}>
          Travel Advisor
        </h2>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Custom Header Layout */}
          <div style={{ textAlign: 'center', margin: '0 auto 16px auto', padding: '20px 20px 0 20px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: '500', color: '#000000', marginBottom: '8px' }}>
              Travel Advisor Jordan
            </h1>
            <p style={{ fontSize: '15px', color: '#888888', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              By Min Zhao
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </p>
            <p style={{ fontSize: '15px', color: '#333333', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
              Think of me as an expert coach – someone who is there to give you best guidance so you can simply follow.
            </p>
          </div>
          
          {messages.map((msg, index) => (
            <div key={index} style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              
              {/* AI Profile */}
              {msg.role === 'assistant' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
              )}

              {/* Message UI */}
              <div style={{ 
                background: msg.role === 'user' ? '#f1f5f9' : 'transparent',
                padding: msg.role === 'user' ? '12px 18px' : '2px 0', 
                borderRadius: msg.role === 'user' ? '16px' : '0',
                maxWidth: msg.role === 'user' ? '75%' : '90%',
                fontSize: '15.5px',
                lineHeight: '1.65',
                color: '#1e293b',
                whiteSpace: msg.role === 'user' ? 'pre-wrap' : 'normal',
                overflowWrap: 'break-word',
                border: msg.role === 'assistant' && index === 0 ? '1px solid #e2e8f0' : 'none',
                padding: msg.role === 'assistant' && index === 0 ? '16px 20px' : (msg.role === 'user' ? '12px 18px' : '2px 0'),
                borderRadius: msg.role === 'assistant' && index === 0 ? '16px' : (msg.role === 'user' ? '16px' : '0'),
                boxShadow: msg.role === 'assistant' && index === 0 ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none',
              }}>
                {msg.role === 'user' ? msg.content : (
                  <div className="markdown-body">
                    <ReactMarkdown 
                      components={{
                        p: ({node, ...props}) => <p style={{margin: '0 0 16px 0', color: index === 0 ? '#64748b' : 'inherit'}} {...props} />,
                        ul: ({node, ...props}) => <ul style={{margin: '0 0 16px 0', paddingLeft: '24px'}} {...props} />,
                        ol: ({node, ...props}) => <ol style={{margin: '0 0 16px 0', paddingLeft: '24px'}} {...props} />,
                        li: ({node, ...props}) => <li style={{marginBottom: '8px'}} {...props} />,
                        strong: ({node, ...props}) => <strong style={{fontWeight: '600', color: '#0f172a'}} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{margin: '28px 0 14px 0', fontSize: '20px', fontWeight: '600', color: '#0f172a'}} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{margin: '22px 0 10px 0', fontSize: '17px', fontWeight: '600', color: '#0f172a'}} {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'flex-start', animation: 'fadeIn 0.2s ease-in' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <div style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="dot-pulse"></span>
                <span className="dot-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="dot-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{ padding: '24px 20px', background: 'linear-gradient(to top, rgba(255,255,255,1) 50%, rgba(255,255,255,0) 100%)', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>
          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'flex-end', backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <textarea 
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isLimitReached}
              placeholder={isLimitReached ? "Study portion complete." : "Message Advisor..."}
              rows={1}
              style={{ flex: 1, padding: '4px 8px 4px 12px', fontSize: '15.5px', lineHeight: '1.5', background: 'transparent', border: 'none', outline: 'none', color: '#0f172a', resize: 'none', minHeight: '24px', maxHeight: '200px', overflowY: 'auto' }}
            />
            <button 
              className="send-btn"
              onClick={sendMessage} 
              disabled={isLoading || !input.trim() || isLimitReached}
              style={{ padding: '6px', margin: '0 0 2px 8px', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: (isLoading || !input.trim() || isLimitReached) ? '#e2e8f0' : '#0f172a', color: (isLoading || !input.trim() || isLimitReached) ? '#94a3b8' : 'white', border: 'none', cursor: (isLoading || !input.trim() || isLimitReached) ? 'not-allowed' : 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"></line>
                <polyline points="5 12 12 5 19 12"></polyline>
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#94a3b8' }}>
            Travel Advisor can make mistakes. Verify important information.
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .layout-bg { background-color: #ffffff; background-image: radial-gradient(#e2e8f0 1px, transparent 1px); background-size: 24px 24px; }
        .input-wrapper:focus-within { border-color: #94a3b8 !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05) !important; }
        .send-btn:not(:disabled):hover { background: #334155 !important; }
        .dot-pulse { width: 6px; height: 6px; background-color: #94a3b8; border-radius: 50%; display: inline-block; animation: pulse 1.4s infinite ease-in-out both; }
        @keyframes pulse { 0%, 80%, 100% { transform: scale(0); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}