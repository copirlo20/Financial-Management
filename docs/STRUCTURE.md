# Cấu trúc chương trình

Dự án chia thành ba phần chạy độc lập, một gói dùng chung, bộ kiểm thử và tài liệu, tất cả cùng cấp ở thư mục gốc. Bốn gói
`frontend`, `backend`, `database`, `shared` là các **npm workspaces** (một `node_modules` chung).

```
Financial Management/
├── frontend/     Next.js: trang, component, Server Action (chỉ giao diện, không có nghiệp vụ)
├── backend/      Express: API, nghiệp vụ, xác thực, AI, đọc file sao kê, sao kê PDF
├── database/     Prisma: schema, migration, seed, client đã sinh
├── shared/       Mã thuần dùng chung cho frontend và backend (bản dịch, định dạng tiền/ngày, nhãn, hằng số)
├── tests/        Kiểm thử đầu-cuối (chạy cả hệ thống), trình duyệt thật, máy chủ AI giả (Claude, OpenAI)
├── scripts/      dev.mjs: chạy backend + frontend cùng lúc
├── docs/         PRD, kiến trúc, kế hoạch, luồng hoạt động từng chức năng (*-flow.md; mục lục ở mục Tài liệu của README)
├── .agents/      Hướng dẫn Prisma cho trợ lý AI (.claude/skills là liên kết tới đây, không commit; skills-lock.json ghi phiên bản)
├── CLAUDE.md     Hướng dẫn và quy ước bắt buộc cho trợ lý AI khi làm việc trong dự án
├── README.md     Giới thiệu, chức năng, API, cách chạy, kiểm thử
├── .env          Một file cấu hình cho cả dự án (DATABASE_URL, AUTH_SECRET, khóa AI...), không commit
├── eslint.config.mjs  Luật lint cho tests/ và scripts/ (mỗi gói có file riêng)
└── package.json  Gốc của npm workspaces (các lệnh dưới đây chạy ở đây)
```

## Ai gọi ai

```
Trình duyệt ──► frontend (Next.js, cổng 3000) ──► backend (Express, cổng 4000) ──► database (PostgreSQL)
                                                        ├──► backend/storage/imports  (file sao kê tạm)
                                                        ├──► open.er-api.com          (tỷ giá)
                                                        └──► Claude hoặc OpenAI       (đọc sao kê, chatbot; tùy chọn)
```

- **Trình duyệt chỉ nói chuyện với frontend.** Frontend gọi backend ở phía server (Server Component, Server Action,
  route handler). Backend mặc định chỉ nghe ở `127.0.0.1` (đổi bằng `HOST`), không cần CORS.
- **Frontend không chạm database và không có bí mật nào.** Nó chỉ cần biết `BACKEND_URL`. Luật ESLint trong
  `frontend/eslint.config.mjs` chặn import mã từ backend, database, `@prisma/*`, `pg` (chỉ được import *kiểu dữ liệu* từ backend).
- **Backend là nơi duy nhất kiểm tra quyền và validate (Zod).** Frontend ẩn/hiện giao diện theo vai trò, nhưng mọi
  route của backend tự kiểm tra lại.
- **Chỉ backend import gói database.**

Chi tiết đường đi của một yêu cầu: [request-flow.md](request-flow.md). Kiến trúc tổng thể, schema, phân quyền: [ARCHITECTURE.md](ARCHITECTURE.md).

## frontend/

| Thư mục / file | Vai trò |
| --- | --- |
| `app/(app)/` | Các trang sau đăng nhập, mỗi chức năng một thư mục: `dashboard`, `transactions`, `budgets`, `savings`, `imports`, `accounts`, `categories`, `settings`, `admin`; kèm `layout.tsx` (thanh bên, thanh dưới), `error.tsx`, `not-found.tsx` |
| `app/(auth)/` | Đăng nhập, đăng ký |
| `app/actions/` | Server Action: nhận form, chuyển nguyên sang một route của backend bằng `command()`; không có nghiệp vụ |
| `app/api/chat/`, `app/(app)/imports/template/`, `app/(app)/transactions/statement/` | Route chuyển tiếp: luồng chat, tải file mẫu, tải sao kê PDF |
| `app/layout.tsx`, `globals.css`, `global-error.tsx` | Layout gốc (ngôn ngữ, giao diện sáng/tối), biến màu và biến thể `dark`, trang lỗi cuối cùng |
| `proxy.ts` | Chạy trước mọi yêu cầu: làm mới access token hết hạn, đẩy khách chưa đăng nhập về `/login`, đặt `Content-Security-Policy` (nonce) và HSTS |
| `next.config.ts` | Header bảo mật cố định, giới hạn tải lên của Server Action, `allowedDevOrigins` (tự lấy mọi IPv4 của máy) |
| `instrumentation-client.ts` | Chạy trong trình duyệt trước khi trang hydrate. Lúc phát triển, bỏ cảnh báo hydration chỉ do Chrome trên iPhone gắn thuộc tính `__gcr…` cho tính năng tự điền; mọi khác biệt khác vẫn được báo |
| `lib/api/` | `client.ts` gọi backend kèm token, ngôn ngữ, địa chỉ client (`formCommand`/`formUpload` báo mất kết nối ngay trên form); `retry.ts` thử lại khi backend khởi động lại; `backend-url.ts` địa chỉ backend (dùng chung với `proxy.ts`); `wire.ts` khôi phục số thập phân và ngày |
| `lib/auth/` | Cookie phiên đăng nhập; `dal.ts` hỏi backend "ai đang đăng nhập, AI nào đang bật" |
| `lib/i18n/`, `lib/theme.ts`, `lib/savings.ts` | Ngôn ngữ phía server; giao diện sáng/tối; tính tiến độ tiết kiệm |
| `components/` | Thành phần dùng chung: điều hướng, khung chat, hộp xác nhận, lớp phủ chờ, chuyển ngôn ngữ và giao diện, thanh tiến độ ngân sách, biểu tượng danh mục, thông báo của form (`form-message.tsx`) và của từng ô (`field-error.tsx`), danh sách tiền tệ (`currency-options.tsx`)… |
| `components/ui/` | Thành phần nền kiểu shadcn/ui: `button`, `card`, `input`, `label`, `alert-dialog`, `chart` |

