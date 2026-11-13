# AGENTS.md

이 문서는 Dreamweaver-AI 저장소 전체에 적용합니다. 사용자 지시를 우선하며 아래 Hub 관리 구간과 함께 따릅니다.

## 프로젝트와 실행

- 주인공·친구·배경·교훈·그림 스타일을 입력해 어린이 그림책 본문과 선택적 삽화를 만들고 책 뷰어와 공유 링크로 읽는 Next.js App Router 앱입니다.
- package.json 기준 Next.js 15.5.12·React 19.1.0·TypeScript·Tailwind CSS 4·Zod·Supabase를 사용합니다. 현재 코드에는 Prisma가 없으므로 기존 포트폴리오 태그나 소개글만 보고 기술 스택을 단정하지 않습니다.
- package-lock.json과 README의 npm 명령을 기준으로 npm ci, npm run dev, npm run lint, npm run build, npm start를 사용합니다. 다른 패키지 매니저의 lockfile을 함께 만들지 않습니다.
- 별도 typecheck·test·E2E 스크립트와 테스트 프레임워크는 없습니다. 타입 확인은 설치된 TypeScript의 npx --no-install tsc --noEmit을 사용하며 실행하지 않은 테스트를 통과로 보고하지 않습니다.
- 기존 서버와 포트 사용을 확인하고 요청 없이 서버를 시작하거나 무관한 서버를 종료하지 않습니다. README·project-tech-overview.md보다 실제 코드·package.json을 우선합니다.

## 구조와 책임

- src/app/page.tsx는 입력·추천·생성 요청과 이벤트 해석, 글자 단위 표시, 페이지 상태와 공유 동작을 소유합니다. src/app/share/page.tsx는 공유 ID 조회와 재열람을 담당합니다.
- src/components/BookViewer.tsx의 BookPage가 표지·본문·뒷표지 계약입니다. 메인·공유 화면이 같은 뷰어를 사용하므로 타입·페이지 순서·넘김 애니메이션·경계 버튼 상태를 함께 확인합니다.
- src/app/api/generate/route.ts는 Zod 요청 검증, Groq 응답 수신·본문 정리, 선택적 OpenAI 삽화 생성과 SSE 전송을 담당하는 Node.js 서버 경로입니다.
- src/app/api/recommend/route.ts는 입력 추천과 필드별 정규화·길이 제한·대체 값을 담당합니다. 추천 후 생성은 메인 화면이 추천 결과를 입력에 반영한 뒤 같은 생성 경로를 호출합니다.
- src/app/api/share/[id]/route.ts는 Supabase의 storybook_shares 저장·조회, storybook-images 업로드·공개 URL 치환, 조회수 RPC와 대체 갱신을 담당합니다.
- src/lib/storyShare.ts의 SharedStoryBook·공유 ID 생성·로컬 읽기 함수를 재사용합니다. 현재 메인 공유 경로는 서버 저장 후 링크를 열며 localStorage에 공유본·마지막 ID를 기록하지 않습니다. 로컬 읽기 함수가 있다는 이유만으로 자동 로컬 저장이나 오프라인 재열람을 보장한다고 설명하지 않습니다.

## 생성·읽기 계약

- 모델 스트림을 바로 사용자 화면으로 중계하는 구조가 아닙니다. 서버가 모델 응답을 모아 JSON을 해석하고 제목·본문을 정리한 뒤 story_delta·story_done을 전송합니다. 브라우저의 글자 단위 표시와 모델의 토큰 스트림을 구분합니다.
- start·story_delta·story_done·image_start·image_progress·image_done·done·error 이벤트 이름과 payload를 유지합니다. 한 네트워크 조각에 이벤트가 여러 개 들어오거나 이벤트가 나뉘는 경우도 소비자와 함께 확인합니다.
- 한글 중심 정규화, 제목 길이 제한, JSON 보조 추출, 삽화의 선택 여부와 timeout을 확인합니다. 이미지 진행·완료·실패와 본문 표시 상태가 서로 덮이지 않도록 이벤트별 소유권을 확인합니다.
- 본문 페이지 분할과 제목 판정은 현재 메인·공유 화면 양쪽에 있습니다. 변경 시 두 소비자에서 같은 결과가 나오는지 대조하고 근거 없는 임의 fallback으로 성공을 표시하지 않습니다.
- 공유 읽기의 로컬 fallback은 해당 ID의 데이터가 이미 브라우저에 있을 때만 적용됩니다. 서버 장애나 저장 실패를 새 공유 링크 저장 성공으로 취급하지 않습니다.

## 환경 변수와 외부 서비스

