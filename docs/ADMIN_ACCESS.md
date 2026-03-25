# Admin 접근 통제 (앱 회원가입 없이)

MBTI ZOO의 `admin.html`과 `GET/PUT /api/admin/*`는 **애플리케이션 로그인/회원가입 없이** 운영자만 쓰게 하려면 **엣지(Cloudflare)에서 인증**하는 방식이 맞습니다.

## 1. 검색·크롤 노출 최소화 (코드)

- [public/admin.html](../public/admin.html): `noindex,nofollow` 메타.
- [public/robots.txt](../public/robots.txt): `Disallow: /admin.html`.

이것만으로는 **URL을 아는 사람의 접근**을 막지 못합니다. 아래 Zero Trust와 함께 쓰세요.

## 2. Cloudflare Access (Zero Trust) — 권장

앱에 로그인 UI를 만들지 않고, **브라우저가 Cloudflare 로그인 페이지**로 리다이렉트됩니다.

1. Cloudflare Zero Trust 대시보드에서 **Access** > **Applications** > **Add an application** > **Self-hosted**.
2. **Application domain**: 예) `dreamp.org`
3. **Path**: 보호할 경로를 지정합니다.
   - `dreamp.org/admin.html` (정적 관리 UI)
   - `dreamp.org/api/admin*` 또는 `/api/admin/*` 패턴이 지원되면 Admin API 전체  
     (Worker 라우트가 `dreamp.org/api/*`로 붙어 있다면 동일 호스트에 정책 적용)
4. **Policy**: 허용 규칙 예시
   - **Emails**: 허용할 개인 이메일 나열
   - 또는 **Email domain**: `@yourcompany.com`만
   - 또는 **GitHub / Google** OAuth 후 위 조건으로 필터

**일회용 이메일 OTP(One-time PIN)** 는 “회원가입”이 아니라 IdP가 보내는 코드로 로그인하는 방식이라, 소수 인원에게만 적합합니다.

## 3. 보조 수단

| 수단             | 용도                                                                |
| ---------------- | ------------------------------------------------------------------- |
| **IP allowlist** | 사무실/VPN 고정 IP만 (WAF 또는 Access 정책)                         |
| **난독화 URL**   | 추측하기 어려운 경로 — **단독으로는 취약**, Access와 병행 시 편의용 |

## 4. Worker Bearer 토큰 (선택, 코드)

인프라와 별도로 `Authorization: Bearer <secret>` 검증을 Worker에 넣으면 **API**는 이중으로 막을 수 있습니다. 이 저장소의 기본 계획에는 포함하지 않았으며, 시크릿은 `wrangler secret`으로만 보관하세요.

## 5. 배포 시 확인

- 프로덕션에서 `https://dreamp.org/admin.html` 이 Access 뒤에 있는지
- `https://dreamp.org/api/admin/tests` 가 동일 정책으로 보호되는지 (관리 UI가 API를 호출하므로 **둘 다** 막는 것이 안전)
