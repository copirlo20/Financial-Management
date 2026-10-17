# Tài liệu API

Backend nghe ở `http://127.0.0.1:4000`, mọi route nằm dưới tiền tố **`/api`**.

> **Quyền:** 🌐 công khai · 👤 cần đăng nhập · 🛡️ chỉ admin (người khác nhận `404`)

## 📐 Quy ước chung

| Mục          | Quy ước                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| 🔑 Xác thực  | `Authorization: Bearer <accessToken>` (sống 15 phút, làm mới bằng `/api/auth/refresh`)  |
| 🌍 Ngôn ngữ  | Header `x-locale: vi` hoặc `en` (mặc định `vi`)                                         |
| 📦 Định dạng | JSON. Riêng tải file là `application/octet-stream`, chat trả luồng NDJSON               |
| 💰 Số tiền   | Chuỗi thập phân, response gắn nhãn `{"$decimal": "1250000.50"}`                         |
| 📅 Ngày      | Response `{"$date": "…"}`; request `YYYY-MM-DD` (ngày) hoặc `YYYY-MM` (tháng)           |
| 🆔 Id        | UUID. Id sai hoặc của người khác đều cho kết quả như nhau: đọc → `404`, ghi → `message` |
| 📏 Giới hạn  | JSON ≤ 1 MB · file tải lên ≤ 5 MB và ≤ 10.000 dòng                                      |

## 🔁 Hai loại route

| Loại    | Method                    | Thành công                                           |
| ------- | ------------------------- | ---------------------------------------------------- |
| **Đọc** | `GET`                     | `200` + dữ liệu của trang. Không có dữ liệu → `404`. |
| **Ghi** | `POST` / `PUT` / `DELETE` | `200` + `{ state?, redirect?, tokens?, locale? }`    |

Body của route ghi là các trường của form, dạng cặp `[tên, giá trị]` (tham số `:id` được gộp vào với tên `id`):

```json
{
  "fields": [
    ["name", "Vietcombank"],
    ["type", "BANK"],
    ["currency", "VND"],
    ["initialBalance", "5000000"]
  ]
}
```

Lỗi nhập liệu và lỗi nghiệp vụ **vẫn là HTTP `200`**, nằm trong `state` để hiện ngay dưới form:

| Kết quả                 | Response                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| ✅ Đã lưu               | `{ "state": { "success": true } }`                                                          |
| ➡️ Đã lưu, chuyển trang | `{ "redirect": "/accounts" }`                                                               |
| ✅ Thao tác một chạm    | `{}`                                                                                        |
| 🔑 Đăng nhập, đăng ký   | `{ "redirect": "/dashboard", "tokens": { "accessToken", "refreshToken" }, "locale": "vi" }` |
| 🚪 Đăng xuất            | `{ "redirect": "/login", "tokens": null }`                                                  |
| ⚠️ Sai một trường       | `{ "state": { "errors": { "name": ["…"] }, "values": { … } } }`                             |
| ⛔ Vi phạm nghiệp vụ    | `{ "state": { "message": "…", "values": { … } } }`                                          |

## 🚦 Mã lỗi HTTP

|  Mã   | Body                              | Khi nào                                                                   |
| :---: | --------------------------------- | ------------------------------------------------------------------------- |
| `200` | tùy route                         | Thành công, kể cả khi nội dung form sai (xem `state`)                     |
| `400` | `{ "message": "Bad request" }`    | Body JSON hỏng; `/api/chat` và file mẫu có thông báo riêng                |
| `401` | `{ "message": "Not signed in" }`  | Thiếu hoặc sai token, hoặc tài khoản bị khóa                              |
| `404` | `{ "message": "Not found" }`      | Không có bản ghi, không thuộc về bạn, hoặc route admin gọi bởi người khác |
| `413` | `{ "message": "Bad request" }`    | Body quá lớn                                                              |
| `429` | `{ "message": "…" }`              | Chat: quá 40 tin/giờ hoặc hết hạn mức token AI trong ngày                 |
| `503` | `{ "message": "…" }`              | Chat khi chưa cấu hình khóa AI                                            |
| `500` | `{ "message": "Internal error" }` | Lỗi không lường trước (chi tiết chỉ nằm trong log)                        |

