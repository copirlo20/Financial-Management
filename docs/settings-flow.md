# Luồng cài đặt

Trang **Cài đặt** có bốn thẻ: **Hồ sơ**, **Giao diện**, **Tỷ giá**, **Bảo mật**. Đường đi chung của yêu cầu xem [request-flow.md](request-flow.md).

## Thành phần

| Tầng | File |
| --- | --- |
| Trang | [frontend/app/(app)/settings/](../frontend/app/(app)/settings/): `page.tsx`, `settings-form.tsx`, `password-form.tsx`, `refresh-rates-button.tsx` |
| Server Action | [frontend/app/actions/settings.ts](../frontend/app/actions/settings.ts), [auth.ts](../frontend/app/actions/auth.ts) |
| Handler | [backend/src/handlers/settings.ts](../backend/src/handlers/settings.ts) |
| View | `settingsView` trong [backend/src/views/overview.ts](../backend/src/views/overview.ts) |
| Luật nhập liệu | [backend/src/validations/settings.ts](../backend/src/validations/settings.ts) |

## Hồ sơ (`PUT /api/settings`)

Sửa **họ tên** (1–100 ký tự), **ngôn ngữ** (`vi`, `en`) và **tiền tệ mặc định** (một trong 10 loại).

- Chỉ đổi tên hoặc ngôn ngữ: lưu ngay.
- **Đổi tiền tệ mặc định** là thao tác nặng, vì mọi bản chụp quy đổi của giao dịch và hạn mức mọi ngân sách đều biểu diễn bằng tiền tệ mặc định. App kiểm có đủ tỷ giá, rồi tính lại tất cả trong **một transaction**; thiếu tỷ giá thì từ chối và không đổi gì. Chi tiết và sơ đồ ở [currency-flow.md](currency-flow.md).
- Lưu xong, ngôn ngữ mới được áp ngay (cookie `locale`).

## Giao diện

Chọn **Sáng / Tối / Theo thiết bị**, lưu trong cookie của thiết bị này, không đi qua backend. Xem [ui-flow.md](ui-flow.md).

## Tỷ giá

Bảng tỷ giá hiện tại của mọi loại tiền so với tiền tệ mặc định, thời điểm cập nhật, và nguồn (ExchangeRate-API, bắt buộc ghi nguồn). Nút **Cập nhật tỷ giá** (`POST /api/settings/exchange-rates/refresh`) gọi nguồn ngay, nhưng **không quá một lần mỗi 10 phút**; kết quả là một trong ba thông báo: "Đã cập nhật tỷ giá.", "Tỷ giá vừa được cập nhật trong 10 phút qua.", "Không lấy được tỷ giá mới. Đang dùng tỷ giá đã lưu." Xem [currency-flow.md](currency-flow.md).

## Bảo mật

- **Đổi mật khẩu** (`PUT /api/settings/password`): kiểm mật khẩu hiện tại, mật khẩu mới theo luật đăng ký và khác mật khẩu cũ; **thu hồi mọi phiên khác**, giữ phiên đang dùng. Nhập sai mật khẩu hiện tại tính vào giới hạn đoán mật khẩu.
- **Đăng xuất khỏi mọi thiết bị** (`POST /api/auth/logout-everywhere`): có modal xác nhận; thu hồi mọi phiên kể cả phiên này rồi về trang đăng nhập.

Chi tiết ở [auth-flow.md](auth-flow.md).

## Đổi ngôn ngữ nhanh

Nút **VI / EN** cạnh logo không nằm ở trang Cài đặt mà ở thanh bên, header điện thoại và trang đăng nhập; gọi `POST /api/settings/language` (dùng được cả khi chưa đăng nhập, đã đăng nhập thì lưu vào hồ sơ). Xem [ui-flow.md](ui-flow.md).

## Kiểm thử

Bộ `language-currency` (đổi ngôn ngữ, đổi tiền tệ mặc định, thiếu tỷ giá), `auth` (đổi mật khẩu, đăng xuất mọi thiết bị), `ui` (giao diện sáng/tối).
