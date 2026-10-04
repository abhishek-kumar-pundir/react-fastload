import React from "react";

/**
 * Stand-in for an expensive below-the-fold widget (e.g. a chart or comment
 * section) — deliberately its own chunk so both the baseline (React.lazy)
 * and ReactFastLoad (lazyComponent) pages can demonstrate deferred
 * code-splitting behavior against the same content.
 */
export default function HeavyWidgetC() {
  const rows = Array.from({ length: 30 }, (_, i) => i);
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3>HeavyWidgetC</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td style={{ padding: 4, borderBottom: "1px solid #eee" }}>Row {r + 1}</td>
              <td style={{ padding: 4, borderBottom: "1px solid #eee" }}>{(Math.random() * 1000).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