---

## 🔐 Xác thực & phiên

| Method | Endpoint                      | Quyền | Mô tả                               | Tham số / Trả về                                                                 |
| :----: | ----------------------------- | :---: | ----------------------------------- | -------------------------------------------------------------------------------- |
| `POST` | `/api/auth/register`          |  🌐   | Đăng ký và đăng nhập luôn           | `name`, `email`, `password`, `confirmPassword`                                   |
| `POST` | `/api/auth/login`             |  🌐   | Đăng nhập                           | `email`, `password`, `next` (đường dẫn nội bộ để quay lại, tùy chọn)             |
| `POST` | `/api/auth/logout`            |  🌐   | Đăng xuất phiên này                 | Header `x-refresh-token`                                                         |
| `POST` | `/api/auth/logout-everywhere` |  👤   | Đăng xuất khỏi mọi thiết bị         | —                                                                                |
| `POST` | `/api/auth/refresh`           |  🌐   | Đổi refresh token lấy cặp token mới | `{ "refreshToken" }` → `{ tokens }`                                              |
| `GET`  | `/api/me`                     |  👤   | Người dùng hiện tại                 | → `{ user, aiProvider }` (`"anthropic"`, `"openai"` hoặc `null` nếu chưa bật AI) |
| `GET`  | `/api/health`                 |  🌐   | Kiểm tra backend còn sống           | → `{ "ok": true }`                                                               |

- Mật khẩu ≥ 8 ký tự, có chữ và số. Email đã có → `errors.email`.
- Sai email hoặc mật khẩu đều cho **một** thông báo, không lộ email có tồn tại hay không.
- Chống đoán mật khẩu: **5** lần sai/15 phút thì email bị khóa tạm · **30** lần thử/15 phút và **10** tài khoản mới/giờ cho mỗi địa chỉ.
- `next` ngoài đường dẫn nội bộ bị bỏ qua, chuyển về `/dashboard`.
- Refresh token xoay vòng; dùng lại token cũ sau 10 giây bị coi là lộ và **thu hồi mọi phiên**.

## ⚙️ Cài đặt & tỷ giá

| Method | Endpoint                               | Quyền | Mô tả                                      | Tham số / Trả về                                    |
| :----: | -------------------------------------- | :---: | ------------------------------------------ | --------------------------------------------------- |
| `GET`  | `/api/settings`                        |  👤   | Tỷ giá so với tiền tệ mặc định             | → `{ status, rates[] }`                             |
| `PUT`  | `/api/settings`                        |  👤   | Đổi họ tên, ngôn ngữ, tiền tệ mặc định     | `name`, `language` (`vi`/`en`), `defaultCurrency`   |
| `POST` | `/api/settings/language`               |  🌐   | Đổi ngôn ngữ                               | `language` → `{ locale }`                           |
| `PUT`  | `/api/settings/password`               |  👤   | Đổi mật khẩu                               | `currentPassword`, `newPassword`, `confirmPassword` |
| `POST` | `/api/settings/exchange-rates/refresh` |  👤   | Cập nhật tỷ giá ngay (cách nhau ≥ 10 phút) | —                                                   |

- Đổi tiền tệ mặc định thiếu tỷ giá → `errors.defaultCurrency`; đổi được thì quy đổi lại mọi giao dịch và hạn mức ngân sách.
- Đổi mật khẩu: các phiên **khác** bị đăng xuất; sai mật khẩu hiện tại tính vào giới hạn 5 lần.

## 👛 Tài khoản / ví

