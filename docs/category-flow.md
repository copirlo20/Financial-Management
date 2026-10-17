# Luồng danh mục

Danh mục phân loại giao dịch (Ăn uống, Lương…). Có hai loại: danh mục **mặc định của hệ thống** (do admin quản lý, xem
[admin-flow.md](admin-flow.md)) và danh mục **riêng** của từng người dùng. Đường đi chung của yêu cầu xem [request-flow.md](request-flow.md).

## Thành phần

| Tầng | File |
| --- | --- |
| Trang | [frontend/app/(app)/categories/](../frontend/app/(app)/categories/) (danh sách, form tạo, trang sửa) |
| Server Action | [frontend/app/actions/categories.ts](../frontend/app/actions/categories.ts) |
| Handler (ghi) | [backend/src/handlers/categories.ts](../backend/src/handlers/categories.ts) |
| View (đọc) | [backend/src/views/categories.ts](../backend/src/views/categories.ts) |
| Luật nhập liệu | [backend/src/validations/category.ts](../backend/src/validations/category.ts) |

## Mô hình

Bảng `categories`:

| Trường | Ý nghĩa |
| --- | --- |
| `userId` | `NULL` = danh mục hệ thống (mọi người dùng thấy); có giá trị = của riêng người đó |
| `systemKey` | Mã cố định của danh mục hệ thống (`food`, `salary`…), dùng để dịch tên theo ngôn ngữ |
| `type` | `EXPENSE` (chi) hoặc `INCOME` (thu); **không đổi được** sau khi tạo (đổi sẽ biến khoản chi thành khoản thu) |
| `parentId` | Danh mục cha. **Chỉ một cấp**: cha phải là danh mục gốc |
| `icon`, `color` | Một trong 30 biểu tượng cho sẵn, màu `#RRGGBB` |

Tên danh mục hệ thống được **dịch** khi hiển thị (câu tiếng Việt là khóa dịch); tên do người dùng đặt hiển thị nguyên văn.

## Danh sách

`GET /api/categories`: danh mục hệ thống trước, rồi của riêng người dùng. Giao diện xếp danh mục con dưới cha, nhãn trong các ô chọn là `Cha › Con`. Danh mục riêng của người khác **không bao giờ** xuất hiện.

## Tạo danh mục riêng

1. Zod: tên (1–40 ký tự), loại, biểu tượng thuộc danh sách, màu hợp lệ, danh mục cha (rỗng = gốc).
2. Tên **không trùng** trong cùng nhóm thu/chi, tính cả danh mục hệ thống (vì cả hai cùng hiện trong một ô chọn).
3. Danh mục cha phải: nhìn thấy được với người này (của họ hoặc hệ thống), là **danh mục gốc**, và **cùng nhóm** thu/chi.
4. Tối đa **200** danh mục riêng mỗi người.

## Sửa

- Sửa được tên, biểu tượng, màu, danh mục cha. **Không đổi `type`.**
- Chỉ sửa được danh mục **của chính mình**: truy vấn lọc `userId`, nên danh mục hệ thống luôn chỉ đọc với người dùng thường.
- Một danh mục **đang có con** không được trở thành con của danh mục khác (giữ một cấp); không tự làm cha của chính nó.

## Xóa

Xóa bị **từ chối** nếu danh mục đang được giao dịch hoặc ngân sách dùng: xóa sẽ làm giao dịch mất phân loại và kéo theo xóa ngân sách. Thông báo: "Danh mục đang được dùng trong giao dịch hoặc ngân sách nên chưa thể xóa."
Danh mục con **không** cản việc xóa cha: khóa ngoại nâng chúng lên thành danh mục gốc. Việc xóa có modal xác nhận.

## Danh mục trong các luồng khác

| Luồng | Cách dùng |
| --- | --- |
| [Giao dịch](transaction-flow.md) | Phải **cùng loại** với giao dịch (chi hay thu) |
| [Ngân sách](budget-flow.md) | Chỉ danh mục **chi**; ngân sách của danh mục cha tính cả danh mục con |
| [Tổng quan](dashboard-flow.md) | Chi tiêu của danh mục con được **gộp vào danh mục cha** trên biểu đồ |
| [Nhập sao kê](import-flow.md) | Danh mục mặc định cho cả lô, và gợi ý của AI cho từng dòng (chỉ nhận danh mục cùng loại) |

## Trường hợp lỗi

| Tình huống | Kết quả |
| --- | --- |
| Tên trùng trong nhóm | Lỗi ở trường tên |
| Danh mục cha khác nhóm thu/chi, không phải gốc, hoặc không tồn tại | Lỗi ở trường danh mục cha |
| Đặt cha cho danh mục đang có con | Lỗi ở trường danh mục cha |
| Quá 200 danh mục | Lỗi chung của form |
| Sửa hoặc xóa danh mục hệ thống, hoặc của người khác | "Không tìm thấy danh mục." |

## Kiểm thử

Bộ `accounts-categories` (CRUD, cách ly giữa người dùng) và `subcategories-limits-admin` (danh mục con, giới hạn, quyền admin).
