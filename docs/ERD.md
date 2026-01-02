# ERD (D1 + R2 Storage Model)

이 프로젝트는 **D1(Database)** 에 “테스트 메타(index)”를 저장하고, **R2(Object Storage)** 에 “테스트 본문(test.json)”을 저장합니다.

## D1 (Cloudflare D1)

### `tests` (테스트 메타)

- **목적**: 리스트/검색/정렬/미리보기 등 “인덱스 역할”을 하는 메타데이터 저장
- **본문 데이터(문항/결과 이미지/결과 문구 등)는 저장하지 않음**: 본문은 R2의 `test.json`에서 가져옵니다.

#### Columns

| column | type | key | description |
|---|---|---|---|
| `test_id` | `TEXT` | PK | 테스트 ID (예: `test-summer`) |
| `title` | `TEXT` |  | 테스트 제목 |
| `description_json` | `TEXT` |  | JSON 문자열. 배열/문자열 모두 허용 (예: `["...", "..."]`) |
| `author` | `TEXT` |  | 제작자 이름 |
| `author_img_path` | `TEXT` |  | 제작자 이미지 경로 (예: `assets/test-summer/images/author.png`) |
| `thumbnail_path` | `TEXT` |  | 썸네일 이미지 경로 (예: `assets/test-summer/images/thumbnail.png`) |
| `tags_json` | `TEXT` |  | JSON 문자열 배열 (예: `["여름","휴가"]`) |
| `source_path` | `TEXT` |  | R2에 있는 본문 test.json 경로 (예: `test-summer/test.json`) |
| `created_at` | `TEXT` |  | ISO 날짜 문자열 (예: `2025-12-08`) |
| `updated_at` | `TEXT` |  | ISO 날짜 문자열 (예: `2025-12-08`) |

#### ERD (D1 only)

```text
┌──────────────────────────────────────────────────────────────┐
│ tests                                                        │
├──────────────────────────────────────────────────────────────┤
│ PK  test_id              TEXT                                │
│     title                TEXT                                │
│     description_json      TEXT   (JSON string)                │
│     author               TEXT                                │
│     author_img_path       TEXT                                │
│     thumbnail_path        TEXT                                │
│     tags_json             TEXT   (JSON string array)          │
│     source_path           TEXT   (R2 key path)                │
│     created_at            TEXT   (YYYY-MM-DD)                 │
│     updated_at            TEXT   (YYYY-MM-DD)                 │
└──────────────────────────────────────────────────────────────┘
```

## R2 (Cloudflare R2)

### `assets/<test-id>/test.json` (테스트 본문)

R2에는 퀴즈 실행에 필요한 “본문”을 저장합니다.

- **저장 파일 예시**: `assets/test-summer/test.json`
- **현재 본문 스키마(슬림)**: `questions`, `results`만 유지 (메타는 D1로 이동)

#### Body schema (slim)

```json
{
  "questions": [
    {
      "id": "q1",
      "label": "질문 텍스트",
      "questionImage": "assets/test-summer/images/q1.png",
      "answers": [
        { "id": "q1_a", "label": "선택지", "mbtiAxis": "EI", "direction": "E" },
        { "id": "q1_b", "label": "선택지", "mbtiAxis": "EI", "direction": "I" }
      ]
    }
  ],
  "results": {
    "ENFP": { "image": "assets/test-summer/images/ENFP.png", "summary": "..." }
  }
}
```

## “D1 ↔ R2” 관계(논리적 관계)

R2는 관계형 DB가 아니므로 FK를 걸 수는 없지만, 프로젝트 관점에서는 아래처럼 “참조 관계”가 있습니다.

```text
D1.tests.source_path  ───────────────►  R2: assets/<source_path>
  (예: "test-summer/test.json")           (예: "assets/test-summer/test.json")
```

## API/Data Flow (요약)

- **`GET /api/tests`**
  - D1에서 `tests`를 조회하여 `{ tests: [...] }` 형태로 반환 (레거시 index.json shape 유지)
- **`GET /api/tests/:id`**
  - D1에서 메타(테이블 `tests`) 조회
  - R2에서 본문(`assets/<source_path>`) 조회
  - 응답에서 **meta + body를 merge**해서 클라이언트가 기존처럼 사용할 수 있게 반환
- **`PUT /api/admin/tests/:id`**
  - R2에는 본문(questions/results)만 저장
  - D1에는 메타를 upsert 저장

## Notes

- `tags_json`, `description_json`은 “JSON 문자열”입니다. (D1에서 파싱하여 배열로 사용)
- 본문 `test.json`은 R2에 있으므로, 대용량/빈번한 변경에도 D1 스키마가 과도하게 커지지 않습니다.