## backend/

| Thư mục / file | Vai trò |
| --- | --- |
| `src/server.ts`, `app.ts`, `routes.ts`, `env.ts`, `time.ts` | Khởi động, middleware (đọc JSON và file, nạp người dùng và ngữ cảnh), **bảng toàn bộ route** (`/api/...`), nạp `.env` ở thư mục gốc và đọc giới hạn dạng số từ đó (`positiveIntegerFromEnv`), hằng thời gian (`MINUTE_MS`, `HOUR_MS`, `DAY_MS`) |
| `src/http/` | Ngữ cảnh yêu cầu (`AsyncLocalStorage`: người dùng, ngôn ngữ, địa chỉ), `command()` và `view()`, mã hóa JSON (`$decimal`, `$date`), lỗi HTTP |
| `src/handlers/` | Thao tác **ghi** (tạo, sửa, xóa), mỗi file một nhóm nghiệp vụ |
| `src/views/` | Truy vấn **đọc** cho từng trang |
| `src/auth/` | Băm mật khẩu, JWT, refresh token và phiên, người dùng hiện tại, giới hạn đăng nhập (`throttle.ts`) |
| `src/data/` | Truy vấn dùng chung: tổng hợp báo cáo, trạng thái ngân sách, lựa chọn cho form |
| `src/exchange.ts` | Tỷ giá, quy đổi, tính lại bản chụp quy đổi |
| `src/reports/` | Sao kê PDF: `statement.ts` tính số liệu, `statement-pdf.ts` vẽ bằng `pdfkit` |
| `src/imports/` | Đọc CSV/Excel, chống "zip bomb", ghép cột, lưu file tạm, file mẫu, đọc bằng AI |
| `src/ai/` | Giao diện AI chung (`model.ts`) với hai bản cài đặt (`anthropic.ts`, `openai.ts`), chọn nhà cung cấp và hạn mức token (`client.ts`), công cụ của chatbot, thông báo lỗi |
| `src/validations/` | Schema Zod cho từng chức năng |
| `src/rate-limit.ts`, `limits.ts`, `maintenance.ts`, `i18n.ts` | Bộ đếm giới hạn (bảng `rate_limits`), giới hạn số lượng mỗi người, dọn dẹp định kỳ, dịch thông báo theo ngôn ngữ yêu cầu |
| `assets/fonts/` | Font Noto Sans (giấy phép OFL) nhúng vào PDF |
| `storage/imports/` | File sao kê tạm (không commit); tên là UUID |

## shared/src/

Mã thuần (không phụ thuộc React hay Node), dùng ở cả hai phía:

| File | Nội dung |
| --- | --- |
| `i18n/` | `config.ts` (ngôn ngữ), `translate.ts`, `en.ts` (bản dịch tiếng Anh; câu tiếng Việt là khóa) |
| `currencies.ts`, `rates.ts`, `dates.ts`, `months.ts` | Danh sách tiền tệ và định dạng tiền; gốc tỷ giá; múi giờ và định dạng ngày; tháng |
| `wire.ts`, `auth.ts`, `form-state.ts` | Kiểu dữ liệu đường truyền và header; tên cookie, thời hạn token; kiểu trạng thái form |
| `labels.ts`, `category-icons.ts`, `ai.ts`, `imports.ts`, `reports.ts` | Nhãn trạng thái; 30 biểu tượng danh mục; nhà cung cấp AI; mã lỗi nhập sao kê; giới hạn và mã lỗi sao kê PDF |

## database/

`prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.sql` (18 danh mục hệ thống), `prisma.config.ts`. `src/index.ts` xuất `prisma`
(một kết nối) và các kiểu đã sinh. Thư mục `src/generated/` do `npm run db:generate` tạo ra, không commit.

## tests/

