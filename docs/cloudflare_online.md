# Cloudflare 온라인 설정 가이드 (무료 / 유료)

MBTI ZOO 프로젝트에서 사용하는 Cloudflare 서비스의 **무료(Free)** 와 **유료(Paid)** 플랜별 한도·설정·대시보드 옵션을 정리합니다.  
설정 시 [Cloudflare Dashboard](https://dash.cloudflare.com)와 [개발자 문서](https://developers.cloudflare.com)를 참고하세요.

---

## 1. Cloudflare Pages

| 항목                 | 무료 (Free)      | 유료 (Paid)           |
| -------------------- | ---------------- | --------------------- |
| **빌드**             | 월 500회         | 사용량 기반 추가 과금 |
| **빌드 타임아웃**    | 20분             | 동일 또는 확장 옵션   |
| **사이트당 파일 수** | 최대 20,000개    | 상동                  |
| **파일당 크기**      | 최대 25 MiB      | 상동                  |
| **커스텀 도메인**    | 프로젝트당 100개 | 상동                  |
| **동시 빌드**        | 제한 있음        | 더 높은 동시성        |

**권장 설정 (무료에서 가능)**

- **Rocket Loader**: OFF (Speed > Optimization). `type="module"`/`defer` 스크립트 사용 시 불필요.
- **Early Hints**: `_headers`의 `Link`로 preconnect/preload 설정 시 Pages가 103 Early Hints로 활용.

---

## 2. Workers / Pages Functions

| 항목             | 무료 (Workers Free) | 유료 (Workers Paid)         |
| ---------------- | ------------------- | --------------------------- |
| **요청 수**      | 일 100,000건        | 사용량 기반 ($0.30/백만 등) |
| **CPU 시간**     | 요청당 10ms         | 30ms 등 확장                |
| **서브리퀘스트** | 50회/요청           | 더 높은 한도                |

Pages Functions는 Workers와 동일한 런타임을 사용하므로 위 한도가 적용됩니다.

---

## 3. D1 (SQLite)

| 항목                   | 무료 (Free) | 유료 (Paid)                      |
| ---------------------- | ----------- | -------------------------------- |
| **일일 읽기**          | 5백만 행/일 | 제한 완화/무제한                 |
| **일일 쓰기**          | 10만 행/일  | 제한 완화/무제한                 |
| **DB당 최대 크기**     | 500 MB      | 500 MB (계정당 총 스토리지 확장) |
| **계정당 총 스토리지** | 5 GB        | 유료 플랜에 따라 증가            |
| **계정당 DB 수**       | 10개        | 증가                             |
| **호출당 쿼리 수**     | 50회        | 상동                             |
| **Time Travel**        | 7일         | 상동                             |

**권장**

- 인덱스는 마이그레이션으로 관리 (`npm run d1:migrate:local` / `d1:migrate:remote`).
- 목록/상세 조회는 기존처럼 단일 쿼리 또는 배치로 N+1 방지.

---

## 4. R2 (Object Storage)

| 항목                    | 무료 (Free)                 | 유료 (Paid)                      |
| ----------------------- | --------------------------- | -------------------------------- |
| **스토리지**            | 10 GB-month (Standard)      | 사용량 기반 ($0.015/GB-month 등) |
| **Class A (쓰기/목록)** | 월 100만 건                 | 이후 건당 과금                   |
| **Class B (읽기)**      | 월 1,000만 건               | 이후 건당 과금                   |
| **이그레스**            | **무료** (인터넷 전송 포함) | 무료 유지                        |

R2는 이그레스 비용이 없어 이미지/JSON 제공에 유리합니다.

---

## 5. Workers KV

| 항목          | 무료 (Free) | 유료 (Paid)                      |
| ------------- | ----------- | -------------------------------- |
| **일일 읽기** | 10만 건     | 사용량 기반 ($0.50/백만 읽기 등) |
| **일일 쓰기** | 1,000건     | $5/백만 쓰기 등                  |
| **일일 삭제** | 1,000건     | 포함                             |
| **일일 목록** | 1,000건     | 포함                             |
| **스토리지**  | 계정당 1 GB | GB당 $0.50/월 등                 |
| **값 크기**   | 최대 25 MiB | 상동                             |

**리셋**: 매일 00:00 UTC.

MBTI ZOO는 `GET /api/tests/:id` 응답을 KV에 300초 TTL로 캐싱하므로, 읽기 위주 트래픽에서 무료 한도 내 사용이 일반적입니다.

---

## 6. 이미지 최적화 (Image Resizing / Images)

| 항목                       | 무료 (Free)                         | 유료 (Paid)                      |
| -------------------------- | ----------------------------------- | -------------------------------- |
| **고유 변환**              | 월 5,000건 (Cloudflare 외부 저장소) | 5,000건 포함, 이후 $0.50/1,000건 |
| **초과 시**                | 새 변환 에러, 기존 캐시는 유지      | 과금 후 계속 제공                |
| **Cloudflare Images 저장** | —                                   | $5/10만 이미지/월                |
| **이미지 전달**            | —                                   | $1/10만 건/월                    |

**현재 사용**: `/cdn-cgi/image/`로 format=auto, width, quality 등 적용. R2 이미지를 외부 소스로 사용하므로 “고유 변환” 한도에 해당합니다.

---

## 7. 캐시 (Cache)

| 항목               | 무료 (Free)                           | 유료 (Paid)  |
| ------------------ | ------------------------------------- | ------------ |
| **Cache API**      | Workers/Pages 내 `caches.default`     | 동일         |
| **Tiered Cache**   | 모든 플랜에서 사용 가능               | 동일         |
| **Cache Rules**    | 대시보드에서 규칙 수 설정에 따라 제한 | 더 많은 규칙 |
| **Cache-Tag 퍼지** | API로 태그 퍼지 가능                  | 동일         |

**참고**: `cache.put()`는 단일 PoP에만 저장. Tiered Cache를 쓰려면 `fetch()` + `cf: { cacheTtl, cacheEverything: true }` 방식으로 전환하는 방법이 있습니다 (문서 참고).

---

## 8. 대시보드에서 할 수 있는 설정 (무료/유료 구분)

### 무료 플랜에서 권장 설정

- **Speed > Optimization**
  - **Rocket Loader**: Off
  - **Brotli**: On (기본)
- **Caching > Configuration**
  - **Caching Level**: Standard
  - **Browser Cache TTL**: Respect Existing Headers (코드에서 Cache-Control 설정)
- **Caching > Cache Rules** (선택)
  - `*domain/api/tests*` → Edge TTL 60초
  - `*domain/assets/*` → Edge TTL 1년
- **Rules > Page Rules** (무료는 3개 제한)
  - 필요 시 캐시/리다이렉트용으로만 사용

### 유료 플랜에서 추가 가능

- **Cache Rules**: 더 많은 규칙
- **Image Resizing**: 고유 변환 5,000건 초과 시 과금으로 계속 사용
- **Analytics**: 상세 요청/캐시 히트 분석
- **WAF / Rate limiting**: 보안·DDoS 완화
- **Workers Paid**: Functions 요청/D1 읽·쓰기 한도 완화

---

## 9. MBTI ZOO 적용 요약

| 구성 요소                   | 사용 서비스       | 무료 한도 내 사용 팁              |
| --------------------------- | ----------------- | --------------------------------- |
| 정적 사이트 + API           | Pages + Functions | 빌드 500회/월, 요청 10만/일 확인  |
| 테스트 메타/이미지 메타     | D1                | 일 500만 읽기, 10만 쓰기 내 유지  |
| 테스트 JSON/이미지 바이너리 | R2                | 10GB·월, Class B 1천만/월 내      |
| 테스트 상세 캐시            | KV                | 일 10만 읽기, 1천 쓰기/삭제 내    |
| 이미지 리사이징             | Image Resizing    | 월 5,000 고유 변환 내 (또는 유료) |

무료로 운영 시 위 한도를 모니터링하고, 트래픽이 커지면 Workers Paid + D1/R2/KV 사용량을 검토하면 됩니다.

---

## 10. 참고 링크

- [Pages 제한](https://developers.cloudflare.com/pages/platform/limits)
- [Workers 요금](https://workers.cloudflare.com/)
- [D1 제한·요금](https://developers.cloudflare.com/d1/platform/limits) / [요금](https://developers.cloudflare.com/d1/platform/pricing/)
- [R2 요금](https://developers.cloudflare.com/r2/pricing)
- [KV 제한·요금](https://developers.cloudflare.com/kv/platform/limits) / [요금](https://developers.cloudflare.com/kv/platform/pricing/)
- [Image Resizing / Images 요금](https://developers.cloudflare.com/images/pricing/)
