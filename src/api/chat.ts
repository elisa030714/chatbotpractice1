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
 * React 프런트엔드에서 Vercel 서버리스 함수(/api/chat)의 스트리밍 응답을 수신합니다.
 * 실시간으로 텍스트 조각(delta)이 도착할 때마다 onDelta 콜백이 호출됩니다.
 */
  export async function sendChatMessageStream(
    messages: ChatApiRequestMessage[],
    onDelta: (delta: string) => void,
  ): Promise<string> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error || `서버 오류가 발생했습니다. (상태 코드: ${response.status})`;
      throw new Error(errorMsg);
    }

    if (!response.body) {
      throw new Error('응답 스트림을 읽을 수 없습니다.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Server-Sent Events 구분 단위(\n\n)로 분리
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || ''; // 미완성 청크는 버퍼에 보관

      for (const part of parts) {
        const line = part.trim();
        if (!line || !line.startsWith('data:')) continue;

        const dataStr = line.replace(/^data:\s*/, '');
        if (dataStr === '[DONE]') {
          return accumulated;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.text) {
            accumulated += parsed.text;
            onDelta(parsed.text);
          }
        } catch (err) {
          if (err instanceof Error && err.message !== dataStr) {
            if (line.includes('"error"')) {
              throw err;
            }
          }
        }
      }
    }

    return accumulated;
  }

  /**
   * 비스트리밍 방식 호환용 함수
   */
  export async function sendChatMessage(messages: ChatApiRequestMessage[]): Promise<string> {
    let result = '';
    await sendChatMessageStream(messages, (delta) => {
      result += delta;
    });
    return result;
  }