| Method | Endpoint                    | Quyền | Mô tả                        | Tham số / Trả về                                                                              |
| :----: | --------------------------- | :---: | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `GET`  | `/api/accounts`             |  👤   | Danh sách ví và tổng số dư   | → `{ accounts, totals[], converted }`                                                         |
| `GET`  | `/api/accounts/:id`         |  👤   | Một ví (để sửa)              | → `{ id, name, type, currency, initialBalance }`                                              |
| `POST` | `/api/accounts`             |  👤   | Tạo ví                       | `name`, `type` (`CASH`/`BANK`/`E_WALLET`/`CREDIT_CARD`/`OTHER`), `currency`, `initialBalance` |
| `PUT`  | `/api/accounts/:id`         |  👤   | Sửa tên, loại, số dư ban đầu | `name`, `type`, `initialBalance`                                                              |
| `POST` | `/api/accounts/:id/archive` |  👤   | Lưu trữ ví (giữ lịch sử)     | —                                                                                             |
| `POST` | `/api/accounts/:id/restore` |  👤   | Khôi phục ví đã lưu trữ      | —                                                                                             |

- Trùng tên (không phân biệt hoa thường) → `errors.name` · quá **50** ví → `message`.

## 🏷️ Danh mục

|  Method  | Endpoint              | Quyền | Mô tả                        | Tham số / Trả về                                                 |
| :------: | --------------------- | :---: | ---------------------------- | ---------------------------------------------------------------- |
|  `GET`   | `/api/categories`     |  👤   | Danh mục hệ thống và của bạn | → mảng `{ id, userId, parentId, name, type, icon, color }`       |
|  `GET`   | `/api/categories/:id` |  👤   | Một danh mục của bạn         | → `{ category, hasChildren, parents[] }`                         |
|  `POST`  | `/api/categories`     |  👤   | Tạo danh mục riêng           | `name`, `type` (`EXPENSE`/`INCOME`), `icon`, `color`, `parentId` |
|  `PUT`   | `/api/categories/:id` |  👤   | Sửa (không đổi `type`)       | `name`, `icon`, `color`, `parentId`                              |
| `DELETE` | `/api/categories/:id` |  👤   | Xóa danh mục riêng           | —                                                                |

- Chỉ một cấp danh mục con · tối đa **200** danh mục · danh mục đang được giao dịch hoặc ngân sách dùng thì chưa xóa được.

## 💸 Giao dịch & chuyển khoản

|  Method  | Endpoint                | Quyền | Mô tả                           | Tham số / Trả về                                                                               |
| :------: | ----------------------- | :---: | ------------------------------- | ---------------------------------------------------------------------------------------------- |
|  `GET`   | `/api/transactions`     |  👤   | Danh sách có lọc, 20 dòng/trang | Query `accountId`, `categoryId`, `type`, `from`, `to`, `page` → `{ transactions[], total, … }` |
|  `GET`   | `/api/transactions/:id` |  👤   | Một giao dịch thu/chi (để sửa)  | → `{ transaction, accounts, categoryOptions }`                                                 |
|  `POST`  | `/api/transactions`     |  👤   | Ghi một khoản thu hoặc chi      | `type`, `accountId`, `categoryId`, `amount`, `date`, `note`                                    |
|  `PUT`   | `/api/transactions/:id` |  👤   | Sửa giao dịch                   | như trên                                                                                       |
| `DELETE` | `/api/transactions/:id` |  👤   | Xóa giao dịch, hoàn lại số dư   | —                                                                                              |
|  `POST`  | `/api/transfers`        |  👤   | Chuyển tiền giữa hai ví của bạn | `fromAccountId`, `toAccountId`, `amount`, `toAmount`, `date`, `note`                           |

- Số dư ví được cập nhật trong cùng một transaction với giao dịch.
- Chuyển khoản khác tiền tệ bắt buộc có `toAmount` (số nhận) · xóa một bên của chuyển khoản thì xóa cả hai bên · chuyển khoản không sửa được.

## 📊 Ngân sách

