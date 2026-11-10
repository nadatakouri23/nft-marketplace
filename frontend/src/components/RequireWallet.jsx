import { NETWORK_NAMES, useWallet } from "../hooks/useWallet.jsx";

/** Affiche le contenu seulement si MetaMask est connecté sur un réseau supporté. */
export default function RequireWallet({ children }) {
  const { account, isSupported, hasMetaMask, connect, switchNetwork, error } = useWallet();

  if (!hasMetaMask)
    return <div className="panel notice error">MetaMask n'est pas détecté. Installe l'extension puis recharge la page.</div>;

  if (!account)
    return (
      <div className="panel">
        <p>Connecte ton portefeuille pour continuer.</p>
        <button className="btn" onClick={connect}>Connecter MetaMask</button>
        {error && <p className="notice error">{error}</p>}
      </div>
    );

  if (!isSupported)
    return (
      <div className="panel">
        <p className="notice warn">Mauvais réseau : les contrats ne sont pas déployés ici.</p>
        {Object.entries(NETWORK_NAMES).map(([id, name]) => (
          <button key={id} className="btn" onClick={() => switchNetwork(Number(id))}>
            Passer sur {name}
          </button>
        ))}
        {error && <p className="notice error">{error}</p>}
      </div>
    );

  return children;
}
