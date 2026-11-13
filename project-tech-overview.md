# Dreamweaver-AI 프로젝트 개요

## 프로젝트 소개

Dreamweaver-AI는 어린이 그림책 스토리를 생성하는 웹 애플리케이션입니다. AI가 사용자가 입력한 키워드(주인공, 친구, 배경, 교훈, 그림 스타일)를 바탕으로 스토리를 생성하고 선택적으로 삽화를 생성해 책 형태로 보여줍니다.

생성된 결과는 공유 링크로 저장하고 다시 열람할 수 있으며 마지막 공유본은 로컬 스토리지 fallback으로도 확인할 수 있습니다.

## 기술 스택

### Frontend

- `Next.js 15` (App Router)
- `React 19`
- `TypeScript`
- `Tailwind CSS v4` + `globals.css` 커스텀 테마 변수

### Backend/API (Next.js Route Handlers)

- `zod` 기반 요청/응답 검증
- `ReadableStream + SSE` 방식의 스트리밍 응답
- 외부 AI API 연동
  - 스토리 생성/추천: `Groq API`
  - 이미지 생성: `OpenAI Images API`

### Data/Storage

- `Supabase`
  - 공유 스토리 메타/본문 저장 (`storybook_shares`)
  - 삽화 업로드 및 공개 URL 제공 (`storybook-images` storage bucket)
  - 조회수 증가 RPC 사용 (`increment_share_view_count`)

## 핵심 기능

### 1) AI 그림책 생성

- 입력값: 주인공, 친구, 배경, 교훈, 스타일, 삽화 생성 여부
- `/api/generate`에서 스토리 생성 후 SSE로 텍스트를 점진 전송
- 클라이언트는 `story_delta` 이벤트를 받아 타이핑 애니메이션처럼 렌더링
- 삽화 옵션 활성화 시 스토리 생성 후 이미지 생성 단계 진행

### 2) 추천 후 즉시 생성 플로우

- `/api/recommend`에서 AI가 입력 필드를 추천
- 추천값을 폼에 반영한 뒤 바로 생성 API를 호출해 원클릭 생성 UX 제공
- 비정상 응답 대비 fallback 값 내장

### 3) 책 형태 뷰어 UX

- `BookViewer` 컴포넌트에서 표지/본문/뒷표지 구조로 렌더링
- 페이지 넘김 애니메이션(앞/뒤 방향) 제공
- 본문을 문단 단위로 분리하고 페이지 길이에 맞춰 자동 페이징

### 4) 공유/재열람

- 공유 시 해시 기반 ID 생성 후 `/api/share/[id]`에 저장
- 이미지가 data URL이면 Supabase Storage에 업로드 후 공개 URL로 치환
- `/share?id=...`에서 공유본 조회, 조회수 증가 처리
- 서버 조회 실패 시 localStorage fallback으로 복구 시도

### 5) 안정성 및 품질 보강

- 한글 중심 입력/출력 정규화 및 길이 제한
- JSON 파싱 실패 시 보조 추출/복구 로직 제공
- API 키 누락, 외부 API 실패, 이미지 생성 실패 등 예외 처리

## 주요 API 엔드포인트

- `POST /api/generate`: 스토리/삽화 생성 (SSE)
- `POST /api/recommend`: 입력 추천값 생성
- `POST /api/share/[id]`: 공유 데이터 저장
- `GET /api/share/[id]`: 공유 데이터 조회 및 view count 증가

## 실행 스크립트

- `pnpm run dev` : 개발 서버 실행
- `pnpm run build`: 프로덕션 빌드
- `pnpm run start`: 프로덕션 서버 실행
- `pnpm run lint`: 린트 실행

## 환경 변수(요약)

실행 시 아래 계열 변수가 필요합니다.

- Groq: `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_RECOMMEND_MODEL`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_SIZE`, `OPENAI_IMAGE_TIMEOUT_MS`
- Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

프로젝트 운영 환경에 따라 일부 변수는 선택적으로 사용됩니다.
