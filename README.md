This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started (그림책 생성 데모)

### 1) 환경 변수 설정 (루트 `.env.local`)

```
# 스토리 생성(Groq)
GROQ_API_KEY=YOUR_GROQ_KEY
# 추천 모델(선택)
GROQ_RECOMMEND_MODEL=qwen/qwen3-32b

# 이미지 생성(OpenAI)
OPENAI_API_KEY=YOUR_OPENAI_KEY
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024
# 이미지 요청 타임아웃(ms) - OPENAI_IMAGE_TIMEOUT_MS 우선
OPENAI_IMAGE_TIMEOUT_MS=120000
IMAGE_TIMEOUT_MS=120000

# 공유(서버)
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

### 2) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 폼에 재료를 입력하고 그림책을 생성할 수 있습니다.
UI에서 "삽화 생성하기" 체크박스로 이미지 생성 여부를 제어할 수 있습니다.

### 3) 주요 파일
- `src/app/page.tsx`: 그림책 재료 입력 폼과 결과 표시 UI
- `src/app/api/generate/route.ts`: 그림책과 삽화 이미지를 생성하는 API 라우트

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
