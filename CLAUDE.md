# TaskFlow – Hướng dẫn cho AI

## Stack

React, Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, NodeJs, Express, Prisma + PostgreSQL, Zod

Mã tách thành `frontend/` (Next.js), `backend/` (Express API), `database/` (Prisma) và `shared/`, cùng cấp với `docs/`. Xem docs/STRUCTURE.md.

## Lệnh

Chạy ở thư mục gốc của dự án:

- npm run dev → chạy local (backend + frontend)
- npm run test → chạy test
- npm run lint → kiểm tra code
- npm run db:migrate → tạo migration (prisma migrate dev trong database/)

## Quy ước bắt buộc

- Mặc định dùng Server Component; chỉ thêm "use client" khi cần tương tác
- Mọi input phải validate bằng Zod ở phía server
- Mọi thao tác dữ liệu phải kiểm tra quyền của user ở server
- KHÔNG cài thêm thư viện khi chưa hỏi
- KHÔNG sửa file ngoài phạm vi task đang làm

## Tài liệu

docs/PRD.md, docs/ARCHITECTURE.md, docs/STRUCTURE.md, docs/PLAN.md, và luồng hoạt động của từng chức năng (docs/*-flow.md, mục lục ở mục "Tài liệu" của README.md; đọc docs/request-flow.md trước), docs/algorithms.md (thuật toán và quy trình xử lý), docs/api.md (bảng API), docs/testing.md (kiểm thử)
