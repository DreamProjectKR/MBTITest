# ERD (D1 + R2 Storage Model)

이 프로젝트는 **D1(Database)** 에 메타데이터를, **R2(Object Storage)** 에 본문과 이미지를 저장합니다.

## D1 (Cloudflare D1)

### `tests` 테이블

테스트 메타데이터를 저장합니다. 목록/검색/정렬에 사용됩니다.

| column             | type      | key      | description                              |
| ------------------ | --------- | -------- | ---------------------------------------- |
| `test_id`          | `TEXT`    | PK       | 테스트 ID (예: `test-summer`)            |
| `title`            | `TEXT`    | NOT NULL | 테스트 제목                              |
| `description_json` | `TEXT`    |          | JSON 문자열 (배열 또는 문자열)           |
| `author`           | `TEXT`    |          | 제작자 이름                              |
| `author_img_path`  | `TEXT`    |          | 제작자 이미지 R2 경로                    |
| `thumbnail_path`   | `TEXT`    |          | 썸네일 이미지 R2 경로                    |
| `tags_json`        | `TEXT`    |          | JSON 배열 문자열 (예: `["여름","휴가"]`) |
| `source_path`      | `TEXT`    |          | R2의 본문 test.json 경로                 |
| `created_at`       | `TEXT`    |          | ISO 날짜 (YYYY-MM-DD)                    |
| `updated_at`       | `TEXT`    |          | ISO 날짜 (YYYY-MM-DD)                    |
| `question_count`   | `INTEGER` |          | 문항 수 (v2)                             |
| `is_published`     | `INTEGER` |          | 공개 여부 0/1 (v2)                       |
| `view_count`       | `INTEGER` |          | 조회 수 (v2)                             |
| `created_ts`       | `TEXT`    |          | 전체 ISO 타임스탬프 (v2)                 |
| `updated_ts`       | `TEXT`    |          | 전체 ISO 타임스탬프 (v2)                 |

#### 인덱스

| 인덱스                        | 컬럼                              | 용도           |
| ----------------------------- | --------------------------------- | -------------- |
| `idx_tests_updated_at_desc`   | `(updated_at DESC, test_id ASC)`  | 목록 정렬      |
| `idx_tests_title`             | `(title)`                         | 제목 검색      |
| `idx_tests_published_updated` | `(is_published, updated_at DESC)` | 공개 필터+정렬 |

### `test_images` 테이블

R2에 업로드된 이미지의 메타데이터를 D1에서 추적합니다. R2 `list()` 호출 비용을 줄이기 위해 도입되었습니다.

| column         | type      | key                | description                                    |
| -------------- | --------- | ------------------ | ---------------------------------------------- |
| `id`           | `INTEGER` | PK AUTOINCREMENT   | 자동 증가 ID                                   |
| `test_id`      | `TEXT`    | FK → tests.test_id | 소속 테스트                                    |
| `image_key`    | `TEXT`    | NOT NULL           | R2 키 (예: `assets/test-summer/images/Q1.png`) |
| `image_type`   | `TEXT`    | NOT NULL           | `question` / `result` / `thumbnail` / `author` |
| `image_name`   | `TEXT`    | NOT NULL           | 파일 기본 이름 (예: `Q1`, `ENFP`, `thumbnail`) |
| `content_type` | `TEXT`    |                    | MIME 타입 (예: `image/png`)                    |
| `size_bytes`   | `INTEGER` |                    | 파일 크기 (바이트)                             |
| `uploaded_at`  | `TEXT`    |                    | ISO 타임스탬프                                 |

- `UNIQUE(test_id, image_name)` -- 같은 테스트에서 같은 이름 중복 방지
- `FOREIGN KEY (test_id) REFERENCES tests(test_id) ON DELETE CASCADE`

## ERD 다이어그램

```text
┌────────────────────────────────────────────┐
│ tests                                       │
├────────────────────────────────────────────┤
│ PK  test_id             TEXT                │
│     title               TEXT   NOT NULL     │
│     description_json    TEXT                 │
│     author              TEXT                 │
│     author_img_path     TEXT                 │
│     thumbnail_path      TEXT                 │
│     tags_json           TEXT                 │
│     source_path         TEXT   ──────────────┼──► R2: assets/<source_path>
│     created_at          TEXT                 │
│     updated_at          TEXT                 │
│     question_count      INTEGER  DEFAULT 0   │
│     is_published        INTEGER  DEFAULT 0   │
│     view_count          INTEGER  DEFAULT 0   │
│     created_ts          TEXT                 │
│     updated_ts          TEXT                 │
└──────────────┬─────────────────────────────┘
               │ 1:N
               ▼
┌────────────────────────────────────────────┐
│ test_images                                 │
├────────────────────────────────────────────┤
│ PK  id                  INTEGER AUTO        │
│ FK  test_id             TEXT   ──────────────┼──► tests.test_id
│     image_key           TEXT   NOT NULL  ────┼──► R2: <image_key>
│     image_type          TEXT   NOT NULL      │
│     image_name          TEXT   NOT NULL      │
│     content_type        TEXT                 │
│     size_bytes          INTEGER              │
│     uploaded_at         TEXT                 │
│     UNIQUE(test_id, image_name)              │
└────────────────────────────────────────────┘
```

## R2 (Cloudflare R2)

### 저장 구조

```text
assets/
├── images/                        # 공용 UI 이미지
│   ├── mainLogo.png
│   ├── HeaderBackgroundImg.png
│   └── ...
├── test-summer/
│   ├── test.json                  # 테스트 본문 (questions + results)
│   └── images/
│       ├── thumbnail.png
│       ├── author.png
│       ├── Q1.png ... Q12.png     # 문항 이미지
│       └── ENFP.png ... ISTP.png  # 결과 이미지 (16개)
└── test-root-vegetables/
    ├── test.json
    └── images/
        └── ...
```

### 본문 스키마 (slim)

`test.json`에는 메타데이터 없이 문항과 결과만 저장합니다 (메타는 D1).

```json
{
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
      "summary": "설명 텍스트"
    }
  }
}
```

## API/Data Flow

| API                               | 데이터 소스           | 설명                                |
| --------------------------------- | --------------------- | ----------------------------------- |
| `GET /api/tests`                  | D1                    | 테스트 목록 반환                    |
| `GET /api/tests/:id`              | KV → D1 + R2          | 메타 + 본문 병합 반환 (KV 캐시)     |
| `POST /api/tests/:id/compute`     | D1 (존재 확인)        | MBTI 결과 계산                      |
| `PUT /api/admin/tests/:id`        | D1 + R2               | 메타 upsert + 본문 저장 + KV 무효화 |
| `PUT /api/admin/tests/:id/images` | R2 + D1 `test_images` | 이미지 업로드 + 메타 기록           |
| `GET /api/admin/tests/:id/images` | D1 `test_images`      | 이미지 목록 반환                    |
| `GET /assets/*`                   | R2                    | 에셋 프록시 (Cache-Tag, ETag)       |

## 마이그레이션 이력

| 파일                   | 내용                                |
| ---------------------- | ----------------------------------- |
| `0001_schema.sql`      | `tests` 테이블 생성                 |
| `0002_add_indexes.sql` | `idx_tests_updated_at_desc` 인덱스  |
| `0003_schema_v2.sql`   | v2 컬럼 추가 + `test_images` 테이블 |
