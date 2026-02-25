# Image API (Gemini)

동화 삽화 이미지는 Gemini API를 통해 생성됩니다. 서버는 이미지 URL을
`imageUrl`, 상태를 `imageStatus`, 에러 메시지를 `imageError`로 반환합니다.

## 설정

1) Gemini API 키 발급  
- https://aistudio.google.com/app/apikey

2) 환경 변수 추가 (`.env` 또는 `.env.local`)

```
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_IMAGE_MODEL=gemini-2.0-flash-exp-image-generation
IMAGE_TIMEOUT_MS=120000
```

## 모델 선택

- `gemini-2.0-flash-exp-image-generation` (텍스트+이미지 출력 지원)
- 필요 시 Gemini 이미지 모델을 교체해서 사용 가능합니다.

## 동기 모드 및 타임아웃

서버는 `IMAGE_TIMEOUT_MS` 를 기준으로 요청을 중단할 수 있습니다. 타임아웃이
발생하면 `imageError: "timeout"` 으로 처리됩니다.

## 출력 URL 처리

Gemini 응답의 `inlineData`(base64)를 `data:<mime>;base64,` 형태로 변환하여
`imageUrl` 로 반환합니다.

## 트러블슈팅

- `imageUrl` 이 `null`:
  - `GEMINI_API_KEY` 누락 또는 잘못된 키
  - `GEMINI_IMAGE_MODEL` 이 유효하지 않음
  - `imageError` 가 `timeout` 또는 `Missing image output`
- 429/할당 초과:
  - Gemini 계정 사용량을 확인하세요.

## 참고 문서

- Gemini API: https://ai.google.dev/gemini-api/docs
- 이미지 생성: https://ai.google.dev/gemini-api/docs/image-generation
