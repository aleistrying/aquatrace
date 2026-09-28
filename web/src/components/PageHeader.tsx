export default function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h1 style={{ margin: 0 }}>{title}</h1>
      <p style={{ color: "var(--ink-soft)", margin: "0.25rem 0 0 0", fontSize: "0.95rem" }}>{subtitle}</p>
    </div>
  );
}
