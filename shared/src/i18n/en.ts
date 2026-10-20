// English translations, keyed by the Vietnamese source text used in the code.
// {0}, {1}… mark where values (a number, a currency, a month) are inserted.
export const en: Record<string, string> = {
  // ----- Common -----
  "Loại": "Type",
  "Tiền tệ": "Currency",
  "Đang lưu...": "Saving...",
  "Lưu thay đổi": "Save changes",
  "Hủy": "Cancel",
  "Sửa": "Edit",
  "Xóa": "Delete",
  "Đang xóa...": "Deleting...",
  "Lưu trữ": "Archive",
  "Khôi phục": "Restore",
  "Đã lưu trữ": "Archived",
  "Ngày": "Date",
  "Ghi chú": "Note",
  "Số tiền": "Amount",
  "Tất cả": "All",
  "Khác": "Other",
  "Email": "Email",
  "Mật khẩu": "Password",
  "Họ tên": "Full name",
  "Tháng": "Month",
  "Tháng {0}/{1}": "{0}/{1}",
  "T{0}/{1}": "{0}/{1}",
  "Tháng này": "This month",
  "tháng này": "this month",
  "Chọn tháng": "Choose month",
  "Xem dạng bảng": "View as table",
  "Ngôn ngữ / Language": "Ngôn ngữ / Language",

  // ----- Navigation -----
  "Điều hướng chính": "Main navigation",
  "Tổng quan": "Overview",
  "Giao dịch": "Transactions",
  "Ngân sách": "Budgets",
  "Tiết kiệm": "Savings",
  "Nhập sao kê": "Import statement",
  "Tài khoản": "Accounts",
  "Danh mục": "Categories",
  "Cài đặt": "Settings",
  "Quản trị danh mục": "Manage default categories",
  "Đăng xuất": "Sign out",
  "Quản lý tài chính cá nhân: thu chi, ngân sách, mục tiêu tiết kiệm.":
    "Personal finance: income and spending, budgets, savings goals.",

  // ----- Auth -----
  "Đăng nhập": "Sign in",
  "Theo dõi thu chi và ngân sách của bạn.": "Track your income, spending and budgets.",
  "Đang đăng nhập...": "Signing in...",
  "Chưa có tài khoản?": "No account yet?",
  "Đăng ký": "Sign up",
  "Tạo tài khoản": "Create account",
  "Miễn phí, chỉ mất chưa đầy một phút.": "Free, and it takes less than a minute.",
  "Ít nhất 8 ký tự, gồm cả chữ cái và chữ số.": "At least 8 characters, with both letters and digits.",
  "Nhập lại mật khẩu": "Confirm password",
  "Đang tạo tài khoản...": "Creating account...",
  "Đã có tài khoản?": "Already have an account?",
  "Email này đã được đăng ký.": "This email is already registered.",
  "Email hoặc mật khẩu không đúng.": "Incorrect email or password.",
  "Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.": "This account has been disabled. Please contact support.",
  "Vui lòng nhập email.": "Please enter your email.",
  "Email quá dài.": "Email is too long.",
  "Email không hợp lệ.": "Invalid email address.",
  "Vui lòng nhập mật khẩu.": "Please enter your password.",
  "Mật khẩu quá dài.": "Password is too long.",
  "Vui lòng nhập họ tên.": "Please enter your full name.",
  "Họ tên tối đa 100 ký tự.": "Full name can be at most 100 characters.",
  "Mật khẩu phải có ít nhất 8 ký tự.": "Password must be at least 8 characters.",
  "Mật khẩu tối đa 128 ký tự.": "Password can be at most 128 characters.",
  "Mật khẩu phải có ít nhất một chữ cái.": "Password must contain at least one letter.",
  "Mật khẩu phải có ít nhất một chữ số.": "Password must contain at least one digit.",
  "Vui lòng nhập lại mật khẩu.": "Please confirm your password.",
  "Mật khẩu nhập lại không khớp.": "Passwords do not match.",

  // ----- Accounts -----
  "Đã tạo tài khoản.": "Account created.",
  "Tên tài khoản": "Account name",
  "Ví dụ: Ví tiền mặt": "e.g. Cash wallet",
  "Không đổi được tiền tệ sau khi tạo tài khoản.": "The currency cannot be changed after the account is created.",
  "Số dư ban đầu": "Opening balance",
  "Chỉ nhập số, dùng dấu chấm cho phần lẻ. Số âm cho khoản đang nợ.":
    "Digits only, with a dot for decimals. Use a negative number for money you owe.",
  "Số dư hiện tại sẽ thay đổi đúng bằng phần chênh lệch.": "The current balance will change by exactly the difference.",
  "Thêm tài khoản": "Add account",
  "Tổng số dư": "Total balances",
  "Bạn chưa có tài khoản nào. Hãy thêm ví tiền mặt hoặc tài khoản ngân hàng đầu tiên.":
    "You have no accounts yet. Add your first cash wallet or bank account.",
  "Tiền mặt, ngân hàng, ví điện tử hoặc thẻ tín dụng.": "Cash, bank, e-wallet or credit card.",
  "Sửa tài khoản": "Edit account",
  "Tiền mặt": "Cash",
  "Tài khoản ngân hàng": "Bank account",
  "Ví điện tử": "E-wallet",
  "Thẻ tín dụng": "Credit card",
  "Không tìm thấy tài khoản.": "Account not found.",
  "Bạn đã có tài khoản với tên này.": "You already have an account with this name.",
  "Mỗi người dùng có tối đa {0} tài khoản, tính cả tài khoản đã lưu trữ.":
    "Each user can have at most {0} accounts, including archived ones.",
  "Vui lòng nhập tên tài khoản.": "Please enter an account name.",
  "Tên tài khoản tối đa 60 ký tự.": "Account name can be at most 60 characters.",
  "Loại tài khoản không hợp lệ.": "Invalid account type.",
  "Vui lòng nhập số dư ban đầu.": "Please enter an opening balance.",
  "Số dư không hợp lệ. Chỉ nhập số, ví dụ 1500000 hoặc 120.50.": "Invalid balance. Digits only, e.g. 1500000 or 120.50.",
  "Loại tiền tệ không được hỗ trợ.": "Unsupported currency.",

  // ----- Categories -----
  "Đã tạo danh mục.": "Category created.",
  "Mã": "Key",
  "Dùng để dịch tên sang ngôn ngữ khác. Không đổi được sau khi tạo.":
    "Used to translate the name into other languages. Cannot be changed after creation.",
  "Tên danh mục": "Category name",
  "Ví dụ: Cà phê": "e.g. Coffee",
  "Nhóm": "Group",
  "Không đổi được nhóm sau khi tạo danh mục.": "The group cannot be changed after the category is created.",
  "Danh mục cha": "Parent category",
  "Không có (danh mục gốc)": "None (top-level category)",
  "Danh mục cha phải cùng nhóm với danh mục đang tạo.": "The parent must be in the same group as the new category.",
  "Biểu tượng": "Icon",
  "Màu": "Color",
  "Thêm danh mục": "Add category",
  "Mặc định": "Default",
  "Danh mục con của {0}": "Subcategories of {0}",
  "Danh mục riêng của bạn, bên cạnh các danh mục mặc định.": "Your own categories, alongside the default ones.",
  "Sửa danh mục": "Edit category",
  "Danh mục này đang có danh mục con nên luôn là danh mục gốc.":
    "This category has subcategories, so it always stays top-level.",
  "Danh mục mặc định": "Default categories",
  "Dùng chung cho mọi người dùng. Thay đổi có hiệu lực ngay.": "Shared by all users. Changes take effect immediately.",
  "Thêm danh mục mặc định": "Add default category",
  "Mọi người dùng sẽ thấy danh mục này.": "Every user will see this category.",
  "Sửa danh mục mặc định": "Edit default category",
  "Khoản chi": "Expense",
  "Khoản thu": "Income",
  "Không tìm thấy danh mục.": "Category not found.",
  "Đã có danh mục mặc định cùng tên trong nhóm này.": "A default category with this name already exists in this group.",
  "Mã này đã được dùng.": "This key is already in use.",
  "Danh mục đang được người dùng sử dụng nên chưa thể xóa.": "This category is in use by users and cannot be deleted yet.",
  "Danh mục cha không hợp lệ.": "Invalid parent category.",
  "Danh mục cha phải cùng nhóm thu/chi.": "The parent category must be in the same income/expense group.",
  "Đã có danh mục cùng tên trong nhóm này.": "A category with this name already exists in this group.",
  "Mỗi người dùng có tối đa {0} danh mục riêng.": "Each user can have at most {0} custom categories.",
  "Danh mục này đang có danh mục con nên không thể đặt làm danh mục con.":
    "This category has subcategories, so it cannot become a subcategory itself.",
  "Danh mục đang được dùng trong giao dịch hoặc ngân sách nên chưa thể xóa.":
    "This category is used by transactions or budgets and cannot be deleted yet.",
  "Danh mục không hợp lệ.": "Invalid category.",
  "Vui lòng nhập tên danh mục.": "Please enter a category name.",
  "Tên danh mục tối đa 40 ký tự.": "Category name can be at most 40 characters.",
  "Loại danh mục không hợp lệ.": "Invalid category group.",
  "Biểu tượng không hợp lệ.": "Invalid icon.",
  "Màu không hợp lệ.": "Invalid color.",
  "Vui lòng nhập mã danh mục.": "Please enter a category key.",
  "Mã gồm 2–40 ký tự: chữ thường, số, dấu gạch dưới; bắt đầu bằng chữ cái.":
    "The key is 2–40 characters: lowercase letters, digits, underscores; starting with a letter.",
  // System category names (seeded in the database)
  "Ăn uống": "Food & drink",
  "Di chuyển": "Transport",
  "Nhà ở": "Housing",
  "Hóa đơn & tiện ích": "Bills & utilities",
  "Mua sắm": "Shopping",
  "Sức khỏe": "Health",
  "Giáo dục": "Education",
  "Giải trí": "Entertainment",
  "Gia đình": "Family",
  "Bảo hiểm": "Insurance",
  "Quà tặng & từ thiện": "Gifts & charity",
  "Chi phí khác": "Other expenses",
  "Lương": "Salary",
  "Thưởng": "Bonus",
  "Kinh doanh": "Business",
  "Đầu tư": "Investments",
  "Được tặng": "Gifts received",
  "Thu nhập khác": "Other income",
  "Chưa phân loại": "Uncategorized",
  "Khác ({0} danh mục)": "Other ({0} categories)",

  // ----- Transactions -----
  " (đã lưu trữ)": " (archived)",
  "Chuyển khoản": "Transfer",
  "Từ ngày": "From date",
  "Đến ngày": "To date",
  "Lọc": "Filter",
  "Xóa lọc": "Clear filters",
  "Không có giao dịch nào khớp bộ lọc.": "No transactions match the filters.",
  "Chưa có giao dịch nào.": "No transactions yet.",
  "Chuyển đến {0}": "Transfer to {0}",
  "Nhận từ {0}": "Received from {0}",
  "Phân trang": "Pagination",
  "Trang trước": "Previous page",
  "Trang sau": "Next page",
  "Chưa có tài khoản": "No accounts yet",
  "Bạn cần ít nhất một tài khoản để ghi giao dịch.": "You need at least one account to record transactions.",
  "Thêm giao dịch": "Add transaction",
  "Chuyển tiền giữa hai tài khoản của bạn.": "Move money between two of your accounts.",
  "Đã thêm giao dịch.": "Transaction added.",
  "Ví dụ: 50000": "e.g. 50000",
  "Chọn danh mục cùng nhóm với loại giao dịch.": "Pick a category in the same group as the transaction type.",
  "Đã chuyển khoản.": "Transfer recorded.",
  "Từ tài khoản": "From account",
  "Đến tài khoản": "To account",
  "Số tiền chuyển": "Amount sent",
  "Số tiền nhận": "Amount received",
  "Chỉ cần nhập khi hai tài khoản khác tiền tệ.": "Only needed when the two accounts use different currencies.",
  "Đang chuyển...": "Transferring...",
  "Sửa giao dịch": "Edit transaction",
  "Không tìm thấy giao dịch.": "Transaction not found.",
  "Danh mục không tồn tại hoặc không cùng loại với giao dịch.":
    "The category does not exist or does not match the transaction type.",
  "Tài khoản không tồn tại hoặc đã được lưu trữ.": "The account does not exist or has been archived.",
  "Hai tài khoản khác tiền tệ, vui lòng nhập số tiền nhận ({0}).":
    "The two accounts use different currencies; please enter the amount received ({0}).",
  "Hai tài khoản cùng tiền tệ nên số tiền nhận phải bằng số tiền chuyển (hoặc để trống).":
    "Both accounts use the same currency, so the amount received must equal the amount sent (or be left empty).",
  "Vui lòng chọn tài khoản.": "Please choose an account.",
  "Số tiền không hợp lệ. Chỉ nhập số, ví dụ 50000 hoặc 12.50.": "Invalid amount. Digits only, e.g. 50000 or 12.50.",
  "Số tiền phải lớn hơn 0.": "The amount must be greater than 0.",
  "Vui lòng chọn ngày.": "Please choose a date.",
  "Ngày không hợp lệ.": "Invalid date.",
  "Ngày nằm ngoài khoảng cho phép.": "The date is outside the allowed range.",
  "Ghi chú tối đa 200 ký tự.": "Notes can be at most 200 characters.",
  "Loại giao dịch không hợp lệ.": "Invalid transaction type.",
  "Vui lòng chọn danh mục.": "Please choose a category.",
  "Vui lòng chọn tài khoản nguồn.": "Please choose the source account.",
  "Vui lòng chọn tài khoản đích.": "Please choose the destination account.",
  "Vui lòng nhập số tiền nhận.": "Please enter the amount received.",
  "Vui lòng nhập số tiền.": "Please enter an amount.",
  "Tài khoản đích phải khác tài khoản nguồn.": "The destination account must differ from the source account.",

  // ----- Budgets -----
  "Đã đặt ngân sách.": "Budget set.",
  "Áp dụng cho": "Applies to",
  "Tổng chi tiêu của tháng": "All spending in the month",
  "Ngân sách của danh mục cha tính cả các danh mục con.": "A budget on a parent category also counts its subcategories.",
  "Ví dụ: 3000000": "e.g. 3000000",
  "Đặt ngân sách": "Set budget",
  "{0} ngân sách đã vượt hạn mức. ": "{0} budget(s) over the limit. ",
  "{0} ngân sách đã dùng từ {1}% trở lên.": "{0} budget(s) at {1}% or more.",
  "Sửa ngân sách": "Edit budget",
  "Tổng chi tiêu": "Total spending",
  "Vượt hạn mức {0}": "Over the limit by {0}",
  "Còn {0}": "{0} left",
  "Sắp chạm hạn mức · {0}": "Near the limit · {0}",
  "Đã dùng ngân sách {0}": "Budget used: {0}",
  "Không tìm thấy ngân sách.": "Budget not found.",
  "Chỉ đặt được ngân sách cho danh mục khoản chi của bạn.": "Budgets can only be set for your expense categories.",
  "Tháng này đã có ngân sách cho mục này.": "This month already has a budget for this item.",
  "Tháng không hợp lệ.": "Invalid month.",
  "Tháng nằm ngoài khoảng cho phép.": "The month is outside the allowed range.",
  "Vui lòng nhập hạn mức.": "Please enter a limit.",

  // ----- Dashboard -----
  "Đã chi": "Spent",
  "Thu nhập": "Income",
  "Chi tiêu": "Spending",
  "Số liệu chính": "Key figures",
  "Chênh lệch thu − chi": "Income − spending",
  "Chi nhiều hơn thu": "Spent more than earned",
  "Thu nhiều hơn chi": "Earned more than spent",
  "Số dư hiện tại": "Current balances",
  "Xem tài khoản": "View accounts",
  "Bạn chưa có tài khoản nào.": "You have no accounts yet.",
  "Chi tiêu theo danh mục": "Spending by category",
  "Chưa có khoản chi nào trong tháng này.": "No spending this month yet.",
  "Tỷ trọng": "Share",
  "Chưa có giao dịch nào trong khoảng thời gian này.": "No transactions in this period.",
  "Chênh lệch": "Difference",
  "Xem ngân sách": "View budgets",
  "Bạn chưa đặt ngân sách nào cho tháng này.": "You have not set any budgets for this month.",
  "Cả {0} ngân sách đều đang trong hạn mức.": "All {0} budgets are within their limits.",

  // ----- Imports -----
  "Chưa có lần nhập nào. Tải file sao kê từ ngân hàng để thêm nhiều giao dịch cùng lúc.":
    "No imports yet. Upload a bank statement file to add many transactions at once.",
  " · {0} giao dịch, bỏ qua {1} trùng": " · {0} transactions, {1} duplicates skipped",
  "Tiếp tục": "Continue",
  "Chi tiết": "Details",
  "Tải file sao kê": "Upload statement",
  "Bước 1/2: chọn tài khoản và file.": "Step 1 of 2: choose the account and the file.",
  "Thêm tài khoản trước": "Add an account first",
  "Chưa có file sao kê?": "No statement file yet?",
  "Tải file mẫu, thay các dòng ví dụ bằng giao dịch của bạn rồi tải lên. Số âm là khoản chi, số dương là khoản thu.":
    "Download a template, replace the example rows with your transactions, then upload it. Negative amounts are expenses, positive amounts are income.",
  "File mẫu Excel": "Excel template",
  "Chờ xác nhận": "Awaiting confirmation",
  "Đã nhập": "Imported",
  "Lỗi": "Failed",
  "Đã hoàn tác": "Rolled back",
  "Nhập vào tài khoản": "Import into account",
  "File sao kê": "Statement file",
  "Đang tải lên...": "Uploading...",
  "Tải lên và xem trước": "Upload and preview",
  "Ngày/Tháng/Năm (31/12/2026)": "Day/Month/Year (31/12/2026)",
  "Tháng/Ngày/Năm (12/31/2026)": "Month/Day/Year (12/31/2026)",
  "Năm-Tháng-Ngày (2026-12-31)": "Year-Month-Day (2026-12-31)",
  "Một cột: số âm là chi, số dương là thu": "One column: negative is expense, positive is income",
  "Hai cột: tiền ra và tiền vào riêng": "Two columns: money out and money in",
  "Dấu chấm (1,500,000.50)": "Dot (1,500,000.50)",
  "Dấu phẩy (1.500.000,50)": "Comma (1.500.000,50)",
  "Không dùng": "Not used",
  "Dòng tiêu đề": "Header row",
  "Dữ liệu được đọc từ dòng ngay sau dòng này. Nhập 0 nếu file không có dòng tiêu đề.":
    "Data is read starting from the row after this one. Enter 0 if the file has no header row.",
  "Cột diễn giải": "Description column",
  "Được lưu làm ghi chú của giao dịch.": "Saved as the transaction's note.",
  "Cột ngày": "Date column",
  "Định dạng ngày": "Date format",
  "Kiểu cột số tiền": "Amount layout",
  "Dấu thập phân": "Decimal separator",
  "Cột số tiền (kiểu một cột)": "Amount column (one-column layout)",
  "Cột tiền ra (kiểu hai cột)": "Money-out column (two-column layout)",
  "Cột tiền vào (kiểu hai cột)": "Money-in column (two-column layout)",
  "Danh mục cho khoản chi": "Category for expenses",
  "Sửa từng giao dịch sau khi nhập nếu cần.": "You can edit individual transactions after importing.",
  "Danh mục cho khoản thu": "Category for income",
  "Đang nhập...": "Importing...",
  "Xác nhận và nhập giao dịch": "Confirm and import",
  "Chi tiết lần nhập": "Import details",
  "Hủy lần nhập này": "Cancel this import",
  "Kết quả": "Result",
  "Lần nhập này đã được hoàn tác; các giao dịch của nó đã bị xóa.":
    "This import was rolled back; its transactions have been deleted.",
  "Bỏ qua vì trùng": "Skipped as duplicates",
  "Dòng lỗi": "Rows with errors",
  "Dòng bị bỏ qua là dòng trùng ngày, số tiền và diễn giải với giao dịch đã nhập trước đó vào tài khoản này.":
    "Skipped rows have the same date, amount and description as a transaction already imported into this account.",
  "Các dòng không đọc được": "Rows that could not be read",
  "Mỗi dòng kèm lý do và toàn bộ dữ liệu của dòng đó trong file, để bạn đối chiếu với sao kê.":
    "Each row comes with the reason and everything it held in the file, so you can check it against the statement.",
  "Dòng": "Row",
  "Lý do": "Reason",
  "Xem giao dịch của tài khoản": "View the account's transactions",
  "File tạm của lần nhập này không còn. Hãy hủy và tải file lên lại.":
    "The temporary file for this import is gone. Cancel it and upload the file again.",
  "Xem trước": "Preview",
  "Ghép cột": "Map columns",
  "Bước 2/2: cho biết cột nào là ngày, số tiền và diễn giải. Các lựa chọn đã được đoán sẵn theo tên cột.":
    "Step 2 of 2: tell us which columns hold the date, amount and description. The choices are pre-filled from the column names.",
  "Đang hoàn tác...": "Rolling back...",
  "Hoàn tác lần nhập này": "Roll back this import",
  "Dòng {0}: {1}": "Row {0}: {1}",
  "… và {0} dòng khác.": "… and {0} more rows.",
  "Vui lòng chọn file sao kê.": "Please choose a statement file.",
  "File vượt quá 5 MB.": "The file is larger than 5 MB.",
  "Bạn đang có {0} lần nhập chưa hoàn tất. Hãy xác nhận hoặc hủy bớt trước khi tải file mới.":
    "You have {0} unfinished imports. Confirm or cancel some before uploading a new file.",
  "Không tìm thấy lần nhập.": "Import not found.",
  "Lần nhập này không còn chờ xác nhận.": "This import is no longer awaiting confirmation.",
  "Tài khoản đã được lưu trữ nên không nhập thêm được.": "The account is archived, so nothing more can be imported into it.",
  "Danh mục khoản chi không hợp lệ.": "Invalid expense category.",
  "Danh mục khoản thu không hợp lệ.": "Invalid income category.",
  "File tạm đã bị xóa. Hãy hủy lần nhập này và tải file lên lại.":
    "The temporary file was deleted. Cancel this import and upload the file again.",
  "Không đọc được dòng giao dịch nào với cách ghép cột này. Hãy kiểm tra lại dòng tiêu đề, cột ngày và cột số tiền.":
    "No transaction rows could be read with this column mapping. Check the header row, the date column and the amount column.",
  "Lần nhập này không thể hoàn tác.": "This import cannot be rolled back.",
  "Có {0} giao dịch trong lần nhập này đã được sửa tay nên không hoàn tác được cả lô. Hãy xóa từng giao dịch nếu cần.":
    "{0} transaction(s) from this import were edited by hand, so the whole batch cannot be rolled back. Delete transactions individually if needed.",
  "Ngày không hợp lệ hoặc không đúng định dạng đã chọn.": "The date is invalid or does not match the chosen format.",
  "Số tiền không hợp lệ.": "Invalid amount.",
  "Thiếu số tiền hoặc số tiền bằng 0.": "The amount is missing or zero.",
  "Dòng có cả số tiền chi và số tiền thu.": "The row has both a money-out and a money-in amount.",
  "Không đọc được file. Hãy kiểm tra file có đúng định dạng Excel (.xlsx) không.":
    "The file could not be read. Check that it is a valid Excel (.xlsx) file.",
  "File không có dữ liệu.": "The file has no data.",
  "File có {0} dòng, vượt giới hạn {1} dòng mỗi lần nhập.": "The file has {0} rows, over the limit of {1} rows per import.",
  "Vui lòng chọn cột.": "Please choose a column.",
  "Cột không hợp lệ.": "Invalid column.",
  "Dòng tiêu đề không hợp lệ.": "Invalid header row.",
  "Định dạng ngày không hợp lệ.": "Invalid date format.",
  "Kiểu cột số tiền không hợp lệ.": "Invalid amount layout.",
  "Dấu thập phân không hợp lệ.": "Invalid decimal separator.",
  "Vui lòng chọn danh mục cho khoản chi.": "Please choose a category for expenses.",
  "Vui lòng chọn danh mục cho khoản thu.": "Please choose a category for income.",
  "Vui lòng chọn cột số tiền.": "Please choose the amount column.",
  "Vui lòng chọn cột tiền ra.": "Please choose the money-out column.",
  "Vui lòng chọn cột tiền vào.": "Please choose the money-in column.",
  "Cột tiền vào phải khác cột tiền ra.": "The money-in column must differ from the money-out column.",

  // ----- Savings goals -----
  "Tên mục tiêu": "Goal name",
  "Ví dụ: Quỹ khẩn cấp": "e.g. Emergency fund",
  "Số tiền mục tiêu": "Target amount",
  "Ví dụ: 50000000": "e.g. 50000000",
  "Không đổi được tiền tệ sau khi tạo mục tiêu.": "The currency cannot be changed after the goal is created.",
  "Hạn chót (không bắt buộc)": "Deadline (optional)",
  "Tạo mục tiêu": "Create goal",
  "Tiến độ mục tiêu {0}": "Progress of goal {0}",
  "Còn thiếu {0}": "{0} to go",
  "Mục tiêu tiết kiệm": "Savings goals",
  "Chưa có mục tiêu nào. Đặt một mục tiêu để theo dõi số tiền bạn để dành.":
    "No goals yet. Set one to track the money you put aside.",
  "Thêm mục tiêu": "Add goal",
  "Mục tiêu chỉ để theo dõi số tiền để dành, không làm thay đổi số dư các tài khoản.":
    "Goals only track money you set aside; they do not change your account balances.",
  "Đã ghi nhận.": "Recorded.",
  "Nạp thêm": "Deposit",
  "Rút ra": "Withdrawal",
  "Ghi nhận": "Record",
  "Sửa mục tiêu": "Edit goal",
  "← Mục tiêu tiết kiệm": "← Savings goals",
  "Xóa mục tiêu": "Delete goal",
  "Lịch sử nạp và rút": "Deposits and withdrawals",
  "Chưa có khoản nào. Ghi nhận lần nạp đầu tiên của bạn.": "Nothing recorded yet. Record your first deposit.",
  "Ghi nhận nạp / rút": "Record a deposit / withdrawal",
  "Mục tiêu đã lưu trữ. Khôi phục để ghi thêm.": "This goal is archived. Restore it to record more.",
  "Đang tiết kiệm": "In progress",
  "Đã đạt mục tiêu": "Goal reached",
  "Đã quá hạn {0} ngày": "{0} days overdue",
  "Còn {0} ngày · cần khoảng {1} mỗi tháng": "{0} days left · about {1} per month needed",
  "Không tìm thấy mục tiêu.": "Goal not found.",
  "Bạn đã có mục tiêu với tên này.": "You already have a goal with this name.",
  "Mỗi người dùng có tối đa {0} mục tiêu tiết kiệm.": "Each user can have at most {0} savings goals.",
  "Mục tiêu đã được lưu trữ. Hãy khôi phục trước khi ghi thêm.": "The goal is archived. Restore it before recording more.",
  "Không thể rút nhiều hơn số tiền đã tiết kiệm.": "You cannot withdraw more than you have saved.",
  "Không tìm thấy khoản này.": "Entry not found.",
  "Không xóa được: số tiền này đã được rút ra ở các lần sau. Hãy xóa lần rút trước.":
    "Cannot delete: this money was withdrawn later. Delete the withdrawal first.",
  "Vui lòng nhập tên mục tiêu.": "Please enter a goal name.",
  "Tên mục tiêu tối đa 60 ký tự.": "Goal name can be at most 60 characters.",
  "Vui lòng nhập số tiền mục tiêu.": "Please enter a target amount.",
  "Loại không hợp lệ.": "Invalid type.",

  // ----- Settings & exchange rates -----
  "Hồ sơ": "Profile",
  "Tỷ giá": "Exchange rates",
  "Cập nhật lúc {0}.": "Updated {0}.",
  "Chưa có tỷ giá nào được lưu.": "No exchange rates stored yet.",
  "Nguồn cập nhật mỗi ngày một lần.": "The source updates once a day.",
  "Chưa có tỷ giá": "No rate yet",
  "Tỷ giá từ": "Rates from",
  ". Chỉ để tham khảo, có thể khác tỷ giá ngân hàng của bạn.": ". For reference only; your bank's rate may differ.",
  "Đang cập nhật...": "Updating...",
  "Cập nhật tỷ giá ngay": "Update rates now",
  "Đã lưu cài đặt.": "Settings saved.",
  "Ngôn ngữ": "Language",
  "Tiền tệ mặc định": "Default currency",
  "Báo cáo, tổng quan và ngân sách được quy về tiền tệ này. Khi đổi, số liệu cũ được quy đổi lại theo tỷ giá của ngày giao dịch, và hạn mức ngân sách được quy đổi theo tỷ giá hiện tại.":
    "Reports, the overview and budgets are shown in this currency. When you change it, past figures are re-converted at each transaction date's rate, and budget limits are converted at the current rate.",
  "Lưu cài đặt": "Save settings",
  "Ngôn ngữ không được hỗ trợ.": "Unsupported language.",
  "Chưa có tỷ giá giữa {0} và {1} nên chưa đổi được tiền tệ mặc định.":
    "There is no exchange rate between {0} and {1} yet, so the default currency cannot be changed.",
  "Không lấy được tỷ giá mới. Đang dùng tỷ giá đã lưu.": "Could not fetch new rates. Using the stored rates.",
  "Tỷ giá vừa được cập nhật trong 10 phút qua.": "Rates were already updated within the last 10 minutes.",
  "Đã cập nhật tỷ giá.": "Rates updated.",
  // ----- Whole-sentence templates and exchange-rate admin -----
  "Tổng {0}": "Total {0}",
  "Tổng quy đổi sang {0}": "Total converted to {0}",
  "Chưa gồm {0} (chưa có tỷ giá)": "Excludes {0} (no exchange rate yet)",
  "Đã lưu trữ ({0})": "Archived ({0})",
  "Hạn mức ({0})": "Limit ({0})",
  "Số tiền ({0})": "Amount ({0})",
  "Ngân sách {0}": "Budgets for {0}",
  "{0} khoản chi ngoại tệ trong tháng chưa có tỷ giá quy đổi nên chưa được tính vào ngân sách.": "{0} foreign-currency expense(s) this month have no exchange rate yet, so they are not counted toward budgets.",
  "Chưa có ngân sách nào cho {0}.": "No budgets yet for {0}.",
  "Sao chép {0} ngân sách từ {1}": "Copy {0} budget(s) from {1}",
  "Hạn mức chi cho {0}.": "Spending limits for {0}.",
  "{0} · {1}": "{0} · {1}",
  "Xin chào, {0}": "Hello, {0}",
  "Tổng quan {0} · quy về {1}": "Overview for {0} · shown in {1}",
  "{0} giao dịch ngoại tệ trong tháng chưa có tỷ giá quy đổi nên chưa được tính vào các số liệu trên.": "{0} foreign-currency transaction(s) this month have no exchange rate yet, so they are not included in the figures above.",
  "{0}, danh mục con được gộp vào danh mục cha.": "{0}, with subcategories rolled into their parent.",
  "Thu và chi {0} tháng gần nhất": "Income and spending over the last {0} months",
  "Từ {0} đến {1}.": "From {0} to {1}.",
  "Cảnh báo ngân sách {0}": "Budget alerts for {0}",
  "{0} · Tài khoản {1} ({2})": "{0} · Account {1} ({2})",
  "{0} dòng đầu trong tổng số {1} dòng có dữ liệu.": "The first {0} of {1} rows with data.",
  "Hạn chót {0}": "Deadline {0}",
  "Đang hiện {0} khoản gần nhất trong tổng số {1}.": "Showing the latest {0} of {1} entries.",
  "Trang {0}/{1} · {2} giao dịch": "Page {0} of {1} · {2} transactions",
  "Quản trị tỷ giá": "Manage exchange rates",
  "Mọi tỷ giá được lưu theo dạng 1 {0} = bao nhiêu đơn vị tiền kia. Dùng chung cho mọi người dùng.": "Every rate is stored as how much of the other currency 1 {0} buys. Shared by all users.",
  "Tỷ giá mới nhất": "Latest rates",
  "1 {0} =": "1 {0} =",
  "Nguồn": "Source",
  "Nhập tay": "Manual",
  "Tự động": "Automatic",
  "Tỷ giá nhập tay": "Manual rates",
  "Chưa có tỷ giá nhập tay nào. Mọi tỷ giá đang lấy tự động từ nguồn.": "No manual rates. Every rate currently comes from the automatic source.",
  "{0} · 1 {1} = {2} {3}": "{0} · 1 {1} = {2} {3}",
  "Nhập tỷ giá": "Enter a rate",
  "Dùng khi nguồn tự động lỗi hoặc cần tỷ giá cho một ngày trong quá khứ.": "Use this when the automatic source fails or you need a rate for a past date.",
  "Đã lưu tỷ giá.": "Rate saved.",
  "Tỷ giá: 1 {0} bằng bao nhiêu?": "Rate: how much does 1 {0} buy?",
  "Ví dụ: 25900": "e.g. 25900",
  "Tỷ giá nhập tay không bị cập nhật tự động ghi đè. Giao dịch đã ghi giữ nguyên tỷ giá lúc ghi.": "Manual rates are not overwritten by automatic updates. Transactions already recorded keep the rate they were recorded with.",
  "Lưu tỷ giá": "Save rate",
  "Vui lòng nhập tỷ giá.": "Please enter a rate.",
  "Tỷ giá không hợp lệ. Chỉ nhập số, tối đa 6 chữ số thập phân.": "Invalid rate. Digits only, with at most 6 decimal places.",
  "Tỷ giá phải lớn hơn 0.": "The rate must be greater than 0.",
  // ----- Loading, errors, confirmations -----
  "Đã xảy ra lỗi": "Something went wrong",
  "Không tải được trang này. Hãy thử lại; nếu vẫn lỗi, vui lòng quay lại sau.":
    "This page could not be loaded. Try again; if it keeps failing, please come back later.",
  "Mã lỗi: {0}": "Error code: {0}",
  "Thử lại": "Try again",
  "Về trang tổng quan": "Back to overview",
  "Không tìm thấy trang": "Page not found",
  "Trang này không tồn tại hoặc bạn không có quyền xem.": "This page does not exist or you do not have access to it.",
  "Xóa giao dịch này?": "Delete this transaction?",
  "Xóa ngân sách này?": "Delete this budget?",
  "Bộ lọc": "Filters",
  "Đang tải...": "Loading...",
  "Sao kê PDF tải từ ngân hàng hoặc file Excel (.xlsx), tối đa 5 MB và 10.000 dòng. Chưa có gì được ghi cho tới khi bạn xác nhận ở bước sau.":
    "A PDF statement downloaded from your bank or an Excel file (.xlsx), up to 5 MB and 10,000 rows. Nothing is saved until you confirm in the next step.",
  "Chỉ hỗ trợ file .pdf và .xlsx (file .xls cũ cần lưu lại thành .xlsx).":
    "Only .pdf and .xlsx files are supported (save an old .xls file as .xlsx first).",
  "File PDF có mật khẩu. Hãy tải sao kê không đặt mật khẩu, hoặc mở file rồi in lại thành PDF không có mật khẩu.":
    "The PDF is password-protected. Download the statement without a password, or open it and print it again as a PDF without one.",
  "File PDF có hơn {0} trang. Hãy tải sao kê theo khoảng thời gian ngắn hơn.":
    "The PDF has more than {0} pages. Download the statement for a shorter period.",
  "File PDF không có chữ để đọc (có thể là bản scan hoặc ảnh chụp). Hãy tải sao kê PDF gốc từ ngân hàng.":
    "The PDF has no text to read (it may be a scan or a photo). Download the original PDF statement from your bank.",
  "Dùng trợ lý AI ({0}) để phân tích file": "Use the AI assistant ({0}) to analyse the file",
  "Trợ lý đọc toàn bộ file, liệt kê các giao dịch và gợi ý danh mục cho từng giao dịch, và đọc được cả PDF scan. Nội dung file được gửi tới {0} để phân tích; bỏ chọn nếu bạn muốn tự ghép cột.":
    "The assistant reads the whole file, lists its transactions and suggests a category for each, and can read scanned PDFs too. The file's contents are sent to {0} for analysis; untick this to map the columns yourself.",
  "Đang tải lên và phân tích...": "Uploading and analysing...",
  "Giao dịch trợ lý AI đọc được": "Transactions the AI assistant read",
  "Trợ lý AI đọc được {0} giao dịch từ file. Hãy đối chiếu ngày và số tiền với sao kê trước khi xác nhận, vì AI có thể đọc nhầm.":
    "The AI assistant read {0} transaction(s) from the file. Check the dates and amounts against your statement before confirming, because the AI can misread.",
  "Trợ lý AI không đọc được file này, nên bạn cần tự ghép cột bên dưới.":
    "The AI assistant could not read this file, so you need to map the columns below yourself.",
  "Danh mục cho từng giao dịch": "Category for each transaction",
  "Trợ lý AI đề xuất danh mục theo diễn giải. Hãy sửa những dòng chưa đúng; dòng để trống dùng danh mục mặc định ở trên.":
    "The AI assistant suggests categories from the descriptions. Fix the rows that are wrong; rows left empty use the default category above.",
  "Diễn giải": "Description",
  "Danh mục cho dòng {0}": "Category for row {0}",
  "Theo danh mục mặc định": "Use the default category",
  "Đang hiện {0} trong {1} giao dịch. Các giao dịch còn lại dùng danh mục trợ lý AI đề xuất, hoặc danh mục mặc định nếu không có đề xuất.":
    "Showing {0} of {1} transactions. The rest use the category the AI assistant suggested, or the default category when it suggested none.",
  "Không đọc được file. Hãy kiểm tra file có đúng định dạng PDF không.":
    "The file could not be read. Check that it really is a PDF.",
  "Bạn đã dùng trợ lý AI nhiều lần trong một giờ qua. Hãy thử lại sau, hoặc bỏ chọn trợ lý AI để tự ghép cột.":
    "You have used the AI assistant many times in the past hour. Try again later, or untick the AI assistant to map the columns yourself.",
  "Trợ lý AI không tìm thấy giao dịch nào trong file PDF này.": "The AI assistant found no transactions in this PDF.",
  "Trợ lý AI chưa được cấu hình trên máy chủ.": "The AI assistant is not set up on this server.",
  "Khóa API của trợ lý AI không hợp lệ. Hãy báo cho quản trị viên.":
    "The AI assistant's API key is not valid. Please tell the administrator.",
  "Trợ lý AI đang quá tải. Hãy thử lại sau ít phút.": "The AI assistant is overloaded. Try again in a few minutes.",
  "Trợ lý AI không phân tích được file này. Hãy thử lại.": "The AI assistant could not analyse this file. Try again.",
  "File PDF có quá nhiều giao dịch để đọc trong một lần. Hãy tách thành các file nhỏ hơn.":
    "This PDF has too many transactions to read in one go. Split it into smaller files.",
  "Lối tắt":
    "Shortcuts",
  "Giao dịch gần đây":
    "Recent transactions",
  "Xem tất cả":
    "View all",
  "Xóa lần nhập \"{0}\"":
    "Delete the import \"{0}\"",
  "Xóa lần nhập này":
    "Delete this import",
  "Theo dõi thu chi và số dư của mọi tài khoản":
    "Track income, spending and the balance of every account",
  "Đặt ngân sách và được nhắc khi sắp vượt hạn mức":
    "Set budgets and get warned before you go over",
  "Nhập sao kê ngân hàng với trợ lý AI":
    "Import bank statements with the AI assistant",
  "Quản lý tài chính cá nhân.":
    "Personal finance management.",
  "Tin nhắn không hợp lệ.":
    "That message is not valid.",
  "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.":
    "Your session has expired. Please sign in again.",
  "Bạn đã gửi nhiều tin nhắn trong một giờ qua. Hãy thử lại sau.":
    "You have sent many messages in the past hour. Try again later.",
  "Trợ lý AI không trả lời được lúc này. Hãy thử lại.":
    "The AI assistant cannot answer right now. Try again.",
  "Tháng này tôi đã chi bao nhiêu?":
    "How much have I spent this month?",
  "Ngân sách nào sắp vượt hạn mức?":
    "Which budgets are close to their limit?",
  "Khoản chi lớn nhất tháng này là gì?":
    "What is my biggest expense this month?",
  "Làm sao để nhập sao kê ngân hàng?":
    "How do I import a bank statement?",
  "Mở trợ lý AI":
    "Open the AI assistant",
  "Trợ lý tài chính":
    "Finance assistant",
  "Hỏi về chi tiêu, ngân sách hoặc cách dùng ứng dụng":
    "Ask about spending, budgets or how to use the app",
  "Xóa hội thoại":
    "Clear the conversation",
  "Đóng":
    "Close",
  "Tôi xem được số liệu của bạn để trả lời, nhưng không thay đổi được gì trong ứng dụng.":
    "I can look at your figures to answer, but I cannot change anything in the app.",
  "Đang trả lời...":
    "Answering...",
  "Nhập câu hỏi...":
    "Type a question...",
  "Câu hỏi cho trợ lý":
    "Question for the assistant",
  "Gửi":
    "Send",
  "Câu hỏi và số liệu liên quan được gửi tới {0} để trả lời. AI có thể sai; hãy kiểm tra lại số liệu quan trọng.":
    "Your questions and the figures they need are sent to {0} to answer. The AI can be wrong; double-check figures that matter.",
  "Tài khoản của trợ lý AI đã hết tín dụng. Hãy báo cho quản trị viên.":
    "The AI assistant's account has run out of credit. Please tell the administrator.",
  "Quản trị":
    "Admin",
  "Mục khác":
    "More sections",
  "Thêm":
    "More",
  "Bảo mật":
    "Security",
  "Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác.":
    "Changing the password signs out every other device.",
  "Nghi có người khác đang dùng tài khoản? Kết thúc mọi phiên đăng nhập, kể cả trên thiết bị này.":
    "Think someone else is using your account? End every session, this device included.",
  "Đăng xuất khỏi mọi thiết bị":
    "Sign out of every device",
  "Mật khẩu hiện tại":
    "Current password",
  "Mật khẩu mới":
    "New password",
  "Nhập lại mật khẩu mới":
    "Repeat the new password",
  "Ít nhất 8 ký tự, có cả chữ và số.":
    "At least 8 characters, with letters and digits.",
  "Đổi mật khẩu":
    "Change password",
  "Có quá nhiều lần đăng nhập từ địa chỉ này. Hãy thử lại sau {0} phút.":
    "Too many sign-in attempts from this address. Try again in {0} minute(s).",
  "Đăng nhập tạm khóa vì nhập sai quá nhiều lần. Hãy thử lại sau {0} phút.":
    "Signing in is locked for a while after too many wrong passwords. Try again in {0} minute(s).",
  "Có quá nhiều tài khoản được tạo từ địa chỉ này. Hãy thử lại sau {0} phút.":
    "Too many accounts were created from this address. Try again in {0} minute(s).",
  "Hệ thống đang bận. Hãy thử lại sau ít giây.":
    "The system is busy. Try again in a few seconds.",
  "Mật khẩu hiện tại không đúng.":
    "The current password is not correct.",
  "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.":
    "Password changed. Your other devices have been signed out.",
  "File Excel quá lớn khi giải nén. Hãy tách thành nhiều file nhỏ hơn.":
    "This Excel file is too large once unpacked. Split it into smaller files.",
  "Vui lòng nhập mật khẩu mới.":
    "Please enter a new password.",
  "Vui lòng nhập mật khẩu hiện tại.":
    "Please enter your current password.",
  "Vui lòng nhập lại mật khẩu mới.":
    "Please repeat the new password.",
  "Mật khẩu mới phải khác mật khẩu hiện tại.":
    "The new password must differ from the current one.",
  "Trợ lý AI đã dùng hết hạn mức hôm nay. Hãy thử lại vào ngày mai.":
    "The AI assistant has used up today's allowance. Try again tomorrow.",
  "Xuất sao kê PDF":
    "Export PDF statement",
  "Sao kê theo mẫu ngân hàng: số dư đầu kỳ, ghi nợ, ghi có và từng giao dịch trong khoảng thời gian bạn chọn.":
    "A bank-style statement: opening balance, debits, credits and every transaction in the period you choose.",
  "Tất cả tài khoản (quy về {0})":
    "All accounts (in {0})",
  "Tải sao kê PDF":
    "Download PDF statement",
  "Khoảng thời gian không hợp lệ: ngày bắt đầu phải trước hoặc bằng ngày kết thúc.":
    "Invalid period: the start date must be on or before the end date.",
  "Mỗi sao kê tối đa 3 năm. Hãy chọn khoảng thời gian ngắn hơn.":
    "A statement covers at most 3 years. Choose a shorter period.",
  "Khoảng thời gian này có quá nhiều giao dịch (tối đa 3.000). Hãy chọn khoảng ngắn hơn.":
    "This period has too many transactions (at most 3,000). Choose a shorter one.",
  "Bạn đã xuất nhiều sao kê trong một giờ qua. Hãy thử lại sau.":
    "You have exported many statements in the past hour. Try again later.",
  "Không tạo được sao kê. Hãy thử lại.":
    "The statement could not be created. Try again.",
  "Thao tác này không thể hoàn tác.":
    "This cannot be undone.",
  "Xác nhận":
    "Confirm",
  "Hoàn tác":
    "Undo",
  "Giao diện tối":
    "Dark mode",
  "Giao diện":
    "Appearance",
  "Sáng":
    "Light",
  "Tối":
    "Dark",
  "Theo thiết bị":
    "Match device",
  "Chọn giao diện sáng, tối hoặc theo cài đặt của thiết bị. Lựa chọn được lưu trên thiết bị này.":
    "Choose a light or dark appearance, or follow your device's setting. The choice is kept on this device.",
  "Xóa danh mục này?":
    "Delete this category?",
  "Xóa lần nhập này?":
    "Delete this import?",
  "Xóa kèm {0} giao dịch của nó và trả lại số dư tài khoản. Thao tác này không thể hoàn tác.":
    "This also deletes its {0} transactions and restores the account balance. This cannot be undone.",
  "Hoàn tác lần nhập này?":
    "Roll back this import?",
  "Xóa {0} giao dịch của lần nhập này và trả lại số dư tài khoản. Thao tác này không thể hoàn tác.":
    "This deletes the {0} transactions of this import and restores the account balance. This cannot be undone.",
  "Xóa mục tiêu này?":
    "Delete this goal?",
  "Toàn bộ lịch sử gửi/rút của mục tiêu cũng bị xóa. Thao tác này không thể hoàn tác.":
    "The goal's whole deposit and withdrawal history is deleted too. This cannot be undone.",
  "Đăng xuất khỏi mọi thiết bị?":
    "Sign out of every device?",
  "Kể cả thiết bị này. Bạn sẽ phải đăng nhập lại trên mọi thiết bị.":
    "This one included. You will have to sign in again on every device.",
  "Mất kết nối tới máy chủ khi đang lưu. Thay đổi có thể đã được lưu hoặc chưa, hãy kiểm tra lại trước khi gửi lại.":
    "The connection to the server was lost while saving. The change may or may not have been saved: check before sending it again.",
  "Không kết nối được máy chủ nên chưa có gì thay đổi. Hãy thử lại sau giây lát.":
    "Could not reach the server, so nothing was changed. Try again in a moment.",
  "dd/mm/yyyy": "dd/mm/yyyy",
  "Chọn ngày trên lịch": "Pick the date on a calendar",
};
