# Đường đi trong backend của từng chức năng

Tài liệu này lần theo **từng route của backend**: yêu cầu vào ở đâu, lần lượt đi qua thư mục, file, class, object, hàm nào, chạm bảng nào trong database và **cuối cùng trả về gì**.
Các tài liệu `*-flow.md` khác giải thích *vì sao* (quy tắc nghiệp vụ). File này chỉ ra *ở đâu* (vị trí trong mã). Đường đi từ trình duyệt qua frontend tới backend xem [request-flow.md](request-flow.md); bảng tham số và mã lỗi của từng route xem [api.md](api.md).

Mọi đường dẫn file dưới đây tính từ `backend/src/` (ví dụ `handlers/auth.ts` là [backend/src/handlers/auth.ts](../backend/src/handlers/auth.ts)), trừ khi ghi rõ `@fm/shared/…` ([shared/src/](../shared/src/)) hoặc `@fm/database` ([database/src/](../database/src/)).

## Cách đọc

```text
file.ts › hàm()            gọi hàm (hoặc phương thức, class) trong file đó
  ⤷ DB bảng: thao tác       truy vấn Prisma tới bảng PostgreSQL (object `prisma` của @fm/database)
  ✗ điều kiện → kết quả     nhánh dừng sớm và thứ được trả về
  ⇒                         giá trị hàm trả lên tầng trên
```

`prisma` là **object** `PrismaClient` duy nhất, tạo ở [database/src/client.ts](../database/src/client.ts) (adapter `PrismaPg`, đọc `DATABASE_URL`) và xuất qua [database/src/index.ts](../database/src/index.ts). Mỗi `prisma.<model>` ứng với một bảng: `user` → `users`, `refreshToken` → `refresh_tokens`, `account` → `accounts`, `category` → `categories`, `transaction` → `transactions`, `budget` → `budgets`, `savingsGoal` → `savings_goals`, `savingsContribution` → `savings_contributions`, `exchangeRate` → `exchange_rates`, `importBatch` → `import_batches`, `rateLimit` → `rate_limits`.

## Mục lục

