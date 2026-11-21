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

2. 1단계: 영어 단어 3개 소개 (복습 퀴즈 출제 금지)
- 주제와 난이도가 정해지면 먼저 영어 단어 3개와 뜻, 예문, 해석만 보여주세요.
- 첫 응답에서는 절대로 복습 퀴즈를 바로 내지 마세요.
- 각 단어마다 다음 형식을 반드시 지켜 작성하세요:
  단어 (품사) : 한국어 뜻
  예문: 영어 예문
  해석: 한국어 해석
- 단어 3개 소개의 마지막 줄에는 반드시 아래 문장만 단독으로 정확하게 안내하세요:
준비되면 "퀴즈 시작"이라고 입력해 주세요.

3. 2단계: 복습 퀴즈 출제 ("퀴즈 시작" 입력 시)
- 사용자가 "퀴즈 시작"이라고 입력하면, 직전에 소개한 단어 중 하나의 예문을 활용해 복습 퀴즈를 1개만 출제하세요.
- 복습 퀴즈는 항상 "빈칸 채우기" 형식으로 통일하세요.
- 퀴즈에서는 정답 단어 부분을 [ _____ ] 형태로 빈칸 처리하세요.
- 퀴즈에서는 정답이 바로 드러나지 않도록 한국어 해석을 그대로 보여주지 말고, 정답을 직접 말하지 않는 짧은 한국어 힌트만 제공하세요.
- 퀴즈 출력 형식은 반드시 아래 형식을 그대로 지켜 출력하세요 (줄바꿈 포함):

복습 퀴즈
Q.다음 빈칸에 들어갈 알맞은 단어를 입력해보세요.
[정답 단어가 빈칸 처리된 영어 예문]
힌트: [정답을 직접 말하지 않는 짧은 한국어 힌트]
답을 입력해보세요.

4. 3단계: 정답 채점 및 피드백
  - 사용자가 퀴즈의 답을 입력하면, 정답 여부(정답 또는 오답)와 정답 단어, 전체 예문 해석을 짧게 설명해 주세요.
- 설명 후에는 다음 학습을 시작할 수 있도록 다른 주제나 난이도를 안내하세요.

5. 어조:
- 답변은 장황하지 않게 한국어로 정중하고 명확하게 작성하세요.`;

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

    const { messages } = (req.body || {}) as { messages?: IncomingChatMessage[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '전송할 메시지(messages) 배열이 필요합니다.' });
    }

    try {
      const openai = new OpenAI({ apiKey });

      // OpenAI Responses API의 input 규격에 맞게 변환
      const inputItems = messages.map((msg) => ({
        role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: msg.content,
      }));

        // OpenAI Responses API 스트리밍 호출 (gpt-6-luna 모델 및 reasoning.effort 'none' 설정)
        const stream = await openai.responses.create({
          model: 'gpt-6-luna',
          reasoning: {
            effort: 'none',
          },
          instructions: SYSTEM_PROMPT,
          input: inputItems,
          stream: true,
        });

        // Server-Sent Events (SSE) 스트리밍 응답 헤더 설정
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

            for await (const event of stream) {
              if (event.type === 'response.output_text.delta' && event.delta) {
                res.write(`data: ${ JSON.stringify({ text: event.delta }) } \n\n`);
              }
            }

            res.write('data: [DONE]\n\n');
            res.end();
          } catch (error: unknown) {
            console.error('OpenAI Responses API Error:', error);
            const errorMessage = error instanceof Error ? error.message : '서버 내부 오류가 발생했습니다.';

            if (res.headersSent) {
              res.write(`data: ${ JSON.stringify({ error: errorMessage }) } \n\n`);
              res.end();
            } else {
              return res.status(500).json({
                error: `OpenAI API 호출 중 오류가 발생했습니다: ${ errorMessage } `,
              });
            }
          }
    }
