import React, { useEffect, useRef, useState } from 'react';
import { sendChatMessageStream, type ChatMessage } from '../api/chat';

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `안녕하세요! 🎓 **영어 단어 퀴즈 챗봇**입니다.\n\n원하시는 **주제**(예: 여행, 비즈니스, 일상 등)나 **난이도**(초급, 중급, 고급)를 알려주시면, 알맞은 영어 단어 3개와 함께 짧은 복습 퀴즈를 내드릴게요!\n\n아래의 추천 버튼을 순서대로 선택하시거나 직접 입력해 보세요.`,
  createdAt: new Date(),
};

const TOPIC_OPTIONS = [
  { id: 'daily', label: '☕ 일상 회화', value: '일상 회화' },
  { id: 'business', label: '💼 비즈니스 영어', value: '비즈니스 영어' },
  { id: 'travel', label: '✈️ 공항/여행 영어', value: '공항/여행 영어' },
  { id: 'exam', label: '📚 토익/수능 필수 단어', value: '토익/수능 필수 단어' },
];

const DIFFICULTY_OPTIONS = [
  { id: 'beginner', label: '🌱 초급', value: '초급' },
  { id: 'intermediate', label: '🌿 중급', value: '중급' },
  { id: 'advanced', label: '🌳 고급', value: '고급' },
];

export const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
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
    setSelectedTopic(null);

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

  const handleSelectTopic = (topicValue: string) => {
    setSelectedTopic(topicValue);
  };

  const handleSelectDifficulty = (difficultyValue: string) => {
    if (!selectedTopic) return;
    const formattedPrompt = `주제: ${selectedTopic}\n난이도: ${difficultyValue}\n위 조건에 맞는 영어 단어 퀴즈를 시작해줘.`;
    handleSendMessage(formattedPrompt);
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
    setSelectedTopic(null);
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

      {/* 추천 버튼 영역 (1단계: 주제 선택 -> 2단계: 난이도 선택) */}
      {messages.length <= 2 && (
        <div className="chatbot-suggestions">
          {!selectedTopic ? (
            <>
              <span className="suggestions-label">1️⃣ 주제 선택:</span>
              {TOPIC_OPTIONS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className="suggestion-chip"
                  disabled={isLoading}
                  onClick={() => handleSelectTopic(topic.value)}
                >
                  {topic.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <span className="suggestions-label">
                선택한 주제: <strong>{selectedTopic}</strong>
              </span>
              <span className="suggestions-label">2️⃣ 난이도 선택:</span>
              {DIFFICULTY_OPTIONS.map((diff) => (
                <button
                  key={diff.id}
                  type="button"
                  className="suggestion-chip difficulty-chip"
                  disabled={isLoading}
                  onClick={() => handleSelectDifficulty(diff.value)}
                >
                  {diff.label}
                </button>
              ))}
              <button
                type="button"
                className="suggestion-chip back-chip"
                disabled={isLoading}
                onClick={() => setSelectedTopic(null)}
                title="주제 다시 선택"
              >
                ↩ 다른 주제 선택
              </button>
            </>
          )}
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

      {/* 입력창 (직접 입력 기능 유지) */}
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
