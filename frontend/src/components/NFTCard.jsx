export default function NFTCard({ nft, children }) {
  return (
    <article className="card">
      {nft.image ? <img src={nft.image} alt={nft.name} loading="lazy" /> : <div className="noimg">Pas d'image</div>}
      <div className="card-body">
        <h3>{nft.name} <small>#{String(nft.tokenId)}</small></h3>
        {nft.description && <p className="desc">{nft.description}</p>}
        {children}
      </div>
    </article>
  );
}