| Thư mục / file | Nội dung |
| --- | --- |
| `run-e2e.mjs` | Trình chạy: build frontend, dựng backend và frontend trên cổng riêng cùng máy chủ AI giả, chạy từng bộ, dọn dữ liệu. Dựng thêm một bản app dùng OpenAI để chạy lại các bộ AI |
| `e2e/*.e2e.mjs` | Bộ kiểm thử qua HTTP như trình duyệt không có JavaScript (biểu mẫu, cookie, chuyển hướng), kiểm cả trang lẫn database |
| `e2e/harness.mjs` | Phần dùng chung của các bộ e2e: cấu hình, `check()`/`report()`, đọc trang và form, gửi form (`submit`, cả file), cookie, đăng ký người dùng, kết nối database |
| `browser/*.browser.mjs`, `cdp.mjs` | Bộ kiểm thử trong Edge/Chrome thật qua DevTools Protocol: biểu đồ, modal, giao diện tối, điện thoại |
| `mock-ai.mjs` | Máy chủ giả của Claude và OpenAI: không bao giờ gọi API thật |
| `pdf-text.mjs` | Đọc chữ trong PDF do app xuất, để kiểm số liệu |

Mô tả từng bộ và cách trình chạy hoạt động: [testing.md](testing.md). Phương pháp và thuật toán của từng chức năng: [algorithms.md](algorithms.md).

## Quy ước API

- `GET /api/...` (`view`): trả dữ liệu cho một trang; `404` khi không có hoặc không thuộc về user.
- `POST|PUT|DELETE /api/...` (`command`): nhận `{ fields: [[tên, giá trị], ...] }` (các trường của form) và trả
  `{ state, redirect?, tokens?, locale? }`. `state` quay về form; `redirect`, `tokens`, `locale` là việc frontend
  làm hộ trình duyệt (chuyển trang, đặt cookie).
- Xác thực: `Authorization: Bearer <access token>`. Ngôn ngữ: header `x-locale`.
- Số tiền và ngày trong JSON được gắn nhãn (`{"$decimal": "..."}`, `{"$date": "..."}`) để không mất độ chính xác.
- Ngoại lệ: `GET /reports/statement` và `/imports/template` trả file; `POST /chat` trả luồng NDJSON; `POST /imports` nhận file làm thân request.

Bảng route đầy đủ ở [api.md](api.md).

## Lệnh (chạy ở thư mục gốc)

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Chạy backend (tự nạp lại khi sửa) và frontend. |
| `npm run build` | Build frontend. |
| `npm start` | Chạy bản production của cả hai (cần `npm run build` trước). |
| `npm test` | Build, chạy cả hệ thống trên cổng riêng, chạy mọi bộ kiểm thử. `npm test -- auth budgets` chạy các bộ có tên chứa các từ đó. |
| `npm run test:dev` | Chạy các bộ kiểm thử với server đang chạy ở `http://localhost:3000` (không chạy các bộ AI). |
| `npm run lint`, `npm run typecheck` | Kiểm tra mọi gói (lint gồm cả `tests/` và `scripts/`). |
| `npm run db:migrate` | Tạo/áp migration khi sửa schema (`prisma migrate dev`). |
| `npm run db:deploy`, `db:generate`, `db:seed` | Áp migration, sinh lại client, nạp danh mục mặc định. |

## Biến môi trường

Một file `.env` ở thư mục gốc, cả backend lẫn công cụ đều đọc. **Bắt buộc**: `DATABASE_URL`, `AUTH_SECRET` (từ 32 ký tự).
Tùy chọn: khóa và mô hình AI (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_PROVIDER`…), hạn mức (`AI_DAILY_TOKEN_BUDGET`, `AUTH_LIMIT_PER_IP`…),
cổng (`PORT` cho frontend mặc định 3000, `BACKEND_PORT` mặc định 4000, `HOST`, `BACKEND_URL`; `npm run dev` tự đặt `BACKEND_URL`).
Bảng đầy đủ với giá trị mặc định: mục [Cấu hình](../README.md#cau-hinh) của README.

## Thêm một tính năng

1. Sửa schema nếu cần (`database/`), chạy `npm run db:migrate`.
2. Viết handler hoặc view trong `backend/src`, kèm schema Zod trong `validations/`, đăng ký trong `routes.ts`. Mọi truy vấn lọc theo `userId` của phiên.
3. Thêm Server Action một dòng trong `frontend/app/actions` (nếu là thao tác ghi) và trang/component hiển thị. Tải file hoặc luồng dài thì thêm route chuyển tiếp.
4. Thêm câu tiếng Anh vào `shared/src/i18n/en.ts` cho mọi câu tiếng Việt mới.
5. Thêm kiểm thử trong `tests/` (kể cả truy cập chéo giữa hai người dùng).
6. Viết hoặc cập nhật tài liệu luồng của chức năng (`docs/<chức năng>-flow.md`, theo mẫu của các file có sẵn) và thêm vào bảng "Luồng hoạt động của từng chức năng" trong mục Tài liệu của `README.md`.
