import React from "react";

/** Small shared presentational pieces so every Scenario Lab panel looks consistent — screenshot-friendly, not flashy. */

export const labTheme = {
  bg: "#0a0a0a",
  card: "#131313",
  border: "#262626",
  text: "#e5e5e5",
  dim: "#8a8a8a",
  accent: "#22c55e",
};

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: labTheme.card,
        border: `1px solid ${labTheme.border}`,
        borderRadius: 10,
        padding: 16,
        color: labTheme.text,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: subtitle ? 2 : 10 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: labTheme.dim, marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: variant === "primary" ? labTheme.accent : "transparent",
        color: variant === "primary" ? "#06240f" : labTheme.text,
        border: variant === "primary" ? "none" : `1px solid ${labTheme.border}`,
        borderRadius: 6,
        padding: "6px 14px",
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 1,
  max = 50,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: labTheme.dim }}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        style={{
          background: "#0e0e0e",
          border: `1px solid ${labTheme.border}`,
          borderRadius: 4,
          padding: "4px 8px",
          color: labTheme.text,
          width: 70,
        }}
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
