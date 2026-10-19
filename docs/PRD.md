# PRD — Ứng dụng web quản lý tài chính cá nhân

**Trạng thái:** MVP đã hoàn thành, kèm nhiều chức năng ngoài MVP (xem mục 4). Chú thích: ✅ đã làm · 🟡 làm một phần · ⬜ chưa làm.
Cách từng chức năng hoạt động: các tài liệu `*-flow.md` ([mục lục](../README.md#tai-lieu)).

## 1. Mục tiêu

Xây dựng một web app quản lý tài chính cá nhân cho phép người dùng theo dõi thu chi, lập ngân sách, quản lý nhiều tài khoản/ví và mục tiêu tiết kiệm, giúp họ hiểu rõ tình hình tài chính của mình thông qua báo cáo trực quan. Sản phẩm hoạt động theo mô hình miễn phí ở giai đoạn MVP, ưu tiên thu hút người dùng trước khi tính đến thu phí.

## 2. Đối tượng người dùng

- Sản phẩm SaaS đa người dùng (multi-tenant), phục vụ nhiều cá nhân không quen biết nhau.
- Mỗi người dùng có tài khoản riêng (đăng ký/đăng nhập), dữ liệu tài chính cách ly hoàn toàn giữa các tài khoản.
- Hỗ trợ đa ngôn ngữ (tiếng Việt và tiếng Anh) và đa tiền tệ (10 loại: VND, USD, EUR, JPY, GBP, AUD, SGD, KRW, CNY, THB) ngay từ đầu.
- Nền tảng: web responsive, dùng tốt trên cả desktop và mobile browser.

## 3. Tính năng MVP

| | Tính năng | Trạng thái và ghi chú |
| :-: | --- | --- |
| 1 | **Xác thực & tài khoản người dùng** | |
| | Đăng ký/đăng nhập bằng email + mật khẩu | ✅ [auth-flow](auth-flow.md) |
| | Đăng nhập bằng OAuth | ⬜ ("có thể thêm sau") |
| | Quản lý hồ sơ, ngôn ngữ và tiền tệ mặc định | ✅ [settings-flow](settings-flow.md). Thêm: đổi mật khẩu, đăng xuất mọi thiết bị |
| 2 | **Quản lý ví/tài khoản** | |
| | Nhiều ví (tiền mặt, ngân hàng, ví điện tử, thẻ tín dụng), mỗi ví một tiền tệ | ✅ [account-flow](account-flow.md). Thêm: lưu trữ / khôi phục thay vì xóa |
| | Xem số dư từng ví và tổng tài sản quy đổi | ✅ |
| 3 | **Ghi chi tiêu & thu nhập** | |
| | Nhập giao dịch thủ công (số tiền, danh mục, ngày, ghi chú, ví) | ✅ [transaction-flow](transaction-flow.md). Thêm: chuyển khoản giữa hai ví (kể cả khác tiền tệ) |
| | Phân loại theo danh mục, danh mục tùy chỉnh | ✅ [category-flow](category-flow.md). Thêm: danh mục con (một cấp) |
| | Import giao dịch từ sao kê PDF/Excel | ✅ [import-flow](import-flow.md): app dựng lại bảng từ PDF, ghép cột (app gợi ý theo tên cột), chống trùng, hoàn tác. CSV đã bỏ |
| 4 | **Lập ngân sách** | |
| | Hạn mức theo tháng, theo danh mục (và tổng) | ✅ [budget-flow](budget-flow.md) |
| | Cảnh báo khi gần hoặc vượt ngân sách | ✅ Từ 80% và khi vượt 100%; cảnh báo hiện trong app |
| 5 | **Mục tiêu tiết kiệm** | |
| | Tạo mục tiêu (số tiền, hạn chót), theo dõi tiến độ | ✅ [savings-flow](savings-flow.md). Thêm: gửi / rút từng khoản, gợi ý "cần bao nhiêu mỗi tháng" |
| 6 | **Báo cáo & biểu đồ** | |
| | Dashboard: thu, chi, chênh lệch, số dư hiện tại | ✅ [dashboard-flow](dashboard-flow.md) |
| | Biểu đồ chi tiêu theo danh mục | ✅ |
| | Xu hướng theo tháng | ✅ 6 tháng gần nhất |
| | Xu hướng theo **quý** | ⬜ |
| | **Số dư theo thời gian** (đường tài sản) | ⬜ Hiện chỉ có số dư hiện tại và dòng tiền thu/chi từng tháng |
| 7 | **Đa ngôn ngữ & đa tiền tệ** | |
| | Chuyển giao diện Việt / Anh | ✅ [ui-flow](ui-flow.md) |
| | Nhập và hiển thị đa tiền tệ, quy đổi về tiền tệ mặc định | ✅ [currency-flow](currency-flow.md): tỷ giá tự động, bản chụp quy đổi tại ngày giao dịch, admin nhập tay |

## 4. Đã làm ngoài MVP

| Tính năng | Mô tả |
| --- | --- |
| **Trợ lý AI đọc sao kê** | Claude hoặc GPT đọc toàn bộ file Excel (mọi bố cục) và **PDF**, kể cả PDF scan, liệt kê giao dịch và **gợi ý danh mục**; người dùng đối chiếu trước khi ghi ([import-flow](import-flow.md)) |
| **Chatbot AI** | Hỏi đáp về chi tiêu, ngân sách, số dư, cách dùng app; chỉ đọc dữ liệu của chính người dùng ([chat-flow](chat-flow.md)) |
| **Xuất sao kê PDF** | Theo khoảng thời gian tùy chọn, một ví hoặc tất cả, bố cục như sao kê ngân hàng ([statement-flow](statement-flow.md)) |
| **Quản lý lần nhập** | Hoàn tác cả lô, xóa lần nhập kèm giao dịch, file mẫu Excel |
| **Giao diện sáng / tối** | Theo thiết bị hoặc chọn tay; modal xác nhận thao tác xóa; lớp phủ chờ khi chuyển trang ([ui-flow](ui-flow.md)) |
| **Khu vực quản trị** | Admin quản lý danh mục mặc định và tỷ giá nhập tay ([admin-flow](admin-flow.md)) |
| **Bảo mật** | Giới hạn đoán mật khẩu, thu hồi phiên, header bảo mật và CSP, hạn mức chi phí AI, chống "zip bomb" khi tải Excel ([security-flow](security-flow.md)) |

## 5. Giới hạn của sản phẩm

| Giới hạn | Giá trị |
| --- | --- |
| Ví mỗi người | 50 (tính cả ví đã lưu trữ) |
| Danh mục riêng mỗi người | 200 |
| Mục tiêu tiết kiệm mỗi người | 50 |
| File sao kê tải lên | 5 MB, 10.000 dòng; tối đa 5 lần nhập đang chờ xác nhận |
| Sao kê PDF xuất ra | Tối đa 3 năm và 3.000 giao dịch mỗi file |
| Dùng AI | Có hạn mức theo giờ và theo ngày cho cả hệ thống và từng người |

## 6. Yêu cầu phi chức năng

- **Bảo mật và quyền riêng tư**: dữ liệu mỗi người cách ly hoàn toàn; admin **không** đọc được dữ liệu tài chính của người dùng ([ARCHITECTURE](ARCHITECTURE.md), mục phân quyền). Khi dùng AI, nội dung gửi đi bị giới hạn ở file sao kê và câu hỏi chat; không ghi log nội dung.
- **Chính xác của số tiền**: không dùng số thực ở bất kỳ đâu, từ form tới database (`Decimal`); số dư luôn khớp tổng giao dịch.
- **Khả năng dùng**: responsive (thanh bên trên máy tính, thanh điều hướng dưới đáy trên điện thoại), biểu đồ có bản bảng thay thế, hỗ trợ trình đọc màn hình ở các thành phần chính.
- **Tin cậy**: thao tác ghi nhiều bảng chạy trong một transaction; mất mạng hay nguồn tỷ giá lỗi thì app vẫn chạy bằng dữ liệu đã lưu; AI là tùy chọn, không có khóa thì phần còn lại không bị ảnh hưởng.

## 7. Tính năng để sau (Post-MVP)

| Tính năng | Trạng thái |
| --- | --- |
| Kết nối API ngân hàng / Open Banking để tự đồng bộ giao dịch | ⬜ Bên thứ ba chỉ dùng được dữ liệu ngân hàng theo thỏa thuận riêng với từng ngân hàng (Thông tư 64/2024/TT-NHNN). Cách khả thi trước mắt: webhook của dịch vụ trung gian (SePay, Casso; SePay kết nối API với TPBank, VietinBank, ACB, MBBank, ngân hàng khác qua SMS). Có phí, và bên trung gian thấy giao dịch của người dùng |
| Chia sẻ sổ chung cho gia đình/nhóm, phân quyền xem-sửa | ⬜ |
| Freemium / subscription với tính năng nâng cao | ⬜ |
| AI phân tích chi tiêu, nhắc nhở thông minh | 🟡 Chatbot trả lời câu hỏi về chi tiêu đã có; chưa có phân tích chủ động hay nhắc nhở |
| Tự động phân loại giao dịch bằng AI | ✅ Khi nhập sao kê (gợi ý danh mục, người dùng xem lại) |
| Ứng dụng mobile native (iOS/Android) | ⬜ (web responsive) |
| Thông báo đẩy / email nhắc ngân sách, hóa đơn định kỳ | ⬜ Cảnh báo ngân sách hiện chỉ hiện trong app |
| Giao dịch định kỳ | ⬜ |
| Quản lý nợ/vay, đầu tư, tài sản khác | ⬜ |
| Xuất báo cáo PDF | ✅ Sao kê PDF |
| Xuất báo cáo Excel | ⬜ |

Còn thiếu về vận hành tài khoản: quên mật khẩu / khôi phục tài khoản, xác minh email, xóa tài khoản, và giao diện admin để khóa/mở tài khoản và xem số liệu tổng hợp ẩn danh. Các mục này chưa nằm trong MVP ban đầu nhưng cần có trước khi mở cho người dùng thật.

## 8. Tiêu chí hoàn thành MVP

| Tiêu chí | Trạng thái | Kiểm chứng bởi bộ kiểm thử |
| --- | :-: | --- |
| Đăng ký, đăng nhập, quản lý hồ sơ (ngôn ngữ, tiền tệ mặc định) | ✅ | `auth`, `language-currency` |
| Tạo được ít nhất một ví và xem đúng số dư sau khi có giao dịch | ✅ | `accounts-categories`, `transactions` |
| Nhập giao dịch thủ công và import được PDF/Excel, hiển thị chính xác trong lịch sử | ✅ | `transactions`, `imports`, `import-templates` |
| Đặt ngân sách theo danh mục/tháng và nhận cảnh báo khi vượt ngưỡng | ✅ | `budgets` |
| Tạo và theo dõi tiến độ ít nhất một mục tiêu tiết kiệm | ✅ | `savings` |
| Dashboard hiển thị đúng thu/chi/số dư và biểu đồ **theo danh mục, theo thời gian** | 🟡 | `dashboard`, `ui`. Theo danh mục và theo tháng đã có; **số dư theo thời gian** chưa có (mục 3) |
| Giao diện hoạt động tốt trên trình duyệt desktop và mobile | ✅ | `mobile`, `ui`, `states` |
| Chuyển được Việt / Anh; số liệu đúng theo tiền tệ đã chọn | ✅ | `language-currency` |
| Dữ liệu mỗi người cách ly hoàn toàn, không rò rỉ chéo | ✅ | `accounts-categories`, `transactions`, `budgets`, `savings`, `imports`, `imports-ai`, `dashboard`, `statement`, `chat`, `language-currency`, `subcategories-limits-admin`: đều thử truy cập chéo giữa hai người dùng |