1. [Khởi động máy chủ](#1-khởi-động-máy-chủ)
2. [Khung chung của mọi yêu cầu](#2-khung-chung-của-mọi-yêu-cầu)
3. [Các khối dùng chung](#3-các-khối-dùng-chung)
4. [Phiên đăng nhập](#4-phiên-đăng-nhập)
5. [Tổng quan và cài đặt](#5-tổng-quan-và-cài-đặt)
6. [Ví / tài khoản](#6-ví--tài-khoản)
7. [Danh mục](#7-danh-mục)
8. [Giao dịch và chuyển khoản](#8-giao-dịch-và-chuyển-khoản)
9. [Ngân sách](#9-ngân-sách)
10. [Mục tiêu tiết kiệm](#10-mục-tiêu-tiết-kiệm)
11. [Sao kê PDF](#11-sao-kê-pdf)
12. [Nhập sao kê](#12-nhập-sao-kê)
13. [Quản trị](#13-quản-trị)
14. [Chatbot AI](#14-chatbot-ai)
15. [Việc chạy nền](#15-việc-chạy-nền)

---

## 1. Khởi động máy chủ

Chạy một lần khi `npm run dev` hoặc `npm start` khởi động backend.

```text
server.ts                                         điểm vào của tiến trình
├─ import "./env"  → env.ts                       nạp .env ở gốc dự án (process.loadEnvFile) trước mọi module khác
├─ app.ts › createApp()                           tạo ứng dụng Express
│   ├─ app.disable("x-powered-by")
│   ├─ express.json({ limit: "1mb" })             body JSON → req.body
│   ├─ express.raw({ type: "application/octet-stream", limit: "6mb" })   file tải lên → req.body (Buffer)
│   ├─ middleware ngữ cảnh (hàm async trong createApp)          xem mục 2, bước ②
│   ├─ app.use("/api", routes.ts › apiRoutes())   gắn mọi route dưới /api
│   ├─ middleware 404: next(new HttpError(404, "Not found"))     http/errors.ts › class HttpError
│   └─ app.ts › handleError                       ErrorRequestHandler (4 tham số)
├─ .listen(PORT ?? 4000, HOST ?? "127.0.0.1")
└─ maintenance.ts › startMaintenance()            việc chạy nền, xem mục 15
```

## 2. Khung chung của mọi yêu cầu

Mọi route bên dưới đều đi qua đúng các bước này. Các mục sau chỉ mô tả phần riêng (bước ④).

```text
Yêu cầu HTTP từ frontend (frontend/lib/api/client.ts, phía server của Next.js)
│
① express.json / express.raw                       đọc body
│
② app.ts › middleware ngữ cảnh
│   ├─ req.get("x-locale")                         LOCALE_HEADER, @fm/shared/wire
│   ├─ app.ts › bearerToken(req)                   "Authorization: Bearer <jwt>" → chuỗi JWT | null
│   ├─ auth/current-user.ts › loadUser(token)      (chỉ khi có token)
│   │   ├─ auth/tokens.ts › verifyAccessToken()
│   │   │   ├─ getSecretKey()                      AUTH_SECRET (≥ 32 ký tự)
│   │   │   ├─ jose › jwtVerify()                  HS256, issuer/audience "financial-management"
│   │   │   └─ claimsSchema.safeParse()            Zod: sub, role, sid
│   │   │   ⇒ { userId, role, sessionId } | null
│   │   └─ ⤷ DB users: findFirst                   id, status ACTIVE, có refresh_tokens cùng sessionId chưa thu hồi, chưa hết hạn
│   │   ⇒ { user: { id, email, name, role, defaultCurrency, locale }, sessionId } | null
│   ├─ @fm/shared/i18n/config › isLocale()         sai hoặc thiếu → DEFAULT_LOCALE ("vi")
│   └─ http/context.ts › runWithContext(context, next)
│       context = { user, sessionId, locale, clientIp (x-client-ip), refreshToken (x-refresh-token), effects: {} }
│       lưu trong AsyncLocalStorage: mọi hàm phía dưới đọc lại bằng requestContext()
│
③ routes.ts › apiRoutes()                          Router chọn route theo method + đường dẫn
│
④ một trong ba kiểu route
│
│  ④a VIEW (đọc) — http/routing.ts › view(router, path, loader)
│      ├─ loader(req)                              gọi hàm …View() trong views/
│      ├─ ✗ kết quả null | undefined → throw HttpError(404, "Not found")
│      └─ res.json(http/wire.ts › encode(data))
│      ⇒ 200 + JSON dữ liệu của trang
│
│  ④b COMMAND (ghi) — http/routing.ts › command(router, method, path, handler)
│      ├─ toFormData(req.body, req.params)         { fields: [[tên, giá trị], …] } + tham số :id → FormData
│      ├─ handler(form, req)                       gọi hàm trong handlers/
│      ├─ result.state = encode(giá trị trả về)    FormState: { success?, message?, errors?, values? } | undefined
│      ├─ bắt http/respond.ts › class RedirectSignal → result.redirect = đường dẫn
│      └─ res.json({ ...result, ...requestContext().effects })
│      ⇒ 200 + { state?, redirect?, tokens?, locale? }   (lỗi nhập liệu cũng là 200, nằm trong state)
│
│  ④c ROUTE VIẾT TAY — router.get/post trực tiếp trong routes.ts
│      /health, /auth/refresh, /reports/statement, /imports/template, /chat
│
⑤ Lỗi ném ra ở bất kỳ đâu → app.ts › handleError
    ├─ HttpError                    → status của nó, { message }
    ├─ lỗi Express (status < 500)   → status đó, { message: "Bad request" }   (JSON hỏng, body quá lớn)
    └─ còn lại                      → console.error, 500 { message: "Internal error" }
```

`encode()` ([http/wire.ts](../backend/src/http/wire.ts)) đi đệ quy qua giá trị: `Date` thành `{ "$date": "ISO" }`, `Prisma.Decimal` thành `{ "$decimal": "123.45" }`. Frontend giải mã lại bằng `decode` trong `frontend/lib/api/wire.ts`.

## 3. Các khối dùng chung

Các cây ở mục 4–15 chỉ ghi tên những hàm này, không mở rộng lại.

| Hàm / class | File | Làm gì | Khi thất bại |
| --- | --- | --- | --- |
| `requireUser()` | `auth/current-user.ts` | Lấy `context.user` | `throw HttpError(401, "Not signed in")` |
| `requireAdmin()` | `auth/current-user.ts` | `requireUser()` rồi kiểm tra `role === "ADMIN"` | `throw HttpError(404, "Not found")` (giấu sự tồn tại của trang admin) |
| `getCurrentUser()` | `auth/current-user.ts` | `context.user` hoặc `null`, không ném lỗi | |
| `currentSessionId()` | `auth/current-user.ts` | `context.sessionId` | |
| `getI18n()` / `getLanguage()` | `i18n.ts` | `{ t, locale, language }` theo `context.locale`; `t` từ `@fm/shared/i18n/translate › createTranslator` | |
| `redirect(path)` | `http/respond.ts` | `throw new RedirectSignal(path)`; `command()` đổi thành `{ redirect }` | |
| `setSessionTokens(tokens)` | `http/respond.ts` | Ghi `context.effects.tokens` (`null` = đăng xuất) | |
| `setLocale(locale)` | `http/respond.ts` | Ghi `context.effects.locale` | |
| `formText(form, key)` | `@fm/shared/form-state` | Giá trị chuỗi của trường, thiếu thì `""` | |
| `idSchema` | `validations/common.ts` | `z.uuid()` | `safeParse` thất bại → coi như "không tìm thấy" |
| `dateText` | `validations/common.ts` | `dd/mm/yyyy` hoặc `YYYY-MM-DD` → `YYYY-MM-DD` (`@fm/shared/dates › parseDateText`) | |
| `hit(key, window, amount?)` | `rate-limit.ts` | `INSERT … ON CONFLICT DO UPDATE` vào `rate_limits`, trả tổng mới | |
| `used(key, window)` | `rate-limit.ts` | Đọc bộ đếm hiện tại (`prisma.rateLimit.findUnique`) | |
| `refreshRates(options?)` | `exchange.ts` | Lấy tỷ giá mới nếu đã cũ (6 giờ; bấm tay: 10 phút). Chi tiết bên dưới | Không bao giờ ném lỗi, trả `"failed"` |
| `exchangeRate(db, from, to, date)` | `exchange.ts` | `usdRate(to) / usdRate(from)`; `usdRate` là `$queryRaw` tỷ giá gần ngày nhất trong `exchange_rates` | Thiếu tỷ giá → `null` |
| `convertToDefaultCurrency(db, amount, currency, default, date)` | `exchange.ts` | `exchangeRate()` rồi nhân, làm tròn 2 số | Thiếu tỷ giá → `{ amountInDefaultCurrency: null, exchangeRateUsed: null }` |
| `convertBalances(balances, target)` | `exchange.ts` | Cộng số dư nhiều loại tiền về một loại | ⇒ `{ total, missing: [mã tiền thiếu tỷ giá] }` |
| `recomputeConversions(db, { userId?, onlyMissing })` | `exchange.ts` | Một câu `UPDATE "transactions" … FROM (…)` tính lại `amountInDefaultCurrency`, `exchangeRateUsed` | |
| `getTransactionOptions(userId)` | `data/transaction-options.ts` | `accounts.findMany` + `categories.findMany` (của mình và hệ thống), dựng nhãn "Cha › Con" | ⇒ `{ accounts, categoryOptions }` |
| `sameName(name, exceptId?)` | `data/names.ts` | Phần `where` tìm bản ghi khác **trùng tên** (không phân biệt hoa thường, trừ bản ghi đang sửa); các hàm `isNameTaken` của ví, mục tiêu tiết kiệm, danh mục, danh mục hệ thống ghép nó với điều kiện riêng | |
| `getMonthReport(userId, month)` | `data/reports.ts` | `transactions.groupBy` theo loại và danh mục, đếm giao dịch chưa quy đổi, `categories.findMany`, `accounts.groupBy` theo tiền tệ | ⇒ `{ income, expense, net, expenseByCategory (≤ 7 cột + "Khác"), unconvertedCount, balances }` |
| `getMonthlyTrend(userId, endMonth, months)` | `data/reports.ts` | `$queryRaw` gom theo `to_char(date,'YYYY-MM')`, lấp tháng trống bằng 0 | ⇒ `[{ month, income, expense }]` |
| `getBudgetStatuses(userId, month)` | `data/budgets.ts` | `budgets.findMany`, `transactions.groupBy` chi theo danh mục, đếm chưa quy đổi, danh mục con; ngân sách của danh mục cha tính cả con | ⇒ `{ statuses: [{ id, categoryId, name, icon, color, currency, limit, spent, percent, state: ok/near/over }], unconvertedCount }` |

Bên trong `refreshRates()`:

```text
exchange.ts › refreshRates({ manual? })            gộp các lời gọi đồng thời vào một (biến inFlight)
└─ doRefresh(minIntervalMs)
    ├─ getRatesStatus()                            ⤷ DB exchange_rates: findFirst bản tự động mới nhất
    ├─ ✗ còn mới → "fresh"
    ├─ fetch("https://open.er-api.com/v6/latest/USD", timeout 5 giây)
    ├─ responseSchema.parse()                      Zod
    ├─ ✗ mạng lỗi / sai định dạng → "failed"
    └─ prisma.$transaction
        ├─ ⤷ DB exchange_rates: findMany tỷ giá nhập tay trong ngày (giữ nguyên)
        ├─ ⤷ DB exchange_rates: upsert từng loại tiền
        └─ recomputeConversions(tx, { onlyMissing: true })   điền giao dịch trước đây thiếu tỷ giá
    ⇒ "updated"
```

---

## 4. Phiên đăng nhập

Tài liệu nghiệp vụ: [auth-flow.md](auth-flow.md), [security-flow.md](security-flow.md).

### `POST /api/auth/register`: đăng ký

```text
routes.ts › command("post", "/auth/register", (form) => auth.register(undefined, form))
└─ handlers/auth.ts › register(_prev, formData)
    ├─ formText() × 4                                     name, email, password, confirmPassword
    ├─ validations/auth.ts › registerSchema.safeParse()   ✗ → { errors, values }
    ├─ auth/throttle.ts › refuseRegistration()
    │   └─ rate-limit.ts › hit("register:ip:<ip>", 1 giờ) > REGISTER_LIMIT_PER_IP (10)   ✗ → { message, values }
    ├─ auth/password.ts › hashPassword(password)
    │   └─ derive() → acquireSlot() (tối đa 4 chạy, 32 chờ) → crypto.scrypt (N=2^15)
    │       ✗ class PasswordCheckBusyError → { message: PASSWORD_CHECK_BUSY_MESSAGE, values }
    ├─ i18n.ts › getLanguage()                            ngôn ngữ đang dùng thành ngôn ngữ của tài khoản
    ├─ ⤷ DB users: create                                 ✗ Prisma P2002 (email trùng) → { errors: { email } }
    ├─ auth/session.ts › issueTokens(user)                (sessionId mới = randomUUID)
    │   ├─ auth/tokens.ts › generateRefreshToken()        32 byte ngẫu nhiên, base64url
    │   ├─ ⤷ DB refresh_tokens: create                    lưu hashRefreshToken() (sha256), hạn REFRESH_TOKEN_TTL_SECONDS
    │   └─ auth/tokens.ts › signAccessToken()             jose SignJWT HS256, hạn ACCESS_TOKEN_TTL_SECONDS
    ├─ http/respond.ts › setSessionTokens(tokens)
    └─ http/respond.ts › redirect("/dashboard")
```

**Trả về:** `200 { redirect: "/dashboard", tokens: { accessToken, refreshToken } }`. Bị từ chối: `200 { state: { errors | message, values } }`.

### `POST /api/auth/login`: đăng nhập

```text
routes.ts › command("post", "/auth/login", …) → handlers/auth.ts › login(_prev, formData)
├─ validations/auth.ts › loginSchema.safeParse()          ✗ → { errors, values }
├─ auth/throttle.ts › refuseLogin(email)                  chạy trước khi băm mật khẩu
│   ├─ rate-limit.ts › hit("login:ip:<ip>", 15 phút) > AUTH_LIMIT_PER_IP (30)       ✗ → { message, values }
│   └─ rate-limit.ts › used("login:fail:<email>", 15 phút) ≥ 5                      ✗ → { message, values }
├─ ⤷ DB users: findUnique({ email })
├─ có user:    auth/password.ts › verifyPassword() → derive() → scrypt + timingSafeEqual
│  không user: auth/password.ts › simulatePasswordCheck()  tốn thời gian như thật, không lộ email có tồn tại
│  ✗ PasswordCheckBusyError → { message: "Hệ thống đang bận…" }
├─ ✗ sai → auth/throttle.ts › recordLoginFailure() → hit("login:fail:<email>") → { message: "Email hoặc mật khẩu không đúng." }
├─ ✗ status ≠ ACTIVE → { message: "Tài khoản đã bị khóa…" }
├─ auth/session.ts › issueTokens(user) → setSessionTokens()
├─ isLocale(user.locale) → setLocale(user.locale)         mang ngôn ngữ đã lưu sang thiết bị mới
└─ redirect(validations/auth.ts › redirectPathSchema.parse(form.next))   chỉ đường dẫn nội bộ, mặc định /dashboard
```

**Trả về:** `200 { redirect: "<next>", tokens: {…}, locale: "vi" | "en" }`.

### `POST /api/auth/logout`: đăng xuất thiết bị này

```text
routes.ts › command(…, () => auth.logout()) → handlers/auth.ts › logout()      không cần đăng nhập
├─ auth/current-user.ts › currentSessionId()
│   └─ có → auth/session.ts › revokeSession(sessionId)   ⤷ DB refresh_tokens: updateMany revokedAt = now
├─ http/context.ts › requestContext().refreshToken        header x-refresh-token (access token có thể đã hết hạn)
│   └─ có → auth/session.ts › revokeRefreshToken(raw)    ⤷ DB refresh_tokens: updateMany theo tokenHash
├─ setSessionTokens(null)
└─ redirect("/login")
```

**Trả về:** `200 { redirect: "/login", tokens: null }`.

### `POST /api/auth/logout-everywhere`: đăng xuất mọi thiết bị

```text
handlers/auth.ts › logoutEverywhere()
├─ requireUser()
├─ auth/session.ts › revokeUserSessions(user.id)          ⤷ DB refresh_tokens: updateMany mọi token của user
├─ setSessionTokens(null)
└─ redirect("/login")
```

**Trả về:** `200 { redirect: "/login", tokens: null }`.

### `POST /api/auth/refresh`: đổi refresh token lấy cặp token mới

Route viết tay (không phải `command()` vì chỉ trả token).

```text
routes.ts › router.post("/auth/refresh", async (req, res) => …)
├─ req.body.refreshToken (chuỗi)
├─ auth/session.ts › rotateRefreshToken(raw)
│   ├─ ⤷ DB refresh_tokens: findUnique({ tokenHash: hashRefreshToken(raw) }) kèm user
│   ├─ ✗ không có / đã thu hồi / hết hạn → null
│   ├─ đã xoay hơn 10 giây trước (ROTATION_GRACE_MS) → nghi bị lộ:
│   │   ⤷ DB refresh_tokens: updateMany thu hồi MỌI token của user → null
│   ├─ chưa xoay → ⤷ DB refresh_tokens: updateMany rotatedAt = now
│   ├─ ✗ user.status ≠ ACTIVE → null
│   └─ issueTokens(user, stored.sessionId)                giữ nguyên phiên
├─ ✗ null → throw HttpError(401, "Not signed in")
└─ res.json({ tokens })
```

**Trả về:** `200 { tokens: { accessToken, refreshToken } }` hoặc `401 { message: "Not signed in" }`.

### `GET /api/me`: ai đang đăng nhập

```text
routes.ts › view(router, "/me", () => sessionView())
└─ views/overview.ts › sessionView()
    ├─ requireUser()
    └─ ai/client.ts › aiProvider()                       đọc AI_PROVIDER, ANTHROPIC_API_KEY, OPENAI_API_KEY
```

**Trả về:** `200 { user: { id, email, name, role, defaultCurrency, locale }, aiProvider: "anthropic" | "openai" | null }`.

### `GET /api/health`

```text
routes.ts › router.get("/health", …) → res.json({ ok: true })
```

**Trả về:** `200 { ok: true }`.

---

## 5. Tổng quan và cài đặt

Tài liệu nghiệp vụ: [dashboard-flow.md](dashboard-flow.md), [settings-flow.md](settings-flow.md), [currency-flow.md](currency-flow.md).

### `GET /api/dashboard?month=YYYY-MM`: trang tổng quan

```text
routes.ts › view(router, "/dashboard", (req) => dashboardView(req.query))
└─ views/overview.ts › dashboardView(query)
    ├─ requireUser()
    ├─ @fm/shared/months › currentMonth()
    ├─ validations/budget.ts › monthSchema.catch(thisMonth).parse(query.month)    sai → tháng này
    ├─ Promise.all
    │   ├─ data/reports.ts › getMonthReport(user.id, month)
    │   ├─ data/reports.ts › getMonthlyTrend(user.id, month, 6)
    │   ├─ data/budgets.ts › getBudgetStatuses(user.id, month)
    │   └─ ⤷ DB transactions: findMany 5 giao dịch mới nhất (kèm tên danh mục, ví)
    └─ có số dư khác tiền mặc định:
        ├─ exchange.ts › refreshRates()
        └─ exchange.ts › convertBalances(report.balances, defaultCurrency)
```

**Trả về:** `200 { month, thisMonth, trendMonths: 6, report, trend, statuses, recent, converted: { total, missing } | null }`.

### `GET /api/settings`: trang cài đặt

```text
routes.ts › view(router, "/settings", () => settingsView())
└─ views/overview.ts › settingsView()
    ├─ requireUser()
    ├─ exchange.ts › refreshRates()
    └─ Promise.all
        ├─ exchange.ts › getRatesStatus()                 ⤷ DB exchange_rates: findFirst
        └─ với mỗi tiền trong @fm/shared/currencies › SUPPORTED_CURRENCIES (trừ tiền mặc định):
            exchange.ts › exchangeRate(prisma, currency, defaultCurrency, today)
```

**Trả về:** `200 { status: { rateDate, fetchedAt } | null, rates: [{ currency, rate | null }] }`.

### `PUT /api/settings`: đổi tên, ngôn ngữ, tiền tệ mặc định

```text
routes.ts › command("put", "/settings", …) → handlers/settings.ts › updateSettings(_prev, formData)
├─ requireUser(), getI18n()
├─ validations/settings.ts › settingsSchema.safeParse()        ✗ → { errors, values }
├─ tiền mặc định không đổi:
│   └─ ⤷ DB users: updateMany name, locale
└─ tiền mặc định đổi:
    ├─ exchange.ts › refreshRates()
    ├─ ⤷ DB transactions, budgets: findMany distinct currency
    ├─ mỗi loại tiền: exchange.ts › exchangeRate()             ✗ thiếu tỷ giá → { errors: { defaultCurrency } }
    └─ prisma.$transaction (timeout 60 giây)
        ├─ ⤷ DB users: updateMany name, locale, defaultCurrency
        ├─ exchange.ts › recomputeConversions(tx, { userId, onlyMissing: false })   quy đổi lại mọi giao dịch
        └─ mỗi loại tiền của ngân sách: tx.$executeRaw UPDATE "budgets" amountLimit × tỷ giá, currency mới
├─ setLocale(language)
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true }, locale }`.

### `POST /api/settings/language`: đổi ngôn ngữ (cả khi chưa đăng nhập)

```text
handlers/settings.ts › setLanguage(formData)
├─ validations/settings.ts › languageSchema.safeParse(form.language)   ✗ → return (không làm gì)
├─ setLocale(language)
└─ getCurrentUser() có → ⤷ DB users: updateMany locale
```

**Trả về:** `200 { locale: "vi" | "en" }` (sai ngôn ngữ: `200 {}`).

### `PUT /api/settings/password`: đổi mật khẩu

```text
handlers/settings.ts › changePassword(_prev, formData)
├─ requireUser()
├─ validations/settings.ts › changePasswordSchema.safeParse()   ✗ → { errors } (không gửi lại mật khẩu)
├─ auth/throttle.ts › refuseLogin(user.email)                   chung giới hạn với đăng nhập   ✗ → { message }
├─ ⤷ DB users: findUniqueOrThrow passwordHash
├─ auth/password.ts › verifyPassword()                          ✗ sai → recordLoginFailure() → { errors: { currentPassword } }
├─ auth/password.ts › hashPassword(newPassword)                 ✗ PasswordCheckBusyError → { message }
├─ ⤷ DB users: updateMany passwordHash
└─ auth/session.ts › revokeUserSessions(user.id, currentSessionId())   đăng xuất mọi thiết bị khác
⇒ { success: true, message: "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất." }
```

**Trả về:** `200 { state: { success: true, message } }`.

### `POST /api/settings/exchange-rates/refresh`: bấm cập nhật tỷ giá

```text
handlers/settings.ts › refreshExchangeRates()
├─ requireUser(), getI18n()
└─ exchange.ts › refreshRates({ manual: true })                 khoảng tối thiểu 10 phút
⇒ "failed" → { message: "Không lấy được tỷ giá mới…" }
   "fresh"  → { message: "Tỷ giá vừa được cập nhật trong 10 phút qua." }
   "updated"→ { message: "Đã cập nhật tỷ giá." }
```

**Trả về:** `200 { state: { message } }`.

---

## 6. Ví / tài khoản

Tài liệu nghiệp vụ: [account-flow.md](account-flow.md). File: `handlers/accounts.ts`, `views/accounts.ts`, `validations/account.ts`.

### `GET /api/accounts`

```text
views/accounts.ts › accountsView()
├─ requireUser()
├─ Promise.all
│   ├─ ⤷ DB accounts: findMany (mọi ví, kể cả đã lưu trữ)
│   └─ ⤷ DB accounts: groupBy currency, _sum currentBalance (ví chưa lưu trữ)
└─ có tiền khác tiền mặc định → refreshRates() + convertBalances()
```

**Trả về:** `200 { accounts: [{ id, name, type, currency, currentBalance, archivedAt }], totals: [{ currency, total }], converted }`.

### `GET /api/accounts/:id`

```text
routes.ts › view(…, (req) => accountView(id(req)))      id(req) = http/routing.ts › routeParam(req, "id")
└─ views/accounts.ts › accountView(accountId)
    ├─ requireUser()
    ├─ idSchema.safeParse()                             ✗ → null → 404
    └─ ⤷ DB accounts: findFirst({ id, userId })        ✗ không có / của người khác → null → 404
```

**Trả về:** `200 { id, name, type, currency, initialBalance }` hoặc `404`.

### `POST /api/accounts`: tạo ví

```text
handlers/accounts.ts › createAccount(_prev, formData)
├─ requireUser()
├─ validations/account.ts › createAccountSchema.safeParse()   ✗ → { errors, values }
├─ isNameTaken(user.id, name)           ⤷ DB accounts: findFirst tên trùng (không phân biệt hoa thường)   ✗ → { errors: { name } }
├─ ⤷ DB accounts: count ≥ limits.ts › MAX_ACCOUNTS_PER_USER (50)                                          ✗ → { message }
└─ ⤷ DB accounts: create (currentBalance = initialBalance)
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `PUT /api/accounts/:id`: sửa ví

```text
routes.ts › command("put", "/accounts/:id", (form, req) => accounts.updateAccount(id(req), undefined, form))
└─ handlers/accounts.ts › updateAccount(accountId, _prev, formData)
    ├─ requireUser()
    ├─ idSchema.safeParse()                                       ✗ → { message: "Không tìm thấy tài khoản." }
    ├─ validations/account.ts › updateAccountSchema.safeParse()   (không có currency)   ✗ → { errors }
    ├─ isNameTaken(user.id, name, id)                             ✗ → { errors: { name } }
    ├─ prisma.$executeRaw UPDATE "accounts"                        một câu: currentBalance += (initialBalance mới − cũ)
    │   ✗ 0 dòng → { message: "Không tìm thấy tài khoản." }
    └─ redirect("/accounts")
```

**Trả về:** `200 { redirect: "/accounts" }`.

### `POST /api/accounts/:id/archive` và `/restore`

```text
routes.ts › command(…, (form) => accounts.archiveAccount(form) | restoreAccount(form))   form.id lấy từ :id
└─ handlers/accounts.ts › setArchived(formData, archived)
    ├─ requireUser()
    ├─ idSchema.safeParse(form.id)                               ✗ → return
    └─ ⤷ DB accounts: updateMany archivedAt = now | null (chỉ khi đang ở trạng thái ngược lại)
```

**Trả về:** `200 {}`.

---

## 7. Danh mục

Tài liệu nghiệp vụ: [category-flow.md](category-flow.md). File: `handlers/categories.ts`, `views/categories.ts`, `validations/category.ts`.

### `GET /api/categories`

```text
views/categories.ts › categoriesView()
├─ requireUser()
└─ ⤷ DB categories: findMany (của mình hoặc userId null), hệ thống trước
```

**Trả về:** `200 [{ id, userId, parentId, name, type, icon, color }]`.

### `GET /api/categories/:id`

```text
views/categories.ts › categoryView(categoryId)
├─ requireUser(), idSchema.safeParse()                  ✗ → 404
├─ ⤷ DB categories: findFirst({ id, userId }) kèm _count.subcategories   danh mục hệ thống → 404
└─ không có con → ⤷ DB categories: findMany các danh mục cha có thể chọn (cùng loại, cấp 1)
```

**Trả về:** `200 { category, hasChildren, parents: [{ id, name, type }] }`.

### `POST /api/categories`: tạo danh mục riêng

```text
handlers/categories.ts › createCategory(_prev, formData)
├─ requireUser()
├─ validations/category.ts › createCategorySchema.safeParse()   icon ∈ @fm/shared/category-icons › CATEGORY_ICON_NAMES   ✗ → { errors }
├─ isNameTaken(user.id, type, name)     ⤷ DB categories: findFirst (của mình + hệ thống)   ✗ → { errors: { name } }
├─ parentError(user.id, parentId, type) ⤷ DB categories: findFirst cha cấp 1, cùng loại     ✗ → { errors: { parentId } }
├─ ⤷ DB categories: count ≥ MAX_CATEGORIES_PER_USER (200)                                  ✗ → { message }
└─ ⤷ DB categories: create
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `PUT /api/categories/:id`

```text
handlers/categories.ts › updateCategory(categoryId, _prev, formData)
├─ requireUser(), idSchema.safeParse()                  ✗ → { message: "Không tìm thấy danh mục." }
├─ validations/category.ts › updateCategorySchema       (không có type)   ✗ → { errors }
├─ ⤷ DB categories: findFirst({ id, userId }) kèm _count   ✗ → { message } (danh mục hệ thống không sửa được ở đây)
├─ isNameTaken(…, exceptId)                             ✗ → { errors: { name } }
├─ đang có con mà chọn cha                              ✗ → { errors: { parentId } }
├─ parentId === id hoặc parentError()                   ✗ → { errors: { parentId } }
├─ ⤷ DB categories: updateMany
└─ redirect("/categories")
```

**Trả về:** `200 { redirect: "/categories" }`.

### `DELETE /api/categories/:id`

```text
handlers/categories.ts › deleteCategory(_prev, formData)
├─ requireUser(), idSchema.safeParse(form.id)           ✗ → { message: "Không tìm thấy danh mục." }
├─ ⤷ DB categories: deleteMany({ id, userId, transactions: none, budgets: none })
└─ xóa được 0 dòng mà danh mục tồn tại (⤷ findFirst) → { message: "Danh mục đang được dùng…" }
```

**Trả về:** `200 {}` hoặc `200 { state: { message } }`.

---

## 8. Giao dịch và chuyển khoản

Tài liệu nghiệp vụ: [transaction-flow.md](transaction-flow.md). File: `handlers/transactions.ts`, `views/transactions.ts`, `validations/transaction.ts`.

Hàm nội bộ của `handlers/transactions.ts` dùng ở dưới:

| Hàm | Làm gì |
| --- | --- |
| `signedAmount(row)` | `@fm/shared/transactions › isInflow(row)` (thu, nhận chuyển khoản) → `+amount`; chi, chuyển đi → `−amount` |
| `adjustBalance(tx, userId, accountId, delta)` | `tx.account.updateMany currentBalance increment delta` (luôn chung transaction với việc ghi giao dịch) |
| `lockTransactionRows(tx, userId, id)` | `$queryRaw SELECT … FOR UPDATE` giao dịch và cặp chuyển khoản của nó, rồi `tx.transaction.findMany` |
| `findCategory(db, userId, id, type)` | `category.findFirst` của mình hoặc hệ thống, đúng loại |
| `transactionValues(formData)` | `formText()` cho type, accountId, categoryId, amount, date, note |
| `parseEntry(values)` | `transactionSchema` rồi đổi số tiền sang `Prisma.Decimal`, ngày sang `Date`: `{ ok: true, entry }` hoặc `{ ok: false, errors }` |
| `entryData(entry, account, categoryId, conversion)` | Các cột ghi vào `transactions` (tiền tệ lấy theo ví), dùng chung cho tạo và sửa |

### `GET /api/transactions?accountId&categoryId&type&from&to&page`

```text
views/transactions.ts › transactionsView(query)
├─ requireUser()
├─ validations/transaction.ts › transactionFilterSchema.parse(query)   trường sai bị bỏ (catch), page mặc định 1
├─ dựng where; @fm/shared/dates › isoDateToDate(from/to)
├─ Promise.all
│   ├─ data/transaction-options.ts › getTransactionOptions(user.id)
│   ├─ ⤷ DB transactions: count(where)
│   └─ ⤷ DB transactions: findMany(where) trang 20 dòng, kèm tên ví, danh mục
└─ có chuyển khoản → ⤷ DB transactions: findMany các vế còn lại theo transferGroupId
```

**Trả về:** `200 { filter, pageSize: 20, accounts, categoryOptions, total, transactions, transferSides }`.

### `GET /api/transactions/:id`

```text
views/transactions.ts › transactionView(transactionId)
├─ requireUser(), idSchema.safeParse()                    ✗ → 404
└─ Promise.all
    ├─ ⤷ DB transactions: findFirst({ id, userId, type ∈ EXPENSE | INCOME })   chuyển khoản → 404
    └─ getTransactionOptions(user.id)
```

**Trả về:** `200 { transaction: { id, type, accountId, categoryId, amount, date, note }, accounts, categoryOptions }`.

### `POST /api/transactions`: thêm thu / chi

```text
handlers/transactions.ts › createTransaction(_prev, formData)
├─ requireUser()
├─ transactionValues(formData)
├─ parseEntry(values)
│   ├─ validations/transaction.ts › transactionSchema.safeParse()
│   │   amountField (chuỗi, > 0), dateField (dateText → z.iso.date → 2000–2100), noteField (≤ 200)   ✗ → { errors, values }
│   └─ new Prisma.Decimal(amount), isoDateToDate(date)   ⇒ entry
├─ Promise.all
│   ├─ ⤷ DB accounts: findFirst({ id, userId, archivedAt: null })   ✗ → { errors: { accountId } }
│   └─ findCategory(prisma, …)                                      ✗ → { errors: { categoryId } }
├─ tiền của ví ≠ tiền mặc định → exchange.ts › refreshRates()
├─ exchange.ts › convertToDefaultCurrency(prisma, amount, account.currency, defaultCurrency, date)
└─ prisma.$transaction
    ├─ ⤷ DB transactions: create (entryData(entry, account, categoryId, conversion))
    └─ adjustBalance(tx, user.id, account.id, signedAmount(created))
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `PUT /api/transactions/:id`: sửa thu / chi

```text
handlers/transactions.ts › updateTransaction(transactionId, _prev, formData)
├─ requireUser(), idSchema.safeParse()                    ✗ → { message: "Không tìm thấy giao dịch." }
├─ parseEntry(transactionValues(formData))                ✗ → { errors }
├─ exchange.ts › refreshRates()
└─ prisma.$transaction
    ├─ lockTransactionRows(tx, user.id, id)               ✗ không có hoặc là TRANSFER → { message }
    ├─ ⤷ DB accounts: findFirst                           ✗ không có, hoặc chuyển sang ví đã lưu trữ → { errors: { accountId } }
    ├─ findCategory(tx, …)                                ✗ → { errors: { categoryId } }
    ├─ convertToDefaultCurrency(tx, …)
    ├─ adjustBalance(ví cũ, −signedAmount(cũ))
    ├─ ⤷ DB transactions: update (entryData(…))
    └─ adjustBalance(ví mới, +signedAmount(mới))
└─ redirect("/transactions")
```

**Trả về:** `200 { redirect: "/transactions" }`.

### `DELETE /api/transactions/:id`

```text
handlers/transactions.ts › deleteTransaction(formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → return
└─ prisma.$transaction
    ├─ lockTransactionRows(tx, user.id, id)               gồm cả hai vế nếu là chuyển khoản
    ├─ mỗi dòng: adjustBalance(tx, …, −signedAmount(row))
    └─ ⤷ DB transactions: deleteMany
```

**Trả về:** `200 {}`.

### `POST /api/transfers`: chuyển khoản giữa hai ví

```text
handlers/transactions.ts › createTransfer(_prev, formData)
├─ requireUser()
├─ validations/transaction.ts › transferSchema.safeParse()   ví nguồn ≠ ví đích; toAmount rỗng → null   ✗ → { errors }
├─ ⤷ DB accounts: findMany cả hai ví (chưa lưu trữ)          ✗ → { errors: { fromAccountId | toAccountId } }
├─ khác tiền tệ: bắt buộc toAmount                           ✗ → { errors: { toAmount } } (getI18n().t)
│  cùng tiền tệ: toAmount phải trống hoặc bằng amount         ✗ → { errors: { toAmount } }
├─ exchange.ts › refreshRates()
├─ Promise.all convertToDefaultCurrency() × 2
├─ transferGroupId = crypto.randomUUID()
└─ prisma.$transaction
    ├─ ⤷ DB transactions: create vế OUT (ví nguồn)
    ├─ ⤷ DB transactions: create vế IN (ví đích)
    ├─ adjustBalance(ví nguồn, −amountOut)
    └─ adjustBalance(ví đích, +amountIn)
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

---

## 9. Ngân sách

Tài liệu nghiệp vụ: [budget-flow.md](budget-flow.md). File: `handlers/budgets.ts`, `views/budgets.ts`, `validations/budget.ts`, `data/budgets.ts`.

### `GET /api/budgets?month=YYYY-MM`

```text
views/budgets.ts › budgetsView(query)
├─ requireUser()
├─ monthSchema.catch(currentMonth()).parse(query.month)
├─ Promise.all
│   ├─ data/budgets.ts › getBudgetStatuses(user.id, month)
│   ├─ data/transaction-options.ts › getTransactionOptions(user.id)
│   └─ ⤷ DB budgets: count tháng trước (@fm/shared/months › monthStart, shiftMonth)
└─ availableCategories = danh mục chi chưa có ngân sách tháng này
```

**Trả về:** `200 { month, statuses, unconvertedCount, availableCategories, previousCount, nearLimitPercent: 80 }`.

### `GET /api/budgets/:id`

```text
views/budgets.ts › budgetView(budgetId)
├─ requireUser(), idSchema.safeParse()                    ✗ → 404
└─ ⤷ DB budgets: findFirst({ id, userId }) kèm tên danh mục
```

**Trả về:** `200 { id, amountLimit, currency, periodStart, category: { name } | null }`.

### `POST /api/budgets`

```text
handlers/budgets.ts › createBudget(_prev, formData)
├─ requireUser()
├─ validations/budget.ts › createBudgetSchema.safeParse()   categoryId "" → null (ngân sách tổng)   ✗ → { errors }
├─ monthStart(month)
├─ có categoryId → ⤷ DB categories: findFirst loại EXPENSE (của mình hoặc hệ thống)   ✗ → { errors: { categoryId } }
├─ ⤷ DB budgets: findFirst trùng tháng + danh mục          ✗ → { errors: { categoryId: ["Tháng này đã có ngân sách…"] } }
└─ ⤷ DB budgets: create (currency = user.defaultCurrency)  ✗ P2002 → cùng lỗi trùng
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `POST /api/budgets/copy-previous`

```text
handlers/budgets.ts › copyPreviousMonthBudgets(formData)
├─ requireUser()
├─ monthSchema.safeParse(form.month)                      ✗ → return
├─ ⤷ DB budgets: findMany tháng trước
└─ ⤷ DB budgets: createMany(skipDuplicates)               không đè ngân sách đã có
```

**Trả về:** `200 {}`.

### `PUT /api/budgets/:id`

```text
handlers/budgets.ts › updateBudget(budgetId, _prev, formData)
├─ requireUser(), idSchema.safeParse()                    ✗ → { message: "Không tìm thấy ngân sách." }
├─ updateBudgetSchema.safeParse()                         ✗ → { errors }
├─ ⤷ DB budgets: findFirst                                ✗ → { message }
├─ ⤷ DB budgets: updateMany amountLimit
└─ redirect(`/budgets?month=${dateToIsoDate(periodStart).slice(0, 7)}`)
```

**Trả về:** `200 { redirect: "/budgets?month=YYYY-MM" }`.

### `DELETE /api/budgets/:id`

```text
handlers/budgets.ts › deleteBudget(formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → return
└─ ⤷ DB budgets: deleteMany({ id, userId })
```

**Trả về:** `200 {}`.

---

## 10. Mục tiêu tiết kiệm

Tài liệu nghiệp vụ: [savings-flow.md](savings-flow.md). File: `handlers/savings.ts`, `views/savings.ts`, `validations/savings.ts`.

Hàm nội bộ `shiftSavedAmount(db, userId, goalId, delta, { allowArchived })`: một câu `$executeRaw UPDATE "savings_goals"` cộng `delta` vào `currentAmount`, tính lại `status` (`COMPLETED` khi đủ, ngược lại `IN_PROGRESS`, giữ nguyên `ARCHIVED`), chỉ chạy khi kết quả không âm và (nếu không cho phép) mục tiêu chưa lưu trữ. Trả `true` khi đã cập nhật.

### `GET /api/savings`

```text
views/savings.ts › savingsView()
├─ requireUser()
└─ ⤷ DB savings_goals: findMany (GOAL_FIELDS)
```

**Trả về:** `200 [{ id, name, targetAmount, currentAmount, currency, deadline, status }]`.

### `GET /api/savings/:id`

```text
views/savings.ts › savingsGoalView(goalId)
├─ requireUser(), idSchema.safeParse()                    ✗ → 404
└─ ⤷ DB savings_goals: findFirst kèm _count.contributions và 100 khoản gần nhất (savings_contributions)
```

**Trả về:** `200 { …goal, _count: { contributions }, contributions: [{ id, amount, date, note }], historyLimit: 100 }`.

### `POST /api/savings`

```text
handlers/savings.ts › createGoal(_prev, formData)
├─ requireUser()
├─ validations/savings.ts › createGoalSchema.safeParse()   deadline "" → null   ✗ → { errors }
├─ isNameTaken()                         ⤷ DB savings_goals: findFirst   ✗ → { errors: { name } }
├─ ⤷ DB savings_goals: count ≥ MAX_SAVINGS_GOALS_PER_USER (50)            ✗ → { message }
├─ ⤷ DB savings_goals: create
└─ redirect(`/savings/${goal.id}`)
```

**Trả về:** `200 { redirect: "/savings/<id>" }`.

### `PUT /api/savings/:id`

```text
handlers/savings.ts › updateGoal(goalId, _prev, formData)
├─ requireUser(), idSchema.safeParse()                    ✗ → { message: "Không tìm thấy mục tiêu." }
├─ updateGoalSchema.safeParse()  (không có currency)      ✗ → { errors }
├─ isNameTaken(…, exceptId)                               ✗ → { errors: { name } }
├─ prisma.$executeRaw UPDATE "savings_goals"              tên, mục tiêu, hạn chót, tính lại status   ✗ 0 dòng → { message }
└─ redirect(`/savings/${id}`)
```

**Trả về:** `200 { redirect: "/savings/<id>" }`.

### `DELETE /api/savings/:id`

```text
handlers/savings.ts › deleteGoal(formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → return (200 {})
├─ ⤷ DB savings_goals: deleteMany                         savings_contributions xóa theo khóa ngoại (cascade)
└─ redirect("/savings")
```

**Trả về:** `200 { redirect: "/savings" }`.

### `POST /api/savings/:id/archive` và `/restore`

```text
handlers/savings.ts › archiveGoal(formData)
├─ requireUser(), idSchema.safeParse(form.id)
└─ ⤷ DB savings_goals: updateMany status = ARCHIVED

handlers/savings.ts › restoreGoal(formData)
├─ requireUser(), idSchema.safeParse(form.id)
└─ prisma.$executeRaw UPDATE "savings_goals" status = COMPLETED | IN_PROGRESS (chỉ khi đang ARCHIVED)
```

**Trả về:** `200 {}`.

### `POST /api/savings/:id/contributions`: gửi / rút

```text
routes.ts › command(…, (form, req) => savings.addContribution(id(req), undefined, form))
└─ handlers/savings.ts › addContribution(goalId, _prev, formData)
    ├─ requireUser(), idSchema.safeParse()                ✗ → { message }
    ├─ validations/savings.ts › contributionSchema        direction deposit | withdraw   ✗ → { errors }
    ├─ amount = Decimal (rút → số âm)
    ├─ prisma.$transaction
    │   ├─ shiftSavedAmount(tx, …, amount, { allowArchived: false })   ✗ false → hủy, trả false
    │   └─ ⤷ DB savings_contributions: create
    └─ không lưu được → ⤷ DB savings_goals: findFirst để biết lý do
        ✗ không có → { message: "Không tìm thấy mục tiêu." }
        ✗ ARCHIVED → { message: "Mục tiêu đã được lưu trữ…" }
        ✗ còn lại  → { errors: { amount: ["Không thể rút nhiều hơn số tiền đã tiết kiệm."] } }
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `DELETE /api/savings/contributions/:id`

Ở route này `:id` là id của **khoản gửi / rút**.

```text
handlers/savings.ts › deleteContribution(_prev, formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → { message: "Không tìm thấy khoản này." }
├─ ⤷ DB savings_contributions: findFirst({ id, savingsGoal: { userId } })   ✗ → { message }
└─ prisma.$transaction
    ├─ ⤷ DB savings_contributions: deleteMany             0 dòng (đã bị xóa song song) → dừng
    └─ shiftSavedAmount(tx, …, −amount, { allowArchived: true })
        ✗ false (tổng sẽ âm) → throw class RefusedError → rollback
           → { message: "Không xóa được: số tiền này đã được rút ra ở các lần sau…" }
```

**Trả về:** `200 {}` hoặc `200 { state: { message } }`.

---

## 11. Sao kê PDF

Tài liệu nghiệp vụ: [statement-flow.md](statement-flow.md). Route viết tay vì trả file, không trả JSON.

### `GET /api/reports/statement?from&to&accountId`

```text
routes.ts › router.get("/reports/statement", async (req, res) => …)
├─ requireUser()
├─ validations/report.ts › statementQuerySchema.safeParse(req.query)
│   from, to: dateText → z.iso.date; accountId rỗng → null hoặc uuid;
│   from ≤ to; @fm/shared/reports › statementDays() ≤ STATEMENT_MAX_DAYS (1096)
│   ✗ → throw HttpError(404, "account") | HttpError(400, "range" | "invalid")
├─ rate-limit.ts › hit("statement:<userId>", 1 giờ) > 30   ✗ → throw HttpError(429, "busy")
├─ reports/statement.ts › buildStatement(user, query)
│   ├─ getI18n(), isoDateToDate(from/to)
│   ├─ có accountId → ⤷ DB accounts: findFirst           ✗ → throw HttpError(404, "account")
│   ├─ ⤷ DB transactions: findMany trong kỳ (tối đa STATEMENT_MAX_ROWS + 1 = 3001)   ✗ > 3000 → throw HttpError(400, "rows")
│   ├─ ⤷ DB transactions: groupBy type, transferDirection trước ngày bắt đầu   → số dư đầu kỳ
│   ├─ một ví: opening = initialBalance
│   │  mọi ví: ⤷ DB accounts: groupBy currency _sum initialBalance → exchange.ts › exchangeRate() mỗi loại tiền
│   ├─ mọi ví: ⤷ DB transactions: count chưa quy đổi
│   ├─ có chuyển khoản → ⤷ DB transactions: findMany vế còn lại ("Chuyển đến X" / "Nhận từ Y")
│   └─ mỗi dòng: debit hoặc credit (@fm/shared/transactions › isInflow) và balance = số dư sau dòng đó (bắt đầu từ opening); closing = balance sau dòng cuối
│   ⇒ Statement { holder, createdAt, from, to, account, currency, opening, debit, credit, closing, rows, unconverted, missingRates }
├─ reports/statement-pdf.ts › renderStatementPdf(statement)
│   ├─ new PDFDocument (pdfkit, A4), registerFont Noto Sans (backend/assets/fonts/)
│   ├─ keepLettersWhole(doc)                               chuẩn hóa NFC, tắt ccmp: chữ tiếng Việt chép và tìm kiếm được
│   ├─ drawBrand → drawTitle → drawHolder → drawSummary
│   ├─ drawRows: dòng "Số dư đầu kỳ", rồi mỗi giao dịch (describe, columnsFor, drawSectionBar, drawColumnHeads, sang trang khi đầy)
│   ├─ drawTotals (notesFor)
│   └─ drawFooters                                         chân trang, số trang "n/N", dòng "Kết Thúc Sao Kê" ở trang cuối
│   ⇒ Promise<Buffer>
└─ res.set(Content-Type: application/pdf, Content-Disposition: attachment; filename="sao-ke-<from>_<to>.pdf",
           Cache-Control: private, no-store).send(pdf)
```

**Trả về:** `200` file PDF. Bị từ chối: `400 | 404 | 429 { message: "invalid" | "range" | "account" | "rows" | "busy" }` (mã trong `@fm/shared/reports › STATEMENT_ERRORS`, frontend đổi thành câu chữ).

---

## 12. Nhập sao kê

Tài liệu nghiệp vụ: [import-flow.md](import-flow.md), thuật toán đọc PDF và ghép cột ở [algorithms.md](algorithms.md). File: `handlers/imports.ts`, `views/imports.ts`, `validations/import.ts` và thư mục `imports/`.

| File trong `imports/` | Thành phần chính |
| --- | --- |
| `parse-file.ts` | `parseStatementFile(buffer, ext)`, `statementExtension(name)`, `parseXlsx`, `normalizeExcelValue`, class `StatementFileError`, class `UnreadablePdfError`, `MAX_FILE_BYTES` (5 MB), `MAX_ROWS` (10.000) |
| `parse-pdf.ts` | `parsePdf(buffer)`, `readPieces` (pdfjs-dist `getDocument`, `getTextContent`), `toLines`, `findBands`, `mergeSpans`, `toRow`, `isContinuation`, class `PdfReadError` (`not-pdf`, `password`, `too-many-pages`), `MAX_PDF_PAGES` (200) |
| `xlsx-guard.ts` | `checkXlsxArchive(buffer)` (chặn zip bomb bằng `zlib.inflateRawSync` có giới hạn), class `ArchiveTooLargeError`, `ArchiveUnreadableError` |
| `mapping.ts` | `suggestMapping(table)` (đoán dòng tiêu đề và cột theo `ALIASES`), `buildRows(table, mapping)`, `parseDate`, `parseAmount` |
| `ai.ts` | `extractDocumentRows`, `extractTableRows`, `requestTransactions`, `addTransaction`, `takeAiQuota`, class `AiImportError` |
| `analysis.ts` | `readAnalysis(value)`: Zod kiểm tra cột `import_batches.aiAnalysis` (`kind: "table"` hoặc `"document"`) |
| `storage.ts` | `saveImportFile`, `readImportFile`, `deleteImportFile`, `listImportFiles` (thư mục `backend/storage/imports/`) |
| `template.ts` | `buildXlsxTemplate()` (ExcelJS) |

`parseStatementFile()` dùng ở nhiều route bên dưới:

```text
imports/parse-file.ts › parseStatementFile(buffer, extension)
├─ "pdf"  → imports/parse-pdf.ts › parsePdf(buffer)
│   ├─ không có "%PDF-" trong 1 KB đầu → throw PdfReadError("not-pdf")
│   ├─ readPieces(): pdfjs getDocument → numPages > 200 → PdfReadError("too-many-pages")
│   │   PasswordException → PdfReadError("password"); mỗi trang getTextContent() → các mẩu chữ có tọa độ
│   ├─ toLines() → findBands() → toRow()           dựng lại bảng từ vị trí chữ
│   └─ giữ phần đầu tới giao dịch đầu tiên, sau đó chỉ các dòng có ngày; dòng nối tiếp gộp vào dòng trên
├─ "xlsx" → parseXlsx(buffer)
│   ├─ imports/xlsx-guard.ts › checkXlsxArchive()  ArchiveTooLargeError → StatementFileError("File Excel quá lớn…")
│   └─ ExcelJS Workbook.xlsx.load() → worksheets[0].eachRow() → normalizeExcelValue()
├─ lỗi đọc → StatementFileError (thông báo cho người dùng) hoặc UnreadablePdfError (PDF không có chữ)
├─ cắt 50 cột, bỏ dòng trống
├─ PDF không còn dòng nào → throw UnreadablePdfError("…bản scan hoặc ảnh chụp…")
└─ > 10.000 dòng → throw StatementFileError
⇒ Cell[][]   (Cell = string | number | Date | null)
```

### `GET /api/imports`

```text
views/imports.ts › importsView()
├─ requireUser()
├─ Promise.all
│   ├─ ⤷ DB accounts: findMany chưa lưu trữ
│   └─ ⤷ DB import_batches: findMany 50 lần gần nhất kèm tên ví
└─ ai/client.ts › aiProvider()
```

**Trả về:** `200 { accounts, batches: [{ id, fileName, status, importedCount, skippedCount, createdAt, account }], aiProvider }`.

### `GET /api/imports/template`: file Excel mẫu

Khai báo **trước** `/imports/:id` để không bị coi là một id.

```text
routes.ts › router.get("/imports/template", …)
├─ requireUser()
├─ imports/template.ts › buildXlsxTemplate()
│   └─ ExcelJS Workbook → sheet "Sao kê", cột "Ngày giao dịch" | "Diễn giải" | "Số tiền", 3 dòng ví dụ → writeBuffer()
└─ res.set(Content-Type: XLSX, Content-Disposition: attachment; filename="mau-sao-ke.xlsx", Cache-Control: private, no-store).send(Buffer)
```

**Trả về:** `200` file `.xlsx`.

### `GET /api/imports/:id`: xem trước / kết quả một lần nhập

```text
views/imports.ts › importView(batchId)
├─ requireUser(), idSchema.safeParse()                    ✗ → 404
├─ ⤷ DB import_batches: findFirst({ id, userId }) kèm ví  ✗ → 404
└─ status PENDING → pendingImport(userId, tempFileKey, aiAnalysis)
    ├─ getTransactionOptions(userId) → danh mục chi, danh mục thu
    ├─ ⤷ DB categories: findFirst systemKey "other_expense", "other_income"   danh mục mặc định
    ├─ imports/analysis.ts › readAnalysis(aiAnalysis)
    ├─ AI đã đọc (kind "document") → trả document: 100 dòng đầu, tổng số dòng, lỗi, danh mục AI gợi ý
    └─ còn lại → loadTable(tempFileKey)
        ├─ imports/storage.ts › readImportFile(key)       file mất → table null (chỉ còn hủy được)
        ├─ imports/parse-file.ts › parseStatementFile()
        └─ imports/mapping.ts › suggestMapping(table)     đoán dòng tiêu đề và các cột
```

**Trả về:** `200 { batch: { id, fileName, status, rowCount, importedCount, skippedCount, errorMessage, createdAt, account }, pending: { expenseCategories, incomeCategories, categoryDefaults, document | null, aiFailed, table: { preview (20 dòng), totalRows, columnCount, headerCells, suggestion } | null } | null }`.

### `POST /api/imports`: tải file lên

Body là **chính file** (`application/octet-stream`); tên file ở header `x-file-name`, các trường khác ở query.

```text
routes.ts › command("post", "/imports", (form, req) => …)
├─ req.body (Buffer từ express.raw) → new File([bytes], decodeURIComponent(x-file-name)) → form.set("file")
├─ req.query.accountId, req.query.useAi → form
└─ handlers/imports.ts › uploadImport(_prev, formData)
    ├─ requireUser()
    ├─ idSchema.safeParse(accountId)                      ✗ → { errors: { accountId } }
    ├─ file rỗng / > MAX_FILE_BYTES / statementExtension() không ra xlsx|pdf   ✗ → { errors: { file } }
    ├─ ⤷ DB accounts: findFirst chưa lưu trữ               ✗ → { errors: { accountId } }
    ├─ ⤷ DB import_batches: count PENDING ≥ 5              ✗ → { message }
    ├─ aiReads = useAi === "on" && ai/client.ts › aiAvailable()
    ├─ imports/parse-file.ts › parseStatementFile(buffer, ext)
    │   ✗ StatementFileError → { errors: { file: [t(message, …args)] } }
    │     (trừ UnreadablePdfError khi có AI: file vẫn được gửi cho AI đọc)
    ├─ aiReads:
    │   ├─ imports/ai.ts › takeAiQuota(userId)
    │   │   └─ ai/client.ts › takeHourlyQuota("import", userId, 20) → hit("ai-uses:import:<id>", 1 giờ)   ✗ → { message }
    │   ├─ getTransactionOptions() → categoryOptions
    │   ├─ xlsx đọc được → imports/ai.ts › extractTableRows(userId, table, categories, currency)
    │   │   ✗ > 3000 dòng → AiImportError
    │   │   chia phần 150 dòng, chạy 4 phần song song, mỗi phần → requestTransactions(…, TABLE_SYSTEM, { text })
    │   │   pdf (hoặc PDF scan) → imports/ai.ts › extractDocumentRows(userId, buffer, …)
    │   │   → requestTransactions(…, DOCUMENT_SYSTEM, { pdf, text })
    │   │
    │   │   imports/ai.ts › requestTransactions()
    │   │   ├─ ai/client.ts › assertAiBudget(userId)    used("ai-tokens:all"), used("ai-tokens:user:<id>")
    │   │   │   ✗ class AiBudgetError → AiImportError("…hết hạn mức hôm nay…")
    │   │   ├─ ai/client.ts › aiModel()                 object anthropicModel (ai/anthropic.ts) | openAiModel (ai/openai.ts)
    │   │   ├─ .structured({ system, text, pdf?, schema: transactionsSchema, maxTokens: 32000 })
    │   │   │   anthropic: SDK messages.stream(… document base64 …, output_config json schema).finalMessage()
    │   │   │   openai:    SDK responses.stream(… input_file …, text.format json_schema).finalResponse()
    │   │   │   ⇒ { text, truncated, tokens }
    │   │   │   ✗ lỗi SDK → toAiImportError() → ai/client.ts › aiFailure() → ai/messages.ts › AI_FAILURE_MESSAGES
    │   │   ├─ ai/client.ts › recordAiUsage(userId, tokens)   hit("ai-tokens:…", 1 ngày, tokens)
    │   │   ├─ ✗ truncated → AiImportError(quá dài)
    │   │   └─ JSON.parse + transactionsSchema.parse   ✗ → AiImportError
    │   │   addTransaction(): kiểm lại ngày, số tiền bằng mapping.ts › parseDate(), parseAmount(); dòng hỏng giữ kèm ô của nó (fileRowCells / readRowCells)
    │   │   ⇒ Extraction { rows, errors, categories }
    │   │
    │   ├─ ✗ AiImportError: không có bảng → { errors: { file: [message] } }; có bảng → analysis { kind: "table", failed: true }
    │   └─ AI không thấy giao dịch: tương tự
    ├─ AI không đọc (ghép cột tay) → imports/storage.ts › saveImportFile(buffer, ext)   <uuid>.<ext> trong backend/storage/imports/
    ├─ ⤷ DB import_batches: create { fileName, tempFileKey, rowCount, aiAnalysis }
    └─ redirect(`/imports/${batch.id}`)
```

**Trả về:** `200 { redirect: "/imports/<id>" }`, hoặc `200 { state: { errors | message, values } }`.

### Hàm ghi chung: `writeImport()`

Dùng bởi hai route xác nhận bên dưới.

```text
handlers/imports.ts › writeImport(user, batch, rows, errors, categoryOf, columnMapping)
├─ mỗi dòng: dedupeHash = sha256(accountId | ngày | số tiền có dấu | mô tả | lần xuất hiện thứ mấy)
├─ ⤷ DB transactions: findMany các hash đã có → chỉ giữ dòng mới
├─ tiền của ví ≠ tiền mặc định → refreshRates(); convertToDefaultCurrency() một lần cho mỗi ngày
├─ dựng dữ liệu: source "IMPORT", importBatchId, createdAt = updatedAt = now, categoryId = categoryOf(row)
└─ prisma.$transaction (timeout 60 giây)
    ├─ ⤷ DB import_batches: updateMany PENDING → PROCESSED (columnMapping, số đếm, errorMessage = serializeImportErrors(),
    │                         tempFileKey = null, aiAnalysis = DbNull)
    │   ✗ 0 dòng (đã xác nhận ở yêu cầu khác) → false
    ├─ ⤷ DB transactions: createMany từng khối 1000 dòng
    └─ ⤷ DB accounts: updateMany currentBalance increment tổng thu − chi
├─ imports/storage.ts › deleteImportFile(tempFileKey)
⇒ true | false
```

`rowCategoryPicker(userId, defaults, picked, suggested)` (cũng trong `handlers/imports.ts`): `⤷ DB categories: findMany`, kiểm tra danh mục mặc định đúng loại (✗ → `{ errors: { expenseCategoryId | incomeCategoryId } }`), rồi trả hàm `categoryOf(row)`: người dùng chọn → AI gợi ý → mặc định theo loại.

### `POST /api/imports/:id/confirm`: xác nhận khi ghép cột tay

```text
handlers/imports.ts › confirmImport(batchId, _prev, formData)
├─ requireUser(), getI18n()
├─ formText() cho MAPPING_FIELDS (headerRow, dateColumn, dateFormat, amountMode, amountColumn, debitColumn,
│  creditColumn, descriptionColumn, decimalSeparator, expenseCategoryId, incomeCategoryId)
├─ idSchema.safeParse()                                   ✗ → { message: "Không tìm thấy lần nhập." }
├─ validations/import.ts › mappingSchema.safeParse()      superRefine theo amountMode   ✗ → { errors }
├─ loadPendingBatch(id, userId)  ⤷ DB import_batches: findFirst PENDING kèm ví
│   ✗ không có / không có file → { message: "Lần nhập này không còn chờ xác nhận." }
│   ✗ ví đã lưu trữ → { message }
├─ rowCategoryPicker(userId, defaults, {}, {})            ✗ → { errors }
├─ imports/storage.ts › readImportFile(tempFileKey)       ✗ null → { message: "File tạm đã bị xóa…" }
├─ imports/parse-file.ts › parseStatementFile()
├─ imports/mapping.ts › buildRows(table, mapping)         parseDate(), parseAmount() từng dòng
│   ✗ 0 dòng → { message: câu hướng dẫn + @fm/shared/imports › formatImportErrors(serializeImportErrors(errors)) }
├─ writeImport(…)                                         ✗ false → { message }
└─ redirect(`/imports/${batch.id}`)
```

**Trả về:** `200 { redirect: "/imports/<id>" }`.

### `POST /api/imports/:id/confirm-document`: xác nhận khi AI đã đọc

```text
handlers/imports.ts › confirmDocumentImport(batchId, _prev, formData)
├─ requireUser()
├─ submittedRowCategories(formData)                       các trường rowCategory-<số dòng>, tối đa 500
├─ idSchema.safeParse()                                   ✗ → { message }
├─ validations/import.ts › documentConfirmSchema          ✗ → { errors }
├─ loadPendingBatch() + imports/analysis.ts › readAnalysis()   ✗ không phải kind "document" → { message }
├─ ví đã lưu trữ                                          ✗ → { message }
├─ rowCategoryPicker(userId, parsed, picked, analysis.categories)   ✗ → { errors }
├─ writeImport(user, batch, analysis.rows, analysis.errors, categoryOf, { source: "ai-document", … })   ✗ false → { message }
└─ redirect(`/imports/${batch.id}`)
```

**Trả về:** `200 { redirect: "/imports/<id>" }`; bị từ chối thì `state` giữ cả `rowCategories` người dùng đã chọn.

### `POST /api/imports/:id/cancel`

```text
handlers/imports.ts › cancelImport(formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → return (200 {})
├─ ⤷ DB import_batches: findFirst PENDING
├─ ⤷ DB import_batches: deleteMany PENDING
├─ đã xóa và có file → imports/storage.ts › deleteImportFile()
└─ redirect("/imports")
```

**Trả về:** `200 { redirect: "/imports" }`.

### `POST /api/imports/:id/rollback`: hoàn tác cả lô

```text
handlers/imports.ts › rollbackImport(_prev, formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → { message: "Không tìm thấy lần nhập." }
└─ prisma.$transaction (timeout 60 giây)
    ├─ $queryRaw SELECT … FROM "import_batches" … status PROCESSED FOR UPDATE   ✗ → { message: "Lần nhập này không thể hoàn tác." }
    ├─ $queryRaw SELECT … FROM "transactions" … FOR UPDATE
    ├─ ⤷ DB transactions: findMany của lô
    ├─ có dòng updatedAt ≠ createdAt (đã sửa tay)          ✗ → { message: "Có {0} giao dịch … đã được sửa tay…" }
    ├─ removeBatchTransactions(tx, batchId, userId, rows)
    │   ├─ gom chênh lệch theo ví → ⤷ DB accounts: updateMany currentBalance increment
    │   └─ ⤷ DB transactions: deleteMany importBatchId
    └─ ⤷ DB import_batches: updateMany status = ROLLED_BACK
```

**Trả về:** `200 {}` hoặc `200 { state: { message } }`.

### `DELETE /api/imports/:id`: xóa lần nhập ở mọi trạng thái

```text
handlers/imports.ts › deleteImport(_prev, formData)
├─ requireUser(), idSchema.safeParse(form.id)             ✗ → { message: "Không tìm thấy lần nhập." }
├─ prisma.$transaction (timeout 60 giây)
│   ├─ $queryRaw SELECT "tempFileKey" … FOR UPDATE        ✗ không có → undefined → { message }
│   ├─ $queryRaw SELECT … FROM "transactions" … FOR UPDATE
│   ├─ ⤷ DB transactions: findMany
│   ├─ removeBatchTransactions(…)                         xóa cả giao dịch đã sửa tay, trả tiền về số dư
│   └─ ⤷ DB import_batches: deleteMany
│   ⇒ tempFileKey
├─ có file → imports/storage.ts › deleteImportFile()
└─ redirect("/imports")
```

**Trả về:** `200 { redirect: "/imports" }`.

---

## 13. Quản trị

Tài liệu nghiệp vụ: [admin-flow.md](admin-flow.md). Mọi route bắt đầu bằng `requireAdmin()`: người không phải admin nhận `404` như thể trang không tồn tại.

### `GET /api/admin/categories` và `GET /api/admin/categories/:id`

```text
views/categories.ts › adminCategoriesView()
├─ requireAdmin()
└─ ⤷ DB categories: findMany({ userId: null })            không bao giờ đọc danh mục riêng của người dùng

views/categories.ts › adminCategoryView(categoryId)
├─ requireAdmin(), idSchema.safeParse()                   ✗ → 404
└─ ⤷ DB categories: findFirst({ id, userId: null })       ✗ → 404
```

**Trả về:** `200 [{ id, systemKey, name, type, icon, color }]` và `200 { id, systemKey, name, type, icon, color }`.

### `POST /api/admin/categories`

```text
handlers/admin-categories.ts › createSystemCategory(_prev, formData)
├─ requireAdmin()
├─ validations/category.ts › createSystemCategorySchema   systemKey: ^[a-z][a-z0-9_]{1,39}$   ✗ → { errors }
├─ isSystemNameTaken(type, name)   ⤷ DB categories: findFirst userId null   ✗ → { errors: { name } }
└─ ⤷ DB categories: create                                ✗ P2002 → { errors: { systemKey: ["Mã này đã được dùng."] } }
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `PUT /api/admin/categories/:id`

```text
handlers/admin-categories.ts › updateSystemCategory(categoryId, _prev, formData)
├─ requireAdmin(), idSchema.safeParse()                   ✗ → { message }
├─ updateSystemCategorySchema  (name, icon, color; systemKey không đổi)   ✗ → { errors }
├─ ⤷ DB categories: findFirst({ id, userId: null })       ✗ → { message }
├─ isSystemNameTaken(…, exceptId)                         ✗ → { errors: { name } }
├─ ⤷ DB categories: updateMany
└─ redirect("/admin/categories")
```

**Trả về:** `200 { redirect: "/admin/categories" }`.

### `DELETE /api/admin/categories/:id`

```text
handlers/admin-categories.ts › deleteSystemCategory(_prev, formData)
├─ requireAdmin(), idSchema.safeParse(form.id)            ✗ → { message }
├─ ⤷ DB categories: deleteMany({ id, userId: null, transactions: none, budgets: none })
└─ 0 dòng mà vẫn tồn tại → { message: "Danh mục đang được người dùng sử dụng nên chưa thể xóa." }
```

**Trả về:** `200 {}` hoặc `200 { state: { message } }`.

### `GET /api/admin/exchange-rates`

```text
views/exchange-rates.ts › adminExchangeRatesView()
├─ requireAdmin()
├─ exchange.ts › refreshRates()
└─ Promise.all
    ├─ ⤷ DB exchange_rates: findMany distinct quoteCurrency (mới nhất mỗi loại tiền)
    └─ ⤷ DB exchange_rates: findMany isManual, 100 dòng
└─ @fm/shared/dates › todayIsoDate()
```

**Trả về:** `200 { latest: [{ id, quoteCurrency, rate, date, isManual }], manual: [{ id, quoteCurrency, rate, date }], today }`.

### `POST /api/admin/exchange-rates`: nhập tỷ giá tay

```text
handlers/admin-exchange-rates.ts › setManualRate(_prev, formData)
├─ requireAdmin()
├─ validations/exchange-rate.ts › manualRateSchema        quoteCurrency ∈ @fm/shared/rates › QUOTE_CURRENCIES   ✗ → { errors }
├─ isoDateToDate(date)
└─ prisma.$transaction
    ├─ ⤷ DB exchange_rates: upsert (USD → quoteCurrency, ngày) isManual = true
    └─ exchange.ts › recomputeConversions(tx, { onlyMissing: true })
⇒ { success: true }
```

**Trả về:** `200 { state: { success: true } }`.

### `DELETE /api/admin/exchange-rates/:id`

```text
handlers/admin-exchange-rates.ts › deleteManualRate(formData)
├─ requireAdmin(), idSchema.safeParse(form.id)            ✗ → return
└─ ⤷ DB exchange_rates: deleteMany({ id, isManual: true })  tỷ giá tự động không xóa được
```

**Trả về:** `200 {}`.

---

## 14. Chatbot AI

Tài liệu nghiệp vụ: [chat-flow.md](chat-flow.md). Route viết tay vì câu trả lời được **truyền dần** (NDJSON, mỗi dòng một JSON).

### `POST /api/chat`

```text
routes.ts › router.post("/chat", chat)
└─ handlers/chat.ts › chat(req, res)
    ├─ requireUser()
    ├─ ai/client.ts › aiAvailable()                       ✗ → throw HttpError(503, "Trợ lý AI chưa được cấu hình…")
    ├─ bodySchema.safeParse(req.body)                     ≤ 20 tin, mỗi tin ≤ 4000 ký tự, tổng ≤ 12.000, tin cuối của user
    │   ✗ → throw HttpError(400, "Tin nhắn không hợp lệ.")
    ├─ ai/client.ts › takeHourlyQuota("chat", userId, 40) ✗ → throw HttpError(429, …)
    ├─ ai/client.ts › assertAiBudget(userId)              ✗ AiBudgetError → throw HttpError(429, BUDGET_MESSAGE)
    ├─ getI18n() → systemPrompt(user, language, t)
    ├─ AbortController; res.on("close") → abort           người dùng đóng khung chat thì dừng gọi AI
    ├─ ai/client.ts › aiModel().chat({ system, messages, tools: ai/chat-tools.ts › CHAT_TOOLS, maxTokens: 2000, signal })
    │   ⇒ ChatSession (interface trong ai/model.ts), cài đặt ở anthropicModel.chat() hoặc openAiModel.chat()
    ├─ res.writeHead(200, content-type: application/x-ndjson)
    ├─ vòng lặp round = 0…6 (MAX_TOOL_ROUNDS)
    │   ├─ round > 0 → assertAiBudget(userId)
    │   ├─ session.next({ allowTools: round < 6, onText })
    │   │   anthropic: SDK messages.stream(…).on("text", onText).finalMessage()
    │   │   openai:    SDK responses.stream(…).on("response.output_text.delta", onText)
    │   │   onText → send({ type: "text", text })         ghi ngay một dòng NDJSON
    │   │   ⇒ { tokens, toolCalls }
    │   ├─ ai/client.ts › recordAiUsage(userId, tokens)
    │   ├─ không có toolCalls → thoát vòng lặp
    │   ├─ mỗi toolCall → ai/chat-tools.ts › runChatTool(user, name, input)
    │   │   ├─ tên lạ → { content: "Unknown tool.", isError: true }
    │   │   ├─ inputs[name].safeParse(input)              Zod   ✗ → { content: "Invalid input: …", isError: true }
    │   │   └─ object handlers[name](user, input)          luôn dùng user của phiên, không lấy từ AI
    │   │       get_month_summary  → data/reports.ts › getMonthReport()
    │   │       get_monthly_trend  → data/reports.ts › getMonthlyTrend()
    │   │       get_budgets        → data/budgets.ts › getBudgetStatuses()
    │   │       list_transactions  → listTransactions()   ⤷ DB categories (tìm theo tên đã dịch), transactions: count + findMany ≤ 50
    │   │       get_accounts       → ⤷ DB accounts: findMany
    │   │       get_savings_goals  → ⤷ DB savings_goals: findMany
    │   │       ⇒ { content: JSON.stringify(kết quả), isError: false }
    │   └─ session.answer(results)                        đưa kết quả công cụ vào cuộc hội thoại cho vòng sau
    ├─ send({ type: "done" })
    ├─ lỗi khi đang truyền (người dùng chưa đóng):
    │   ai/client.ts › aiFailure(error) → ai/messages.ts › AI_FAILURE_MESSAGES[auth | billing | busy]
    │   send({ type: "error", message })                   không ghi nội dung hội thoại vào log
    └─ finally res.end()
```

**Trả về:** `200 application/x-ndjson`, các dòng `{"type":"text","text":"…"}` rồi `{"type":"done"}` hoặc `{"type":"error","message":"…"}`. Bị từ chối trước khi bắt đầu truyền: `400 | 401 | 429 | 503 { message }`.

---

## 15. Việc chạy nền

Không có route; chạy bên trong tiến trình backend.

```text
server.ts → maintenance.ts › startMaintenance()
├─ interval = env.ts › positiveIntegerFromEnv("MAINTENANCE_INTERVAL_MS", 1 giờ)
├─ setTimeout(runOnce, min(interval, 30 giây)).unref()    lần đầu ngay sau khi khởi động
└─ setInterval(runOnce, interval).unref()

maintenance.ts › runOnce()
├─ removeStaleImports()
│   ├─ ⤷ DB import_batches: findMany PENDING tạo quá 1 ngày
│   ├─ mỗi lô: ⤷ DB import_batches: deleteMany PENDING (kiểm tra lại) → imports/storage.ts › deleteImportFile()
│   ├─ ⤷ DB import_batches: findMany các tempFileKey còn được tham chiếu
│   └─ imports/storage.ts › listImportFiles() → xóa file không ai tham chiếu và cũ hơn 1 ngày
├─ rate-limit.ts › pruneRateLimits()                      ⤷ DB rate_limits: deleteMany windowStart cũ hơn 2 ngày
├─ có xóa gì → console.log("Maintenance: removed …")
└─ lỗi → console.error("Maintenance failed", message)    không làm sập máy chủ
```

**Trả về:** không có; kết quả chỉ nằm trong log của backend.
