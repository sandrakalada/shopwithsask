import Link from "next/link";

export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          background: "#fafaf9",
          color: "#1c1917",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>404 - الصفحة غير موجودة</h1>
        <Link
          href="/ar"
          style={{
            background: "#1c1917",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            borderRadius: "9999px",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          العودة للرئيسية
        </Link>
      </body>
    </html>
  );
}
