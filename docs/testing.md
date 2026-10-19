# Kiểm thử

Bộ kiểm thử chạy **cả hệ thống thật** (frontend + backend + PostgreSQL), nên bắt được lỗi ở mọi tầng. Mỗi bộ tự tạo
người dùng `e2e-*@example.com` và xóa đi sau khi chạy.

```bash
npm test                          # toàn bộ: build, chạy, 17 bộ, tắt
npm test -- auth budgets          # chỉ các bộ có tên chứa các từ này
E2E_VERBOSE=1 npm test -- imports # in từng kiểm tra, không chỉ kiểm tra lỗi
E2E_PORT=3300 npm test            # đổi cổng nếu 3101 đang bị chiếm
```

> ⚠️ Các bộ kiểm thử **ghi vào database trong `.env`**. Trình chạy từ chối chạy nếu `DATABASE_URL` không trỏ về máy bạn
> (đặt `E2E_ALLOW_REMOTE_DB=1` nếu thật sự muốn). Hãy dùng database phát triển, không dùng dữ liệu thật.
> Không API AI thật nào bị gọi khi chạy kiểm thử: backend được trỏ tới một máy chủ giả (`tests/mock-ai.mjs`) trả lời
> được cả kiểu Claude lẫn kiểu OpenAI. Trình chạy khởi động thêm một bản app dùng OpenAI và chạy lại hai bộ AI
> (`chat`, `imports-ai`) trên bản đó.

| Bộ                           | Kiểm tra | Nội dung                                                                                                                                                                  |
| ---------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                       |    57    | Đăng ký, đăng nhập, cookie, xoay vòng và thu hồi token, chuyển hướng an toàn, khóa khi đoán mật khẩu, phiên, đổi mật khẩu, đăng xuất mọi thiết bị                         |
| `accounts-categories`        |    34    | Ví và danh mục: tạo, sửa, lưu trữ, giới hạn, cách ly giữa người dùng                                                                                                      |
| `subcategories-limits-admin` |    37    | Danh mục con, giới hạn số lượng, quản trị danh mục mặc định                                                                                                               |
| `transactions`               |    55    | Thu, chi, chuyển khoản (kể cả khác tiền tệ), số dư, lọc, phân trang                                                                                                       |
| `budgets`                    |    37    | Ngân sách theo tháng, cảnh báo 80% / vượt, sao chép tháng trước                                                                                                           |
| `savings`                    |    35    | Mục tiêu, gửi / rút, tiến độ, lưu trữ                                                                                                                                     |
| `dashboard`                  |    15    | Tổng hợp thu chi, danh mục, xu hướng, quy đổi                                                                                                                             |
| `statement`                  |    22    | Sao kê PDF: số dư đầu/cuối kỳ, ghi nợ/có, một ví và tất cả, nhiều trang, từ chối, giới hạn mỗi giờ                                                                        |
| `language-currency`          |    49    | Việt / Anh, quy đổi tiền tệ, tỷ giá nhập tay của admin                                                                                                                    |
| `imports`                    |    75    | PDF (dựng lại bảng, nhiều trang, mật khẩu, scan, chữ ngoài trang, sao kê do app xuất) / Excel, CSV bị từ chối, ghép cột, chống trùng, hoàn tác, xóa lần nhập           |
| `imports-ai`                 |    52    | Đọc sao kê bằng AI (máy chủ giả), PDF, chia phần, xử lý lỗi, PDF có chữ chuyển sang ghép cột tay khi AI lỗi                                                               |
| `import-templates`           |     6    | File mẫu Excel                                                                                                                                                            |
| `chat`                       |    35    | Chatbot: công cụ chỉ đọc, cách ly dữ liệu, giới hạn, lỗi                                                                                                                  |
| `states`                     |    19    | Trạng thái rỗng, lỗi, không tìm thấy                                                                                                                                      |
| `backend-restart`            |    10    | Backend khởi động lại: form và trang (cả khi trang đang đọc dữ liệu) đợi backend trở lại, phiên không bị mất; backend tắt hẳn hoặc lệnh ghi bị cắt giữa chừng thì form báo lỗi ngay trên form, giữ dữ liệu đã nhập (trừ mật khẩu), không gửi lại lệnh |
| `ui`                         |    48    | Trình duyệt thật: biểu đồ, modal xác nhận xóa (Hủy, Esc, Xóa), giao diện tối, khung chờ (cả khi bấm Quay lại), lọc không tải lại trang, tải sao kê, lỗi trang, khung chat |
| `mobile`                     |    30    | Trình duyệt giả lập điện thoại: bố cục 320–740 px, thao tác chạm, bàn phím ảo                                                                                             |
| `imports-ai` (openai)        |    50    | Bộ `imports-ai` chạy lại với bản app dùng OpenAI                                                                                                                          |
| `chat` (openai)              |    35    | Bộ `chat` chạy lại với bản app dùng OpenAI                                                                                                                                |
|                              | **703**  |                                                                                                                                                                           |

