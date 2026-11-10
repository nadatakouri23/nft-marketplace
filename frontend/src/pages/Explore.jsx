import { useCallback, useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet.jsx";
import { useTx } from "../hooks/useTx.js";
import { getContracts, loadToken } from "../services/contracts.js";
import { formatEth, shortAddress } from "../utils/format.js";
import NFTCard from "../components/NFTCard.jsx";
import RequireWallet from "../components/RequireWallet.jsx";
import TxNotice from "../components/TxNotice.jsx";

function ExploreContent() {
  const { provider, chainId, account } = useWallet();
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { status, run, busy } = useTx();

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const { nft, market } = await getContracts(provider, chainId);
      const [ids, sellers, prices] = await market.getActiveListings();
      const list = await Promise.all(
        ids.map(async (id, i) => ({ ...(await loadToken(nft, id)), seller: sellers[i], price: prices[i] }))
      );
      setItems(list);
    } catch (e) {
      setLoadError("Impossible de charger les annonces. Les contrats sont-ils déployés sur ce réseau ?");
      console.error(e);
    }
  }, [provider, chainId]);

  useEffect(() => { load(); }, [load]);

  const buy = async (item) => {
    const { market } = await getContracts(provider, chainId);
    const receipt = await run(`Achat de ${item.name}`, () => market.buyNFT(item.tokenId, { value: item.price }));
    if (receipt) load();
  };

  return (
    <>
      <TxNotice status={status} />
      {loadError && <p className="notice error">{loadError}</p>}
      {items === null && !loadError && <p className="muted">Chargement…</p>}
      {items?.length === 0 && <p className="muted">Aucun NFT en vente pour le moment.</p>}
      <div className="grid">
        {items?.map((it) => (
          <NFTCard key={String(it.tokenId)} nft={it}>
            <p className="price">{formatEth(it.price)}</p>
            <p className="muted">Vendeur : {shortAddress(it.seller)}</p>
            <button
              className="btn"
              disabled={busy || it.seller.toLowerCase() === account.toLowerCase()}
              onClick={() => buy(it)}
            >
              {it.seller.toLowerCase() === account.toLowerCase() ? "Votre annonce" : "Acheter"}
            </button>
          </NFTCard>
        ))}
      </div>
    </>
  );
}

export default function Explore() {
  return (
    <section>
      <h1>NFT en vente</h1>
      <RequireWallet><ExploreContent /></RequireWallet>
    </section>
  );
}
