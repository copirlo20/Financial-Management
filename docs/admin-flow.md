# Luồng quản trị (admin)

Hai khu vực chỉ dành cho người dùng có vai trò `ADMIN`: **danh mục mặc định của hệ thống** và **tỷ giá nhập tay**.
Đường đi chung của yêu cầu xem [request-flow.md](request-flow.md).

## Quyền

- Vai trò nằm ở cột `users.role` (`USER` hoặc `ADMIN`), có trong access token nhưng **được kiểm lại từ database** ở mỗi yêu cầu.
- Mỗi view và handler admin bắt đầu bằng `requireAdmin()`. Người không phải admin nhận **`404`** thay vì "bị cấm": họ không biết các trang này có tồn tại.
- Frontend chỉ **hiện hoặc ẩn** liên kết "Quản trị danh mục", "Quản trị tỷ giá" trên menu theo vai trò, và các trang admin gọi `requireAdmin()` để hiện "Không tìm thấy"; quyền thật vẫn do backend quyết định.
- Admin **không bao giờ đọc được danh mục riêng của người dùng**: mọi truy vấn của khu vực này lọc `userId = NULL`.
- Chưa có giao diện tạo admin: đặt `role = 'ADMIN'` trực tiếp trong database.

## Thành phần

| Tầng | File |
| --- | --- |
| Trang | [frontend/app/(app)/admin/categories/](../frontend/app/(app)/admin/categories/) (danh sách, tạo, sửa), [admin/exchange-rates/](../frontend/app/(app)/admin/exchange-rates/) |
| Server Action | [admin-categories.ts](../frontend/app/actions/admin-categories.ts), [admin-exchange-rates.ts](../frontend/app/actions/admin-exchange-rates.ts) |
| Handler | [handlers/admin-categories.ts](../backend/src/handlers/admin-categories.ts), [handlers/admin-exchange-rates.ts](../backend/src/handlers/admin-exchange-rates.ts) |
| View | [views/categories.ts](../backend/src/views/categories.ts) (`adminCategoriesView`), [views/exchange-rates.ts](../backend/src/views/exchange-rates.ts) |

## Danh mục mặc định

Cùng bảng `categories` với danh mục riêng nhưng `userId = NULL` ([category-flow.md](category-flow.md)). Mọi người dùng đều thấy chúng.

| Thao tác | Quy tắc |
| --- | --- |
| **Tạo** | Mã `systemKey` (2–40 ký tự: chữ thường, số, gạch dưới; bắt đầu bằng chữ cái; **duy nhất**), tên, loại, biểu tượng, màu. Tên không trùng trong nhóm thu/chi |
| **Sửa** | Chỉ đổi tên, biểu tượng, màu. **Mã và loại không đổi**: mã là thứ bản dịch và dữ liệu mồi tham chiếu tới |
| **Xóa** | Từ chối nếu **đã có người dùng dùng** (trong giao dịch hoặc ngân sách): "Danh mục đang được người dùng sử dụng nên chưa thể xóa." |

Danh mục mặc định ban đầu được nạp từ [database/prisma/seed.sql](../database/prisma/seed.sql) (chạy lại nhiều lần an toàn: chỉ thêm cái còn thiếu theo `systemKey`). Tên hiển thị được **dịch** theo ngôn ngữ người dùng (câu tiếng Việt là khóa dịch): thêm danh mục mặc định mới thì thêm cả bản dịch tiếng Anh ở [shared/src/i18n/en.ts](../shared/src/i18n/en.ts).

## Tỷ giá nhập tay

Dùng khi nguồn tự động lỗi hoặc cần tỷ giá của một ngày trong quá khứ ([currency-flow.md](currency-flow.md)).

1. Trang hiện **tỷ giá mới nhất của mỗi tiền tệ** (đánh dấu cái nào do nhập tay), danh sách **tối đa 100 tỷ giá nhập tay gần nhất**, và mở trang là kích hoạt làm mới tỷ giá tự động (như mọi chỗ cần tỷ giá).
2. **Nhập** (`POST /api/admin/exchange-rates`): tiền tệ (không phải USD, vì USD là gốc), ngày, tỷ giá "1 USD = ? đơn vị" (số dương, tối đa 6 chữ số thập phân).
3. Trong một transaction: ghi hoặc **thay** tỷ giá của ngày đó với `isManual = true`, rồi điền bản chụp quy đổi cho **giao dịch còn thiếu**. Giao dịch đã có bản chụp **không bị đổi**.
4. Tỷ giá nhập tay **không bị bản tự động ghi đè** khi nguồn cập nhật.
5. **Xóa** một tỷ giá nhập tay (chỉ xóa được dòng nhập tay): lần cập nhật tự động kế tiếp sẽ cấp lại tỷ giá của ngày đó.

## Trường hợp lỗi

| Tình huống | Kết quả |
| --- | --- |
| Người thường gọi route admin | `404` |
| Mã danh mục sai định dạng hoặc đã dùng | Lỗi ở trường mã |
| Tên danh mục hệ thống trùng trong nhóm | Lỗi ở trường tên |
| Xóa danh mục đang được dùng | Thông báo như trên |
| Tỷ giá không dương, sai định dạng, tiền tệ không hỗ trợ | Lỗi ở trường tương ứng |

## Kiểm thử

Bộ `subcategories-limits-admin` (quyền admin, người thường nhận `404`, tạo/sửa/xóa danh mục mặc định, tỷ giá nhập tay, admin không thấy danh mục riêng) và `language-currency` (tỷ giá nhập tay không bị ghi đè).
