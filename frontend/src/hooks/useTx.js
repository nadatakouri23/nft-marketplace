import { useCallback, useState } from "react";
import { errorMessage } from "../utils/format.js";

/**
 * Suit l'état d'une opération blockchain : idle -> pending -> success | error.
 * run(label, fn) : fn doit retourner une transaction ethers ; on attend sa confirmation.
 */
export function useTx() {
  const [status, setStatus] = useState({ type: "idle", msg: "" });

  const run = useCallback(async (label, fn) => {
    setStatus({ type: "pending", msg: `${label} : confirme dans MetaMask…` });
    try {
      const tx = await fn();
      setStatus({ type: "pending", msg: `${label} : transaction envoyée, en attente de confirmation…` });
      const receipt = await tx.wait();
      setStatus({ type: "success", msg: `${label} : confirmé (bloc ${receipt.blockNumber}).` });
      return receipt;
    } catch (e) {
      setStatus({ type: "error", msg: errorMessage(e) });
      return null;
    }
  }, []);

  const reset = useCallback(() => setStatus({ type: "idle", msg: "" }), []);
  return { status, run, reset, busy: status.type === "pending" };
}
