-- Danh mục hệ thống mặc định (userId NULL), dùng chung cho mọi user.
-- Chạy lại nhiều lần an toàn: chỉ thêm danh mục còn thiếu theo systemKey,
-- không ghi đè chỉnh sửa admin đã làm qua /admin/categories.
-- "name" là tên tiếng Việt dự phòng; UI nên dịch theo systemKey.
-- "icon" là tên icon lucide (bộ icon của shadcn/ui).

INSERT INTO "categories" ("id", "systemKey", "name", "type", "icon", "color", "updatedAt") VALUES
  (gen_random_uuid()::text, 'food',          'Ăn uống',             'EXPENSE', 'utensils',        '#F97316', now()),
  (gen_random_uuid()::text, 'transport',     'Di chuyển',           'EXPENSE', 'car',             '#3B82F6', now()),
  (gen_random_uuid()::text, 'housing',       'Nhà ở',               'EXPENSE', 'house',           '#8B5CF6', now()),
  (gen_random_uuid()::text, 'utilities',     'Hóa đơn & tiện ích',  'EXPENSE', 'receipt',         '#0EA5E9', now()),
  (gen_random_uuid()::text, 'shopping',      'Mua sắm',             'EXPENSE', 'shopping-bag',    '#EC4899', now()),
  (gen_random_uuid()::text, 'health',        'Sức khỏe',            'EXPENSE', 'heart-pulse',     '#EF4444', now()),
  (gen_random_uuid()::text, 'education',     'Giáo dục',            'EXPENSE', 'graduation-cap',  '#6366F1', now()),
  (gen_random_uuid()::text, 'entertainment', 'Giải trí',            'EXPENSE', 'film',            '#A855F7', now()),
  (gen_random_uuid()::text, 'family',        'Gia đình',            'EXPENSE', 'users',           '#F59E0B', now()),
  (gen_random_uuid()::text, 'insurance',     'Bảo hiểm',            'EXPENSE', 'shield',          '#14B8A6', now()),
  (gen_random_uuid()::text, 'gifts_given',   'Quà tặng & từ thiện', 'EXPENSE', 'gift',            '#F43F5E', now()),
  (gen_random_uuid()::text, 'other_expense', 'Chi phí khác',        'EXPENSE', 'circle-ellipsis', '#64748B', now()),
  (gen_random_uuid()::text, 'salary',        'Lương',               'INCOME',  'wallet',          '#22C55E', now()),
  (gen_random_uuid()::text, 'bonus',         'Thưởng',              'INCOME',  'award',           '#84CC16', now()),
  (gen_random_uuid()::text, 'business',      'Kinh doanh',          'INCOME',  'briefcase',       '#10B981', now()),
  (gen_random_uuid()::text, 'investment',    'Đầu tư',              'INCOME',  'trending-up',     '#06B6D4', now()),
  (gen_random_uuid()::text, 'gifts_received','Được tặng',           'INCOME',  'hand-coins',      '#EAB308', now()),
  (gen_random_uuid()::text, 'other_income',  'Thu nhập khác',       'INCOME',  'circle-plus',     '#64748B', now())
ON CONFLICT ("systemKey") DO NOTHING;
