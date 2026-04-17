interface ViewHeaderProps {
  title: string;
  subtitle?: string;
}

export function ViewHeader({ title, subtitle }: ViewHeaderProps) {
  return (
    <div style={{ padding: "32px 16px 24px 16px" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 30,
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          margin: "0 0 4px 0",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontSize: 13, color: "var(--ink-4)", margin: 0 }}>{subtitle}</p>
      )}
    </div>
  );
}
