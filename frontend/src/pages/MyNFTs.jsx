import { useCallback, useEffect, useState } from "react";
import { ZeroAddress } from "ethers";
import { useWallet } from "../hooks/useWallet.jsx";
import { useTx } from "../hooks/useTx.js";
import { getContracts, loadToken, ownedTokenIds } from "../services/contracts.js";
import { formatEth, shortHash } from "../utils/format.js";
import NFTCard from "../components/NFTCard.jsx";
import RequireWallet from "../components/RequireWallet.jsx";
import TxNotice from "../components/TxNotice.jsx";

/** Historique reconstruit à partir des événements on-chain concernant l'utilisateur. */
async function loadHistory(nft, market, me) {
  const [minted, listed, sold, bought, cancelled] = await Promise.all([
    nft.queryFilter(nft.filters.NFTMinted(null, me)),
    market.queryFilter(market.filters.NFTListed(null, me)),
    market.queryFilter(market.filters.NFTSold(null, me, null)),
    market.queryFilter(market.filters.NFTSold(null, null, me)),
    market.queryFilter(market.filters.ListingCancelled(null, me)),
  ]);
  const tag = (logs, label, fmt) => logs.map((l) => ({ label, text: fmt(l.args), block: l.blockNumber, hash: l.transactionHash, idx: l.index }));
  return [
    ...tag(minted, "Création", (a) => `NFT #${a.tokenId}`),
    ...tag(listed, "Mise en vente", (a) => `NFT #${a.tokenId} à ${formatEth(a.price)}`),
    ...tag(sold, "Vente", (a) => `NFT #${a.tokenId} pour ${formatEth(a.price)}`),
    ...tag(bought, "Achat", (a) => `NFT #${a.tokenId} pour ${formatEth(a.price)}`),
    ...tag(cancelled, "Annulation", (a) => `NFT #${a.tokenId}`),
  ].sort((x, y) => y.block - x.block || y.idx - x.idx);
}

function MyNFTsContent() {
  const { provider, chainId, account } = useWallet();
  const [tokens, setTokens] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState("");
  const { status, run, busy } = useTx();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const { nft, market } = await getContracts(provider, chainId);
      const ids = await ownedTokenIds(nft, account);
      const list = await Promise.all(
        ids.map(async (id) => {
          const l = await market.listings(id);
          return { ...(await loadToken(nft, id)), price: l.seller === ZeroAddress ? null : l.price };
        })
      );
      setTokens(list);
      setHistory(await loadHistory(nft, market, account));
    } catch (e) {
      setLoadError("Impossible de charger tes NFT.");
      console.error(e);
    }
  }, [provider, chainId, account]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (t) => {
    const { market } = await getContracts(provider, chainId);
    const r = await run("Annulation de l'annonce", () => market.cancelListing(t.tokenId));
    if (r) load();
  };

  return (
    <>
      <TxNotice status={status} />
      {loadError && <p className="notice error">{loadError}</p>}
      {tokens === null && !loadError && <p className="muted">Chargement…</p>}
      {tokens?.length === 0 && <p className="muted">Tu ne possèdes aucun NFT.</p>}
      <div className="grid">
        {tokens?.map((t) => (
          <NFTCard key={String(t.tokenId)} nft={t}>
            {t.price !== null ? (
              <>
                <p className="price">En vente : {formatEth(t.price)}</p>
                <button className="btn ghost" disabled={busy} onClick={() => cancel(t)}>Annuler l'annonce</button>
              </>
            ) : (
              <p className="muted">Non listé</p>
            )}
          </NFTCard>
        ))}
      </div>

      <h2>Historique</h2>
      {history.length === 0 ? (
        <p className="muted">Aucune opération.</p>
      ) : (
        <table className="table">
          <thead><tr><th>Opération</th><th>Détail</th><th>Bloc</th><th>Transaction</th></tr></thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i}><td>{h.label}</td><td>{h.text}</td><td>{h.block}</td><td title={h.hash}>{shortHash(h.hash)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function MyNFTs() {
  return (
    <section>
      <h1>Mes NFT</h1>
      <RequireWallet><MyNFTsContent /></RequireWallet>
    </section>
  );
}
