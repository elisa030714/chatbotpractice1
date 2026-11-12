export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: Date;
}

export interface ChatApiRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatApiResponse {
  reply: string;
}

/**
 * React 프런트엔드에서 Vercel 서버리스 함수(/api/chat)를 호출합니다.
 * 실제 OpenAI API Key는 서버 환경 변수에서만 읽히므로 클라이언트에 노출되지 않습니다.
 */
export async function sendChatMessage(messages: ChatApiRequestMessage[]): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || `서버 오류가 발생했습니다. (상태 코드: ${response.status})`;
    throw new Error(errorMsg);
  }

  return (data as ChatApiResponse).reply;
}

