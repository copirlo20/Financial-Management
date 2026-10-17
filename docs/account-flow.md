# Luồng ví / tài khoản

Ví là nơi giữ tiền: tiền mặt, ngân hàng, ví điện tử, thẻ tín dụng. Mỗi ví **một loại tiền** và có **số dư hiện tại** luôn khớp với giao dịch.
Đường đi chung của yêu cầu xem [request-flow.md](request-flow.md).

## Thành phần

| Tầng | File |
| --- | --- |
| Trang | [frontend/app/(app)/accounts/](../frontend/app/(app)/accounts/) (danh sách, form tạo, trang sửa `[id]/edit`) |
| Server Action | [frontend/app/actions/accounts.ts](../frontend/app/actions/accounts.ts) |
| Handler (ghi) | [backend/src/handlers/accounts.ts](../backend/src/handlers/accounts.ts) |
| View (đọc) | [backend/src/views/accounts.ts](../backend/src/views/accounts.ts) |
| Luật nhập liệu | [backend/src/validations/account.ts](../backend/src/validations/account.ts) |

## Dữ liệu

Bảng `accounts`: `name`, `type` (`CASH`, `BANK`, `E_WALLET`, `CREDIT_CARD`, `OTHER`), `currency`, `initialBalance`, `currentBalance`, `archivedAt`.

`currentBalance` là **số dư lưu sẵn** = `initialBalance` + tổng các giao dịch của ví (thu và nhận chuyển cộng, chi và chuyển đi trừ). Mọi chỗ thay đổi giao dịch đều cập nhật nó **trong cùng một transaction database** với việc ghi giao dịch, nên không lệch ([transaction-flow.md](transaction-flow.md)).

## Tạo ví

1. Zod: tên (1–60 ký tự), loại, tiền tệ (một trong 10 loại hỗ trợ), số dư ban đầu (`-?\d{1,13}(\.\d{1,2})?`, có thể âm, ví dụ thẻ tín dụng đang nợ). Số dư luôn là chuỗi từ form tới cột `Decimal`.
2. Tên **không trùng** (không phân biệt hoa thường) với ví khác của cùng người dùng, kể cả ví đã lưu trữ.
3. Tối đa **50** ví mỗi người, tính cả ví đã lưu trữ.
4. Tạo ví với `currentBalance = initialBalance`.

## Sửa ví

- Sửa được **tên, loại, số dư ban đầu**. **Không đổi được tiền tệ**: mọi giao dịch của ví đã ghi bằng tiền tệ đó.
- Đổi số dư ban đầu thì số dư hiện tại dịch chuyển đúng bằng phần chênh. Việc này chạy bằng **một câu lệnh SQL**: `currentBalance = currentBalance + (mới − cũ)`, nên nếu có giao dịch đang được ghi cùng lúc cũng không lệch.
- Xong thì chuyển về danh sách.

## Lưu trữ và khôi phục

Ví không bị xóa mà được **lưu trữ** (`archivedAt`) để giữ lịch sử:

- Ví đã lưu trữ **không xuất hiện** khi chọn ví cho giao dịch, chuyển khoản, nhập sao kê.
- Giao dịch cũ của nó vẫn nằm trong danh sách và báo cáo; có thể lọc theo ví đó.
- Giao dịch sẵn có trên ví đã lưu trữ vẫn **sửa được tại chỗ**, nhưng không chuyển giao dịch sang một ví đã lưu trữ.
- Số dư của ví đã lưu trữ **không** tính vào tổng số dư.
- Khôi phục đưa ví trở lại bình thường.

## Danh sách và tổng số dư

`GET /api/accounts` trả các ví kèm **tổng số dư theo từng tiền tệ** (chỉ ví chưa lưu trữ). Nếu có ví khác tiền tệ mặc định, backend làm mới tỷ giá rồi tính thêm **tổng quy đổi** về tiền tệ mặc định; loại tiền nào chưa có tỷ giá được liệt kê riêng thay vì cộng sai ([currency-flow.md](currency-flow.md)).

## Trường hợp lỗi

| Tình huống | Kết quả |
| --- | --- |
| Tên trùng | Lỗi ở trường tên: "Bạn đã có tài khoản với tên này." |
| Số dư sai định dạng | Lỗi ở trường số dư |
| Quá 50 ví | Lỗi chung của form |
| Sửa ví của người khác, hoặc id sai | "Không tìm thấy tài khoản." (và `404` khi đọc) |

## Kiểm thử

Bộ `accounts-categories` (ví và danh mục), `mobile` (ví trên điện thoại), `ui` (biểu mẫu cập nhật tại chỗ).
