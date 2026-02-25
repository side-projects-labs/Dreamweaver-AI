This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started (동화 생성 데모)

### 1) 환경 변수 설정 (루트 `.env.local`)

```
# 텍스트/이미지 제공자: Gemini
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_TEXT_MODEL=gemini-2.5-flash
# 이미지 생성 모델 (예: gemini-2.0-flash-exp-image-generation)
GEMINI_IMAGE_MODEL=gemini-2.0-flash-exp-image-generation
# 이미지 요청 타임아웃(ms)
IMAGE_TIMEOUT_MS=120000

# 전역 이미지 온오프
ENABLE_IMAGE=true
```

### 2) 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 폼에 재료를 입력하고 동화를 생성할 수 있습니다.
UI에서 "삽화 생성하기" 체크박스로 이미지 생성 여부를 제어할 수 있습니다.

### 3) 주요 파일
- `src/app/page.tsx`: 동화 재료 입력 폼과 결과 표시 UI
- `src/app/api/generate/route.ts`: 동화와 삽화 이미지를 생성하는 API 라우트

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