|  Method  | Endpoint                     | Quyền | Mô tả                                        | Tham số / Trả về                                                  |
| :------: | ---------------------------- | :---: | -------------------------------------------- | ----------------------------------------------------------------- |
|  `GET`   | `/api/budgets`               |  👤   | Ngân sách của một tháng, đã tính mức chi     | Query `month` → `{ month, statuses[], availableCategories[], … }` |
|  `GET`   | `/api/budgets/:id`           |  👤   | Một ngân sách (để sửa)                       | → `{ id, amountLimit, currency, periodStart, category }`          |
|  `POST`  | `/api/budgets`               |  👤   | Đặt ngân sách cho một danh mục hoặc tổng chi | `month`, `categoryId` (rỗng = tổng), `amountLimit`                |
|  `POST`  | `/api/budgets/copy-previous` |  👤   | Sao chép ngân sách của tháng trước           | `month`                                                           |
|  `PUT`   | `/api/budgets/:id`           |  👤   | Đổi hạn mức                                  | `amountLimit`                                                     |
| `DELETE` | `/api/budgets/:id`           |  👤   | Xóa ngân sách                                | —                                                                 |

- Mỗi `status`: `ok` · `near` (≥ 80%) · `over` (> 100%). Mỗi mục chỉ có một ngân sách trong tháng.

## 🐷 Mục tiêu tiết kiệm

|  Method  | Endpoint                               | Quyền | Mô tả                              | Tham số / Trả về                                             |
| :------: | -------------------------------------- | :---: | ---------------------------------- | ------------------------------------------------------------ |
|  `GET`   | `/api/savings`                         |  👤   | Danh sách mục tiêu                 | → mảng `{ id, name, targetAmount, currentAmount, … }`        |
|  `GET`   | `/api/savings/:id`                     |  👤   | Một mục tiêu và 100 khoản gần nhất | → `{ …, contributions[] }`                                   |
|  `POST`  | `/api/savings`                         |  👤   | Tạo mục tiêu                       | `name`, `targetAmount`, `currency`, `deadline`               |
|  `PUT`   | `/api/savings/:id`                     |  👤   | Sửa tên, số tiền, hạn chót         | `name`, `targetAmount`, `deadline`                           |
|  `POST`  | `/api/savings/:id/contributions`       |  👤   | Gửi thêm hoặc rút bớt              | `direction` (`deposit`/`withdraw`), `amount`, `date`, `note` |
| `DELETE` | `/api/savings/contributions/:id`       |  👤   | Xóa một khoản gửi/rút              | —                                                            |
|  `POST`  | `/api/savings/:id/archive`, `/restore` |  👤   | Lưu trữ / khôi phục                | —                                                            |
| `DELETE` | `/api/savings/:id`                     |  👤   | Xóa mục tiêu cùng lịch sử          | —                                                            |

- Trạng thái: `IN_PROGRESS` → `COMPLETED` (đạt mục tiêu) · `ARCHIVED`. Rút quá số đã tiết kiệm → `errors.amount`. Tối đa **50** mục tiêu.

## 📈 Tổng quan

| Method | Endpoint         | Quyền | Mô tả                                 | Tham số / Trả về                                                       |
| :----: | ---------------- | :---: | ------------------------------------- | ---------------------------------------------------------------------- |
| `GET`  | `/api/dashboard` |  👤   | Số liệu trang Tổng quan của một tháng | Query `month` → `{ report, trend[], statuses[], recent[], converted }` |

## 📄 Sao kê PDF

| Method | Endpoint                 | Quyền | Mô tả                                   | Tham số / Trả về                                                                        |
| :----: | ------------------------ | :---: | --------------------------------------- | --------------------------------------------------------------------------------------- |
| `GET`  | `/api/reports/statement` |  👤   | Tải sao kê PDF của một khoảng thời gian | Query `from`, `to` (`YYYY-MM-DD`), `accountId` (rỗng = tất cả) → file `application/pdf` |

