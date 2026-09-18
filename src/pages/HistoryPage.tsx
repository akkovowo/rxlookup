import { useEffect, useState } from "react";
import { apiGet, type HistoryItem } from "@/lib/api";

export function HistoryPage() {
  const [rows, setRows] = useState<HistoryItem[]>([]);

  useEffect(() => {
    void apiGet<{ items: HistoryItem[] }>("/v1/history")
      .then((data) => setRows(data.items || []))
      .catch(() => setRows([]));
  }, []);

  return (
      <div>
        <div className="card panel-results-card">
          <div className="panel-card__head">
            <h2>Transaction History</h2>
            <p className="panel-card__desc">Recent balance activity.</p>
          </div>
          <div className="table-wrap panel-table-wrap">
            <table className="results-table panel-results-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="name">{row.type}</td>
                      <td className="mono">
                        {row.amount >= 0 ? `+$${row.amount.toFixed(2)}` : `-$${Math.abs(row.amount).toFixed(2)}`}
                      </td>
                      <td>{row.date}</td>
                      <td>{row.status}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No activity yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
