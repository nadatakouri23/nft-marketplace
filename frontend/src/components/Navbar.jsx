import { NavLink } from "react-router-dom";
import { NETWORK_NAMES, useWallet } from "../hooks/useWallet.jsx";
import { shortAddress } from "../utils/format.js";

export default function Navbar() {
  const { account, chainId, isSupported, connecting, connect, disconnect } = useWallet();
  const link = ({ isActive }) => (isActive ? "active" : "");

  return (
    <header className="navbar">
      <span className="brand">◆ NFT Market</span>
      <nav>
        <NavLink to="/" end className={link}>Explorer</NavLink>
        <NavLink to="/create" className={link}>Créer</NavLink>
        <NavLink to="/sell" className={link}>Vendre</NavLink>
        <NavLink to="/my-nfts" className={link}>Mes NFT</NavLink>
        <NavLink to="/performance" className={link}>Performance</NavLink>
      </nav>
      <div className="wallet">
        {account ? (
          <>
            <span className={`badge ${isSupported ? "ok" : "warn"}`}>
              {isSupported ? NETWORK_NAMES[chainId] : `Réseau ${chainId} non supporté`}
            </span>
            <span className="addr" title={account}>{shortAddress(account)}</span>
            <button className="btn ghost" onClick={disconnect}>Déconnecter</button>
          </>
        ) : (
          <button className="btn" onClick={connect} disabled={connecting}>
            {connecting ? "Connexion…" : "Connecter MetaMask"}
          </button>
        )}
      </div>
    </header>
  );
}