- Một ví: số liệu theo tiền tệ của ví. Tất cả: quy về tiền tệ mặc định; giao dịch chưa có tỷ giá được liệt kê nhưng không cộng vào tổng.
- Từ chối (`message` là mã lỗi): `invalid` ngày sai hoặc `from` > `to` · `range` quá 3 năm · `account` ví không có (`404`) · `rows` quá 3.000 giao dịch · `busy` quá 30 lần/giờ (`429`).

## 📥 Nhập sao kê

|  Method  | Endpoint                            | Quyền | Mô tả                                              | Tham số / Trả về                                                                                             |
| :------: | ----------------------------------- | :---: | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
|  `GET`   | `/api/imports`                      |  👤   | 50 lần nhập gần nhất và danh sách ví               | → `{ accounts, batches[], aiProvider }`                                                                      |
|  `GET`   | `/api/imports/template`             |  👤   | Tải file mẫu                                       | Query `format` = `csv` hoặc `xlsx`                                                                           |
|  `GET`   | `/api/imports/:id`                  |  👤   | Một lần nhập, kèm dữ liệu xem lại nếu đang chờ     | → `{ batch, pending }`                                                                                       |
|  `POST`  | `/api/imports`                      |  👤   | Tải file lên (body là nội dung file)               | Query `accountId`, `useAi`; header `x-file-name` → `redirect:/imports/{id}`                                  |
|  `POST`  | `/api/imports/:id/confirm`          |  👤   | Xác nhận file đã ghép cột (CSV/Excel không qua AI) | `headerRow`, `dateColumn`, `dateFormat`, `amountMode`, `amountColumn` hoặc `debitColumn` + `creditColumn`, … |
|  `POST`  | `/api/imports/:id/confirm-document` |  👤   | Xác nhận các dòng AI đã đọc (PDF hoặc qua AI)      | `expenseCategoryId`, `incomeCategoryId`, `rowCategory-{dòng}`                                                |
|  `POST`  | `/api/imports/:id/cancel`           |  👤   | Hủy lần nhập đang chờ                              | —                                                                                                            |
|  `POST`  | `/api/imports/:id/rollback`         |  👤   | Hoàn tác lần nhập đã ghi                           | —                                                                                                            |
| `DELETE` | `/api/imports/:id`                  |  👤   | Xóa lần nhập **và mọi giao dịch của nó**           | —                                                                                                            |

- `status`: `PENDING` · `PROCESSED` · `FAILED` · `ROLLED_BACK`. Lần nhập chờ quá **24 giờ** tự bị xóa.
- Tải lên thất bại (`errors.file`): sai định dạng (chỉ `.csv`, `.xlsx`, `.pdf`), quá 5 MB, file hỏng, quá 10.000 dòng, Excel giải nén quá 25 MB (chống "zip bomb"), PDF khi chưa bật AI.
- Giới hạn (`message`): tối đa **5** lần nhập chờ xác nhận · **20** lần phân tích AI/giờ · hạn mức token AI trong ngày. AI lỗi với CSV/Excel thì vẫn tạo lần nhập để ghép cột tay.
- Giao dịch trùng (cùng ví, ngày, số tiền, diễn giải) bị bỏ qua và đếm riêng · hoàn tác bị từ chối nếu có giao dịch đã sửa tay.

## 🤖 Chatbot AI

| Method | Endpoint    | Quyền | Mô tả                                       | Tham số / Trả về                                                                             |
| :----: | ----------- | :---: | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `POST` | `/api/chat` |  👤   | Hỏi trợ lý, trả lời **theo luồng** (NDJSON) | `{ "messages": [{ "role", "content" }] }` → các dòng `{"type":"text"}` rồi `{"type":"done"}` |

