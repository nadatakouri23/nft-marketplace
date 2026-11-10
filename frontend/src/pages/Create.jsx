import { useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet.jsx";
import { useTx } from "../hooks/useTx.js";
import { getContracts } from "../services/contracts.js";
import { ALLOWED_TYPES, MAX_IMAGE_BYTES, ipfsMode, uploadNFT } from "../services/ipfs.js";
import { errorMessage } from "../utils/format.js";
import RequireWallet from "../components/RequireWallet.jsx";
import TxNotice from "../components/TxNotice.jsx";

function CreateContent() {
  const { provider, chainId } = useWallet();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const { status, run, busy } = useTx();

  const onFile = (e) => {
    const f = e.target.files[0];
    setFormError("");
    setDone(false);
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) return setFormError("Format non supporté (PNG, JPEG, GIF ou WebP).");
    if (f.size > MAX_IMAGE_BYTES) return setFormError(`Image trop lourde (${MAX_IMAGE_BYTES / 1024 / 1024} Mo maximum).`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    if (!file) return "Choisis une image.";
    if (!name.trim()) return "Le nom est obligatoire.";
    if (name.length > 60) return "Nom trop long (60 caractères max).";
    if (description.length > 500) return "Description trop longue (500 caractères max).";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    setFormError(err);
    if (err) return;
    setUploading(true);
    try {
      const uri = await uploadNFT({ file, name: name.trim(), description: description.trim() });
      const { nft } = await getContracts(provider, chainId);
      const receipt = await run("Création du NFT", () => nft.mint(uri));
      if (receipt) {
        setDone(true);
        setName(""); setDescription(""); setFile(null); setPreview("");
      }
    } catch (e2) {
      setFormError(errorMessage(e2));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form className="panel form" onSubmit={submit}>
      <p className={`notice ${ipfsMode === "pinata" ? "ok" : "warn"}`}>
        {ipfsMode === "pinata"
          ? "Stockage : IPFS via Pinata"
          : "Stockage simulé (navigateur local). Configure PINATA_JWT pour utiliser IPFS."}
      </p>
      <label>Image
        <input type="file" accept={ALLOWED_TYPES.join(",")} onChange={onFile} />
      </label>
      {preview && <img className="preview" src={preview} alt="Aperçu" />}
      <label>Nom
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Mon super NFT" />
      </label>
      <label>Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={4} />
      </label>
      {formError && <p className="notice error">{formError}</p>}
      <TxNotice status={status} />
      {done && <p className="notice ok">NFT créé ! <Link to="/sell">Mets-le en vente</Link> ou <Link to="/my-nfts">consulte tes NFT</Link>.</p>}
      <button className="btn" disabled={uploading || busy}>
        {uploading ? "Upload…" : busy ? "Transaction en cours…" : "Créer le NFT"}
      </button>
    </form>
  );
}

export default function Create() {
  return (
    <section>
      <h1>Créer un NFT</h1>
      <RequireWallet><CreateContent /></RequireWallet>
    </section>
  );
}