- GROQ_API_KEY·GROQ_MODEL·GROQ_RECOMMEND_MODEL, OPENAI_API_KEY·OPENAI_IMAGE_MODEL·OPENAI_IMAGE_SIZE·OPENAI_IMAGE_TIMEOUT_MS·IMAGE_TIMEOUT_MS, SUPABASE_URL·SUPABASE_ANON_KEY·SUPABASE_SERVICE_ROLE_KEY는 현재 서버 소비 코드를 기준으로 확인합니다.
- API 키·서비스 역할 키·토큰·.env*·개인정보와 외부 오류 원문을 로그·문서·공개 자산에 넣지 않습니다. 서버 비밀값을 NEXT_PUBLIC_*나 브라우저 번들로 옮기지 않습니다.
- 코드의 기본 모델과 운영 환경의 모델 override를 구분합니다. 모델 지원 종료 여부는 제공자의 현재 계약으로 확인하며 모델 변경은 응답 구조·추천·생성·기존 환경 변수의 우선순위를 함께 검증합니다.
- 실제 생성·삽화 요청과 공유 저장은 외부 호출·과금·공개 데이터 저장을 수반합니다. 자동 검증에서는 대역을 사용하고 운영 생성·공개 공유·환경 변수·배포·공개 범위 변경은 사용자 요청 범위를 확인합니다.

## 변경과 검증

- @/ 경로 별칭과 기존 함수·컴포넌트·테마 변수를 재사용합니다. 브라우저 저장소·타이머·페이지 넘김은 클라이언트 경계에서 다룹니다.
- 실행 코드 변경 전 재현 조건과 검증 방법부터 정하고 입력 오류·정상 응답·스트림 분할·외부 실패·이미지 선택·공유 조회 경계를 확인합니다. 테스트 도구를 추가하면 package.json과 lockfile을 함께 관리합니다.
- 문서만 바꾸면 앱 테스트를 억지로 추가하지 않고 경로·실제 구현 근거·민감정보·링크·Hub 입력 계약을 검증합니다. 캡처 이미지는 실제 화면과 범위를 기록하고 모의 결과를 실제 생성 결과로 소개하지 않습니다.
- 작업 브랜치에서 요청 범위만 수정하고 사용자 요청 없이 커밋·푸시·PR·머지를 하지 않습니다. PROJECT.md 작성 시 기존 slug dreamweaver-ai를 유지하고 등록된 대표 이미지를 바꿀 의도가 없으면 image를 생략합니다.

<!-- portfolio-hub:project-guidance:start -->
## 포트폴리오 문서 입력 계약

- 기본 브랜치 루트 PROJECT.md를 프로젝트 소개의 원본으로 유지합니다. 프로젝트 초안 작업에서 이 저장소의 AI가 아래 규격으로 생성하고 내용 변경 시 함께 갱신합니다. Hub는 내용을 AI로 다시 생성하지 않고 검증한 필드를 그대로 전송합니다.
- PROJECT.md는 첫 번째 JSON 코드 블록에 아래 메타데이터를 작성하고, 블록 뒤 빈 줄 다음에 마크다운 본문을 작성합니다. 본문의 제목·목차·내용 구성은 자유입니다.

```json
{
  "schemaVersion": 1,
  "slug": "project-slug",
  "title": "프로젝트 제목",
  "description": "프로젝트 설명",
  "stacks": ["TypeScript"],
  "image": "https://example.com/public-project.png",
  "linkDemo": null,
  "linkGithub": null
}
```

- schemaVersion, slug, title, description, stacks는 필수입니다. slug는 기존 프로젝트 식별자로 유지하며 변경하면 다른 프로젝트가 생성될 수 있습니다. stacks는 문자열 배열입니다. JSON에 계약 밖 필드를 추가하지 않습니다.
- image는 선택적인 공개 HTTP(S) 이미지 URL입니다. URL이 제공된 경우에만 기존 이미지를 교체합니다. 생략/null/빈 문자열이면 기존 이미지를 유지하며, 신규 프로젝트는 이미지 없이 생성합니다. 로컬 파일 경로·비공개 GitHub 원본 URL·자격 증명이 필요한 URL을 넣지 않습니다.
- 대표 이미지 파일을 저장소에 보관할 때는 루트 PROJECT.png를 사용합니다. 적절한 배포 화면이 있으면 활용하고 없으면 이 저장소에서 생성형 썸네일을 준비합니다. 필요한 경우 갱신하며 일반 코드 변경마다 재생성하지 않습니다.
- 공개 이미지 업로드와 공개 URL 준비는 이 저장소가 담당합니다. Hub는 이미지 파일을 읽거나 업로드하지 않습니다. 도구를 사용할 수 없거나 URL을 제공하지 못하면 image를 생략할 수 있습니다.
- linkDemo와 linkGithub는 선택적인 HTTP(S) 링크이며 생략/null/빈 문자열이면 기존 링크 값을 지웁니다. JSON 뒤 마크다운 전체를 API의 content로 사용하므로 중복 생성하지 않습니다.
- 이 규격 문서가 있으면 Hub가 프로젝트를 생성·업데이트하며 즉시 공개하고 관리자 편집 내용도 교체합니다. 공개 가능한 소개만 작성하고 비밀값·내부 정보는 넣지 않습니다. 이 지침은 다른 비공개 파일을 공개할 권한을 부여하지 않습니다.
- 기존 프로젝트 규칙과 함께 적용하며 충돌은 담당자에게 확인합니다. Hub는 이 구간 밖의 기존 규칙과 원본 PROJECT.md를 변경하지 않습니다. 지침 PR은 담당자가 직접 머지합니다.
<!-- portfolio-hub:project-guidance:end -->
