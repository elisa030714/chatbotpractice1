import React, { useEffect, useRef, useState } from 'react';
import { sendChatMessageStream, type ChatMessage } from '../api/chat';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `안녕하세요! 🎓 **영어 단어 퀴즈 챗봇**입니다.\n\n원하시는 **주제**(예: 여행, 비즈니스, 일상 등)나 **난이도**(초급, 중급, 고급)를 알려주시면, 알맞은 영어 단어 3개와 함께 짧은 복습 퀴즈를 내드릴게요!\n\n어떤 주제나 난이도로 공부해 볼까요?`,
  createdAt: new Date(),
};

const SUGGESTED_TOPICS = [
  { label: '✈️ 초급 여행 영어', prompt: '초급 난이도로 공항이나 여행에서 쓰는 필수 영어 단어를 알려줘.' },
  { label: '💼 중급 비즈니스', prompt: '중급 난이도로 비즈니스 미팅에서 유용한 영어 단어를 알려줘.' },
  { label: '☕ 일상 카페 회화', prompt: '초중급 일상생활이나 카페에서 자주 쓰는 영어 단어를 알려줘.' },
  { label: '📚 토익 필수 단어', prompt: '토익 시험에 자주 나오는 중고급 단어를 알려줘.' },
];

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 새 메시지 및 스트리밍 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      createdAt: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');

    // 스트리밍 시작 전: 기존의 답변 생성 중 로딩 표시 노출
    setIsLoading(true);

    try {
      const apiPayload = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const assistantMsgId = (Date.now() + 1).toString();
      let isFirstChunk = true;

      await sendChatMessageStream(apiPayload, (delta) => {
        if (isFirstChunk) {
          isFirstChunk = false;
          // 첫 번째 텍스트 조각이 도착하면 로딩 인디케이터를 끄고 어시스턴트 메시지 버블을 생성
          setIsLoading(false);
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: 'assistant',
              content: delta,
              createdAt: new Date(),
            },
          ]);
        } else {
          // 이후 청크들을 기존 어시스턴트 메시지 내용에 실시간 누적
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, content: msg.content + delta } : msg,
            ),
          );
        }
      });
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setErrorMessage(errorStr);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        createdAt: new Date(),
      },
    ]);
    setErrorMessage(null);
    setInput('');
  };

  return (
    <div className="chatbot-container">
      {/* 헤더 */}
      <header className="chatbot-header">
        <div className="chatbot-header-info">
          <div className="chatbot-avatar-icon">📚</div>
          <div>
            <h1 className="chatbot-title">영어 단어 퀴즈 챗봇</h1>
            <p className="chatbot-subtitle">Powered by gpt-6-luna (OpenAI Responses API)</p>
          </div>
        </div>
        <button
          type="button"
          className="chatbot-reset-btn"
          onClick={handleReset}
          title="대화 초기화"
        >
          🔄 초기화
        </button>
      </header>

      {/* 추천 주제 칩 목록 */}
      {messages.length <= 2 && (
        <div className="chatbot-suggestions">
          <span className="suggestions-label">추천 주제:</span>
          {SUGGESTED_TOPICS.map((topic) => (
            <button
              key={topic.label}
              type="button"
              className="suggestion-chip"
              disabled={isLoading}
              onClick={() => handleSendMessage(topic.prompt)}
            >
              {topic.label}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="chatbot-messages" role="log" aria-live="polite">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}
            >
              {!isUser && <div className="message-avatar">🤖</div>}
              <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                <div className="message-text">{message.content}</div>
                {message.createdAt && (
                  <span className="message-time">
                    {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* 로딩 인디케이터 (첫 청크 수신 전까지 노출) */}
        {isLoading && (
          <div className="message-row assistant-row">
            <div className="message-avatar">🤖</div>
            <div className="message-bubble assistant-bubble loading-bubble">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-text">단어와 퀴즈를 준비하고 있어요...</span>
            </div>
          </div>
        )}

        {/* 에러 메시지 안내 */}
        {errorMessage && (
          <div className="chatbot-error-banner">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <strong>오류 안내:</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <form
        className="chatbot-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="chatbot-input"
          placeholder="주제(예: 여행, 비즈니스)나 난이도, 또는 퀴즈 정답을 입력하세요..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chatbot-send-btn"
          disabled={!input.trim() || isLoading}
          aria-label="전송"
        >
          전송
        </button>
      </form>
    </div>
  );
};
export default Chatbot;
