import { useCallback, useEffect, useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../hooks/useWallet.jsx";
import { useTx } from "../hooks/useTx.js";
import { getContracts, loadToken, ownedTokenIds } from "../services/contracts.js";
import { validatePrice } from "../utils/format.js";
import NFTCard from "../components/NFTCard.jsx";
import RequireWallet from "../components/RequireWallet.jsx";
import TxNotice from "../components/TxNotice.jsx";

function SellContent() {
  const { provider, chainId, account } = useWallet();
  const [tokens, setTokens] = useState(null);
  const [selected, setSelected] = useState(null); // { tokenId, ... }
  const [approved, setApproved] = useState(false);
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState("");
  const { status, run, busy } = useTx();

  const load = useCallback(async () => {
    const { nft, market } = await getContracts(provider, chainId);
    const ids = await ownedTokenIds(nft, account);
    const list = await Promise.all(
      ids.map(async (id) => ({ ...(await loadToken(nft, id)), listed: (await market.listings(id)).seller !== "0x0000000000000000000000000000000000000000" }))
    );
    setTokens(list);
  }, [provider, chainId, account]);

  useEffect(() => { load().catch(console.error); }, [load]);

  const checkApproval = useCallback(async (tokenId) => {
    const { nft, addresses } = await getContracts(provider, chainId);
    const [one, all] = await Promise.all([nft.getApproved(tokenId), nft.isApprovedForAll(account, addresses.NFTMarketplace)]);
    setApproved(all || one.toLowerCase() === addresses.NFTMarketplace.toLowerCase());
  }, [provider, chainId, account]);

  const select = (t) => {
    setSelected(t);
    setPrice("");
    setPriceError("");
    checkApproval(t.tokenId).catch(console.error);
  };

  const approve = async () => {
    const { nft, addresses } = await getContracts(provider, chainId);
    const r = await run("Approbation de la marketplace", () => nft.approve(addresses.NFTMarketplace, selected.tokenId));
    if (r) setApproved(true);
  };

  const list = async () => {
    const err = validatePrice(price);
    setPriceError(err);
    if (err) return;
    const { market } = await getContracts(provider, chainId);
    const r = await run("Mise en vente", () => market.listNFT(selected.tokenId, parseEther(price.trim())));
    if (r) { setSelected(null); load(); }
  };

  if (tokens === null) return <p className="muted">Chargement…</p>;
  if (tokens.length === 0) return <p className="muted">Tu ne possèdes aucun NFT. Crée-en un d'abord.</p>;

  return (
    <>
      <p className="muted">1. Choisis un NFT · 2. Approuve la marketplace · 3. Fixe le prix.</p>
      <div className="grid">
        {tokens.map((t) => (
          <NFTCard key={String(t.tokenId)} nft={t}>
            {t.listed ? (
              <p className="muted">Déjà en vente</p>
            ) : (
              <button className={`btn ${selected?.tokenId === t.tokenId ? "" : "ghost"}`} onClick={() => select(t)}>
                {selected?.tokenId === t.tokenId ? "Sélectionné" : "Choisir"}
              </button>
            )}
          </NFTCard>
        ))}
      </div>

      {selected && (
        <div className="panel form">
          <h2>{selected.name} #{String(selected.tokenId)}</h2>
          {!approved ? (
            <button className="btn" onClick={approve} disabled={busy}>1. Approuver la marketplace</button>
          ) : (
            <>
              <p className="notice ok">Marketplace approuvée ✓</p>
              <label>Prix (ETH)
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.05" />
              </label>
              {priceError && <p className="notice error">{priceError}</p>}
              <button className="btn" onClick={list} disabled={busy}>2. Mettre en vente</button>
            </>
          )}
        </div>
      )}
      <TxNotice status={status} />
    </>
  );
}

export default function Sell() {
  return (
    <section>
      <h1>Vendre un NFT</h1>
      <RequireWallet><SellContent /></RequireWallet>
    </section>
  );
}
