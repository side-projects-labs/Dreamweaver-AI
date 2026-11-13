# Dreamweaver-AI

AI로 어린이 그림책을 만드는 웹 애플리케이션입니다.  
사용자가 입력한 주인공/친구/배경/교훈/스타일을 바탕으로 스토리를 생성하고 선택적으로 삽화를 붙여 책 형태로 감상하고 공유할 수 있습니다.

## What it does

- AI 추천으로 입력값을 자동 채운 뒤 바로 그림책 생성
- 스토리 텍스트를 스트리밍으로 받아 타이핑처럼 렌더링
- 삽화 생성 옵션 선택 시 OpenAI 이미지 생성 연동
- 책 UI(표지/본문/뒷표지)와 페이지 넘김 애니메이션 제공
- 공유 링크 생성 및 공유 페이지 재열람
- Supabase 기반 공유 데이터 저장, 이미지 업로드, 조회수 카운트

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, CSS variables theme
- **Validation:** Zod
- **AI APIs:** Groq (story/recommend), OpenAI Images (illustration)
- **Data/Storage:** Supabase (table + storage + RPC)

## Project Structure

- `src/app/page.tsx`: 메인 생성 화면 (폼, 추천/생성, 공유)
- `src/app/share/page.tsx`: 공유 그림책 뷰어 화면
- `src/app/api/generate/route.ts`: 스토리/삽화 생성 API (SSE)
- `src/app/api/recommend/route.ts`: 입력값 추천 API
- `src/app/api/share/[id]/route.ts`: 공유 저장/조회 API
- `src/components/BookViewer.tsx`: 책 UI 및 페이지 플립 애니메이션
- `src/lib/storyShare.ts`: 공유 ID 생성 및 로컬 fallback 유틸

## API Endpoints

- `POST /api/generate` - 스토리 및 삽화 생성 (event-stream)
- `POST /api/recommend` - 그림책 입력값 추천
- `POST /api/share/[id]` - 공유 데이터 저장
- `GET /api/share/[id]` - 공유 데이터 조회 + 조회수 증가

## Getting Started

### 1) Install

```bash
npm install
```

### 2) Environment Variables (`.env.local`)

```bash
# Groq
GROQ_API_KEY=YOUR_GROQ_KEY
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_RECOMMEND_MODEL=qwen/qwen3-32b

# OpenAI Images
OPENAI_API_KEY=YOUR_OPENAI_KEY
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_TIMEOUT_MS=120000
IMAGE_TIMEOUT_MS=120000

# Supabase
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

### 3) Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start.

## Scripts

- `npm run dev`: 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 프로덕션 서버 실행
- `npm run lint`: 린트 실행

## Notes

- 본 프로젝트는 한국어 동화 생성 경험에 맞춰 입력/출력 정규화 로직을 포함합니다.
- 공유 데이터 저장을 사용하려면 Supabase 테이블/버킷/RPC 설정이 필요합니다.
