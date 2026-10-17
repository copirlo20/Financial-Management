"use client";

// Last-resort boundary for errors in the root layout itself. It renders its own document without the app's
// styles or language provider, so the text is shown in both languages and styled inline.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "32rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Đã xảy ra lỗi · Something went wrong</h1>
        <p style={{ color: "#52514e" }}>
          Vui lòng thử lại sau ít phút. · Please try again in a few minutes.
        </p>
        <button onClick={() => retry()} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
          Thử lại · Try again
        </button>
      </body>
    </html>
  );
}
