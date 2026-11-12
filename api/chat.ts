import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

/**
 * 영어 단어 퀴즈 챗봇 시스템 프롬프트
 * 프롬프트 수정이 필요할 경우 이 상수를 수정하면 됩니다.
 */
export const SYSTEM_PROMPT = `당신은 친절하고 실력 있는 '영어 단어 퀴즈 챗봇'입니다.
다음 규칙을 엄격히 준수하여 한국어로 간결하게 답변하세요:

1. 주제 및 난이도 확인:
- 사용자가 원하는 주제(예: 여행, 일상, 비즈니스, 토익 등)나 난이도(초급, 중급, 고급)를 입력하면 관련 영어 단어를 알려줍니다.
- 사용자가 주제나 난이도를 말하지 않은 경우(단순 인사나 모호한 입력 등), 학습하고 싶은 주제나 난이도가 무엇인지 먼저 친절하게 물어보세요.

2. 영어 단어 제공 규칙:
- 한 번에 최대 3개의 영어 단어만 알려주세요.
- 각 단어마다 다음 형식을 반드시 지켜 간결하게 작성하세요:
  - 단어 (품사) : 한국어 뜻
  - 예문: 영어 예문
  - 해석: 한국어 해석

3. 복습 퀴즈 규칙:
- 단어 소개가 끝나면, 마지막에 방금 소개한 단어 중 하나를 활용한 짧은 '복습 퀴즈'를 정확히 1개만 출제하세요. (예: 빈칸 채우기 또는 객관식/단답형)
- 사용자가 퀴즈 답을 입력하면, 정답 여부와 간단한 해설을 알려준 후 다음 학습을 안내하세요.

4. 어조:
- 답변은 장황하지 않게 한국어로 정중하고 간결하게 작성하세요.`;

interface IncomingChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 지원합니다.' });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(400).json({
      error: 'OPENAI_API_KEY 환경 변수가 설정되지 않았습니다. 루트 디렉터리의 .env.local 파일에 유효한 OpenAI API Key를 입력해주세요.',
    });
  }

  try {
    const { messages } = (req.body || {}) as { messages?: IncomingChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '전송할 메시지(messages) 배열이 필요합니다.' });
    }

    const openai = new OpenAI({ apiKey });

    // OpenAI Responses API의 input 규격에 맞게 변환
    const inputItems = messages.map((msg) => ({
      role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: msg.content,
    }));

    // OpenAI Responses API 호출 (gpt-6-luna 모델 및 reasoning.effort 'none' 설정)
    const response = await openai.responses.create({
      model: 'gpt-6-luna',
      reasoning: {
        effort: 'none',
      },
      instructions: SYSTEM_PROMPT,
      input: inputItems,
    });

    // Responses API 응답에서 텍스트 추출
    let replyText = response.output_text || '';

    // 만약 output_text가 비어 있다면 output 배열에서 메시지 텍스트 탐색
    if (!replyText && Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.type === 'output_text' && c.text) {
              replyText += c.text;
            }
          }
        }
      }
    }

    if (!replyText) {
      replyText = '답변을 생성하지 못했습니다. 다시 시도해주세요.';
    }

    return res.status(200).json({ reply: replyText });
  } catch (error: unknown) {
    console.error('OpenAI Responses API Error:', error);
    const errorMessage = error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.';
    return res.status(500).json({
      error: `OpenAI API 호출 중 오류가 발생했습니다: ${errorMessage}`,
    });
  }
}

