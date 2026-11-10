export default function TxNotice({ status }) {
  if (status.type === "idle") return null;
  const cls = { pending: "info", success: "ok", error: "error" }[status.type];
  return (
    <p className={`notice ${cls}`} role="status">
      {status.type === "pending" && <span className="spinner" aria-hidden />} {status.msg}
    </p>
  );
}