Hai bộ cuối cần **Edge hoặc Chrome**; không có trình duyệt thì chúng tự bỏ qua (đặt `E2E_BROWSER` nếu trình duyệt ở chỗ khác).

## Trình chạy hoạt động thế nào

[tests/run-e2e.mjs](../tests/run-e2e.mjs):

1. Từ chối chạy nếu `DATABASE_URL` không trỏ về máy bạn.
2. Build frontend, rồi dựng **backend, frontend và máy chủ AI giả** trên cổng riêng (frontend `3101`, backend `3201`, máy chủ AI giả `3161`; đổi bằng `E2E_PORT`, `E2E_BACKEND_PORT`, `E2E_AI_MOCK_PORT`). Khóa và địa chỉ AI được ghi đè, nên không bao giờ gọi API thật.
3. Nếu có bộ AI trong danh sách chạy, dựng thêm **một bản app thứ hai dùng OpenAI** (cổng `3103` và `3203`) để chạy lại hai bộ AI trên đó.
4. Chạy từng bộ như một tiến trình riêng; bộ nào quá `E2E_SUITE_TIMEOUT_MS` (mặc định 240 giây) bị kết thúc và tính là lỗi.
5. Dọn dữ liệu: các bộ tự xóa người dùng `e2e-*` của mình; bộ đếm giới hạn của lần chạy (tiền tố `e2e:`) bị xóa cuối cùng.

Hai loại bộ: `tests/e2e/*.e2e.mjs` gọi qua HTTP như trình duyệt không có JavaScript (biểu mẫu, cookie, chuyển hướng) và kiểm cả trang lẫn database; `tests/browser/*.browser.mjs` chạy trong Edge/Chrome thật qua DevTools Protocol cho những gì cần JavaScript. `tests/pdf-text.mjs` đọc chữ trong PDF để kiểm sao kê.

## Biến môi trường của trình chạy

| Biến | Tác dụng |
| --- | --- |
| `E2E_VERBOSE=1` | In từng kiểm tra, không chỉ kiểm tra lỗi |
| `E2E_PORT`, `E2E_BACKEND_PORT`, `E2E_AI_MOCK_PORT` | Đổi cổng khi bị chiếm |
| `E2E_SUITE_TIMEOUT_MS` | Thời gian tối đa của một bộ |
| `E2E_ALLOW_REMOTE_DB=1` | Cho phép chạy với database không ở máy bạn (không nên) |
| `E2E_BROWSER` | Đường dẫn Edge/Chrome nếu ở chỗ khác |
| `E2E_SCREENSHOTS=<thư mục>` | Bộ trình duyệt lưu ảnh chụp từng trạng thái để xem bằng mắt |

Trình duyệt giả lập đôi khi treo khi trang bị đánh dấu "ẩn" (`visibilityState = hidden`); chạy lại, và xem các dòng `at abort:` trong kết quả để biết nó dừng ở đâu.

Thêm một bộ kiểm thử mới: xem bước 5 của "Thêm một tính năng" ở [STRUCTURE.md](STRUCTURE.md); đặt file vào `tests/e2e/<tên>.e2e.mjs` và trình chạy tự nhận. Lấy phần dùng chung từ `tests/harness.mjs` (`check`, `report`, `page`, `formWith`, `submit`, `formDefaults`, `registerUser`, `statementPdf` và `statementXlsx` dựng file sao kê, `db`, `one`…; bộ trình duyệt thêm `browserCookies`), kết nối database bằng `await db.connect()`, đóng trong `finally` và kết thúc file bằng `report()`.

