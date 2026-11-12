import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import handler from './api/chat.ts';

function localApiChatPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'local-api-chat-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req: IncomingMessage, res: ServerResponse) => {
        // 환경 변수 주입
        if (env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
          process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
        }

        // 요청 본문(body) 버퍼링 및 파싱
        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });

        req.on('end', async () => {
          let parsedBody: unknown = {};
          if (bodyStr) {
            try {
              parsedBody = JSON.parse(bodyStr);
            } catch {
              parsedBody = {};
            }
          }

          // VercelRequest 형태로 확장
          const vercelReq = Object.assign(req, {
            body: parsedBody,
            query: {},
            cookies: {},
          });

          // VercelResponse 형태로 확장
          const vercelRes = Object.assign(res, {
            status(code: number) {
              res.statusCode = code;
              return vercelRes;
            },
            json(jsonBody: unknown) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify(jsonBody));
              return vercelRes;
            },
            send(data: unknown) {
              res.end(typeof data === 'string' ? data : JSON.stringify(data));
              return vercelRes;
            },
          });

          try {
            await handler(vercelReq as never, vercelRes as never);
          } catch (err) {
            console.error('Local /api/chat error:', err);
            if (!res.writableEnded) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: '로컬 서버 함수 실행 중 오류가 발생했습니다.' }));
            }
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
  }

  return {
    plugins: [react(), localApiChatPlugin(env)],
  };
});