- `messages`: 1–20 tin, mỗi tin ≤ 4.000 ký tự, tổng ≤ 12.000 ký tự, tin cuối phải của `user`.
- Lỗi giữa chừng: `{"type":"error","message":"…"}` · `400` tin nhắn sai · `429` quá 40 tin/giờ hoặc hết hạn mức token · `503` chưa cấu hình AI.
- Trợ lý chỉ có **6 công cụ chỉ đọc** và luôn dùng dữ liệu của người đang đăng nhập. Chi tiết: [docs/chat-flow.md](chat-flow.md).

## 🛡️ Quản trị (chỉ admin)

|  Method  | Endpoint                        | Quyền | Mô tả                                  | Tham số / Trả về                                    |
| :------: | ------------------------------- | :---: | -------------------------------------- | --------------------------------------------------- |
|  `GET`   | `/api/admin/categories`         |  🛡️   | Danh mục mặc định của hệ thống         | → mảng `{ id, systemKey, name, type, icon, color }` |
|  `GET`   | `/api/admin/categories/:id`     |  🛡️   | Một danh mục mặc định                  | —                                                   |
|  `POST`  | `/api/admin/categories`         |  🛡️   | Tạo danh mục mặc định                  | `systemKey`, `name`, `type`, `icon`, `color`        |
|  `PUT`   | `/api/admin/categories/:id`     |  🛡️   | Sửa danh mục mặc định                  | `name`, `icon`, `color`                             |
| `DELETE` | `/api/admin/categories/:id`     |  🛡️   | Xóa danh mục mặc định                  | — (chưa xóa được nếu đã có người dùng)              |
|  `GET`   | `/api/admin/exchange-rates`     |  🛡️   | Tỷ giá mới nhất và các tỷ giá nhập tay | → `{ latest[], manual[], today }`                   |
|  `POST`  | `/api/admin/exchange-rates`     |  🛡️   | Nhập tay một tỷ giá                    | `quoteCurrency`, `date`, `rate` (1 USD = ?)         |
| `DELETE` | `/api/admin/exchange-rates/:id` |  🛡️   | Xóa một tỷ giá nhập tay                | —                                                   |

<details>
<summary><b>📌 Ví dụ gọi thử bằng curl</b></summary>

<br />

```bash
# 1. Đăng ký (trả về cặp token)
curl -s -X POST http://127.0.0.1:4000/api/auth/register \
  -H "content-type: application/json" \
  -d '{"fields":[["name","Nguyen Van A"],["email","a@example.com"],["password","matkhau123"],["confirmPassword","matkhau123"]]}'

# 2. Xem thông tin của mình (thay <ACCESS_TOKEN> bằng giá trị nhận được)
curl -s http://127.0.0.1:4000/api/me -H "authorization: Bearer <ACCESS_TOKEN>"

# 3. Tạo ví
curl -s -X POST http://127.0.0.1:4000/api/accounts \
  -H "authorization: Bearer <ACCESS_TOKEN>" -H "content-type: application/json" \
  -d '{"fields":[["name","Vietcombank"],["type","BANK"],["currency","VND"],["initialBalance","5000000"]]}'
# -> {"state":{"success":true}}

# 4. Gửi thiếu tên: lỗi nằm trong state, vẫn là HTTP 200
curl -s -X POST http://127.0.0.1:4000/api/accounts \
  -H "authorization: Bearer <ACCESS_TOKEN>" -H "content-type: application/json" \
  -d '{"fields":[["name",""],["type","BANK"],["currency","VND"],["initialBalance","0"]]}'
# -> {"state":{"errors":{"name":["Vui lòng nhập tên tài khoản."]},"values":{…}}}

# 5. Không có token: 401
curl -s -i http://127.0.0.1:4000/api/accounts
```

</details>

---

Xem thêm: [request-flow.md](request-flow.md) (cách một yêu cầu đi qua hệ thống), [ARCHITECTURE.md](ARCHITECTURE.md) (nhóm route và quy ước), và tài liệu luồng của từng chức năng để hiểu quy tắc nghiệp vụ đằng sau mỗi route.
