# Luồng ngân sách

Đặt hạn mức chi theo tháng, theo danh mục hoặc cho tổng chi; cảnh báo khi gần hoặc vượt hạn mức.
Đường đi chung của yêu cầu xem [request-flow.md](request-flow.md).

## Thành phần

| Tầng | File |
| --- | --- |
| Trang | [frontend/app/(app)/budgets/](../frontend/app/(app)/budgets/) (danh sách theo tháng, form đặt, trang sửa) |
| Hiển thị tiến độ | [frontend/components/budget-progress.tsx](../frontend/components/budget-progress.tsx) |
| Server Action | [frontend/app/actions/budgets.ts](../frontend/app/actions/budgets.ts) |
| Handler (ghi) | [backend/src/handlers/budgets.ts](../backend/src/handlers/budgets.ts) |
| View (đọc) | [backend/src/views/budgets.ts](../backend/src/views/budgets.ts) |
| Tính mức chi | [backend/src/data/budgets.ts](../backend/src/data/budgets.ts) (`getBudgetStatuses`, dùng chung với Tổng quan) |

## Dữ liệu

Bảng `budgets`: `categoryId` (`NULL` = **ngân sách tổng** cho mọi khoản chi của tháng), `amountLimit`, `currency` (luôn là **tiền tệ mặc định** của người dùng lúc đặt), `periodStart` (ngày đầu tháng).
Mỗi tháng chỉ có **một** ngân sách cho mỗi danh mục và một ngân sách tổng (chỉ mục duy nhất, riêng ngân sách tổng dùng chỉ mục từng phần nên backend còn kiểm tra thêm).

## Đặt ngân sách

1. Zod: tháng (`YYYY-MM`, 2000-01 tới 2100-12), danh mục (rỗng = tổng), hạn mức (số dương).
2. Danh mục phải là danh mục **chi** mà người dùng nhìn thấy được (của họ hoặc hệ thống).
3. Trùng (tháng này đã có ngân sách cho mục này) → lỗi "Tháng này đã có ngân sách cho mục này."
4. Lưu với `currency` = tiền tệ mặc định hiện tại.

## Tính mức chi và trạng thái

`getBudgetStatuses(userId, month)`:

1. Lấy ngân sách của tháng, tổng chi theo danh mục trong tháng (**chỉ khoản chi**, tính theo `amountInDefaultCurrency` của từng giao dịch), và quan hệ cha–con của danh mục.
2. Chi của một ngân sách **danh mục** = chi của chính nó **cộng chi của các danh mục con**. Ngân sách **tổng** = mọi khoản chi của tháng.
3. `percent = đã chi / hạn mức × 100`, và trạng thái:

| Trạng thái | Điều kiện | Hiển thị |
| --- | --- | --- |
| `ok` | dưới 80% | Thanh màu chính |
| `near` | từ 80% đến 100% | Thanh vàng, "Sắp chạm hạn mức · Còn …" |
| `over` | trên 100% | Thanh đỏ, "Vượt hạn mức …" |

4. Giao dịch ngoại tệ **chưa có tỷ giá** (bản chụp trống) không được tính, và số lượng được báo riêng (`unconvertedCount`) để người dùng biết con số có thể thiếu.
5. Chuyển khoản **không** tính vào mức chi.

Trang Ngân sách hiện cảnh báo tổng hợp ở đầu ("1 ngân sách đã vượt hạn mức, 1 ngân sách đã dùng từ 80% trở lên"); Tổng quan hiện các ngân sách chưa `ok`.

## Sao chép từ tháng trước

`POST /api/budgets/copy-previous` sao chép ngân sách của tháng liền trước sang tháng đang xem, **bỏ qua** mục đã có (`skipDuplicates`). Nút chỉ hiện khi tháng trước có ngân sách.

## Sửa và xóa

- Sửa chỉ đổi **hạn mức**, rồi quay lại đúng tháng của ngân sách đó.
- Xóa có modal xác nhận.

## Đổi tiền tệ mặc định

Khi người dùng đổi tiền tệ mặc định ở Cài đặt, hạn mức mọi ngân sách được **quy đổi theo tỷ giá hiện tại** sang tiền tệ mới (tối thiểu 0,01), trong cùng transaction với việc đổi ([currency-flow.md](currency-flow.md)).

## Điều hướng tháng

Trang nhận `?month=YYYY-MM`; tháng sai bị thay bằng tháng hiện tại. Hai nút mũi tên đi tới tháng trước/sau.

## Trường hợp lỗi

| Tình huống | Kết quả |
| --- | --- |
| Danh mục không phải khoản chi của người dùng | Lỗi ở trường danh mục |
| Ngân sách của tháng/mục đã có | Lỗi ở trường danh mục |
| Hạn mức không hợp lệ | Lỗi ở trường hạn mức |
| Sửa ngân sách không có hoặc của người khác | "Không tìm thấy ngân sách." |

## Kiểm thử

Bộ `budgets` (đặt, cảnh báo ở các ngưỡng, danh mục cha bao con, ngân sách tổng, sao chép, cách ly người dùng).
