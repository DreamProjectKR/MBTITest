# API 레퍼런스

MBTI ZOO의 Cloudflare Pages Functions API 문서입니다.

Base URL: `https://dreamp.org` (프로덕션) / `http://localhost:8788` (로컬)

## Public API

### `GET /api/tests`

테스트 목록을 반환합니다.

**Response** `200`

```json
{
  "tests": [
    {
      "id": "test-summer",
      "title": "여름 바캉스 스타일 테스트",
      "thumbnail": "assets/test-summer/images/thumbnail.png",
      "tags": ["여름", "여행"],
      "path": "test-summer/test.json",
      "createdAt": "2025-12-08",
      "updatedAt": "2025-12-08"
    }
  ]
}
```

**캐싱**: `Cache-Control: public, max-age=60, s-maxage=300`

---

### `GET /api/tests/:id`

테스트 상세 정보를 반환합니다. D1 메타 + R2 본문을 병합합니다.

**Parameters**

| 이름 | 위치 | 설명                          |
| ---- | ---- | ----------------------------- |
| `id` | path | 테스트 ID (예: `test-summer`) |

**Response** `200`

```json
{
  "id": "test-summer",
  "title": "여름 바캉스 스타일 테스트",
  "description": ["첫 줄", "둘째 줄"],
  "author": "DREAM",
  "authorImg": "assets/test-summer/images/author.png",
  "thumbnail": "assets/test-summer/images/thumbnail.png",
  "tags": ["여름", "여행"],
  "path": "test-summer/test.json",
  "createdAt": "2025-12-08",
  "updatedAt": "2025-12-08",
  "questions": [
    {
      "id": "q1",
      "label": "질문 텍스트",
      "questionImage": "assets/test-summer/images/Q1.png",
      "answers": [
        {
          "id": "q1_a",
          "label": "선택지 A",
          "mbtiAxis": "EI",
          "direction": "E"
        },
        {
          "id": "q1_b",
          "label": "선택지 B",
          "mbtiAxis": "EI",
          "direction": "I"
        }
      ]
    }
  ],
  "results": {
    "ENFP": {
      "image": "assets/test-summer/images/ENFP.png",
      "summary": "결과 설명"
    }
  }
}
```

**캐싱**: KV (TTL 300s) → Cache API (ETag) → Edge (`s-maxage=300`)

**ETag 지원**: `If-None-Match` 헤더로 `304 Not Modified` 응답

---

### `POST /api/tests/:id/compute`

MBTI 결과를 서버에서 계산합니다.

**Parameters**

| 이름 | 위치 | 설명      |
| ---- | ---- | --------- |
| `id` | path | 테스트 ID |

**Request Body**

```json
{
  "answers": [
    { "mbtiAxis": "EI", "direction": "E" },
    { "mbtiAxis": "EI", "direction": "I" },
    { "mbtiAxis": "SN", "direction": "S" },
    { "mbtiAxis": "TF", "direction": "T" },
    { "mbtiAxis": "JP", "direction": "J" }
  ]
}
```

**Response** `200`

```json
{
  "testId": "test-summer",
  "mbti": "ESTJ",
  "scores": {
    "EI": { "E": 1, "I": 1 },
    "SN": { "S": 1, "N": 0 },
    "TF": { "T": 1, "F": 0 },
    "JP": { "J": 1, "P": 0 }
  },
  "percentages": {
    "E": 50,
    "I": 50,
    "S": 100,
    "N": 0,
    "T": 100,
    "F": 0,
    "J": 100,
    "P": 0
  }
}
```

**캐싱**: 없음 (`max-age=0`)

---

### `GET /assets/*`

R2 오브젝트를 same-origin으로 프록시합니다. CORS 문제를 방지합니다.

**캐싱**: 에셋 유형별 차등 (JSON 60초, 이미지 최대 1년)

**헤더**: `Cache-Tag`, `ETag`, `Cache-Control`

---

## Admin API

### `PUT /api/admin/tests/:id`

테스트를 저장합니다.

**Request Body**

```json
{
  "title": "테스트 제목",
  "description": ["줄1", "줄2"],
  "author": "작성자",
  "authorImg": "assets/test-xxx/images/author.png",
  "thumbnail": "assets/test-xxx/images/thumbnail.png",
  "tags": ["태그1", "태그2"],
  "questions": [
    /* 12개, 각 2지선다 */
  ],
  "results": {
    /* 16개 MBTI 유형 */
  }
}
```

**검증 규칙**

- `title` 필수
- `thumbnail`, `authorImg` 필수 (R2 경로, 외부 URL 불가)
- `questions` 정확히 12개
- 각 문항: 2개 답변, 같은 `mbtiAxis`, 양쪽 `direction` 포함
- `results` 정확히 16개 MBTI 유형, 각각 `image` + `summary` 필수

**Response** `200`

```json
{ "ok": true }
```

**사이드 이펙트**: KV 캐시 키 삭제

---

### `GET /api/admin/tests/:id/images`

테스트에 속한 이미지 목록을 반환합니다 (D1 `test_images` 테이블 기반).

**Response** `200`

```json
{
  "items": [
    {
      "id": 1,
      "key": "assets/test-summer/images/Q1.png",
      "path": "test-summer/images/Q1.png",
      "url": "/assets/test-summer/images/Q1.png",
      "imageType": "question",
      "imageName": "Q1",
      "contentType": "image/png",
      "size": 45231,
      "lastModified": "2025-12-08T10:30:00Z"
    }
  ]
}
```

---

### `PUT /api/admin/tests/:id/images`

이미지를 업로드합니다.

**Request**: `multipart/form-data`

| 필드   | 설명                                             |
| ------ | ------------------------------------------------ |
| `file` | 이미지 파일                                      |
| `name` | 파일 기본 이름 (예: `Q1`, `thumbnail`, `author`) |

**Response** `200`

```json
{
  "ok": true,
  "key": "assets/test-summer/images/Q1.png",
  "path": "assets/test-summer/images/Q1.png",
  "url": "/assets/test-summer/images/Q1.png"
}
```

**사이드 이펙트**: D1 `test_images`에 메타 upsert

---

### `PUT /api/admin/tests/:id/results/:mbti/image`

MBTI 결과 이미지를 업로드합니다.

**Parameters**

| 이름   | 위치 | 설명                   |
| ------ | ---- | ---------------------- |
| `id`   | path | 테스트 ID              |
| `mbti` | path | MBTI 코드 (예: `ENFP`) |

**Request**: `multipart/form-data` (필드: `file`)

**Response** `200`

```json
{
  "ok": true,
  "mbti": "ENFP",
  "path": "assets/test-summer/images/ENFP.png",
  "url": "/assets/test-summer/images/ENFP.png"
}
```

**사이드 이펙트**:

- R2에 이미지 저장
- R2의 `test.json`에 결과 이미지 경로 업데이트
- D1 `test_images`에 메타 upsert
- D1 `tests.updated_at` 갱신
- KV 캐시 키 삭제

## 에러 응답

모든 에러는 동일한 JSON 형식입니다:

```json
{ "error": "에러 메시지" }
```

| HTTP 상태 | 의미                                     |
| --------- | ---------------------------------------- |
| `400`     | 잘못된 요청 (검증 실패, 누락된 파라미터) |
| `404`     | 리소스를 찾을 수 없음                    |
| `405`     | 허용되지 않는 HTTP 메서드                |
| `500`     | 서버 내부 오류 (바인딩 누락 등)          |
