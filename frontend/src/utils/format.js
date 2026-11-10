import { formatEther } from "ethers";

export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const shortHash = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "");
export const formatEth = (wei) => `${formatEther(wei)} ETH`;

/** Transforme une erreur ethers/MetaMask en message lisible. */
export function errorMessage(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "Transaction refusée dans MetaMask.";
  if (e?.code === "INSUFFICIENT_FUNDS") return "Solde insuffisant pour payer le prix et le gas.";
  const inner = e?.error?.message || e?.info?.error?.message || "";
  if (/nonce/i.test(inner) || /could not coalesce/i.test(e?.message || ""))
    return "Erreur RPC (" + (inner || "réponse illisible de MetaMask") + "). Si le nœud Hardhat a été redémarré : MetaMask > Paramètres > Avancé > Effacer les données d'activité, puis relance le déploiement.";
  const raw = e?.reason || e?.revert?.args?.[0] || e?.info?.error?.message || e?.shortMessage || e?.message;
  return raw ? String(raw).slice(0, 200) : "Erreur inconnue.";
}

/** Valide un prix saisi en ETH. Retourne un message d'erreur, ou "" si valide. */
export function validatePrice(value) {
  if (!value.trim()) return "Saisis un prix.";
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim())) return "Prix invalide (nombre positif, 18 décimales max).";
  if (Number(value) <= 0) return "Le prix doit être supérieur à 0.";
  return "";
}
