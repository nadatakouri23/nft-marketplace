// Stockage des images et métadonnées.
//  - Si PINATA_JWT est configuré (frontend/.env) : vrai IPFS via Pinata, URI "ipfs://<CID>".
//  - Sinon : mode SIMULÉ dans le localStorage du navigateur, URI "mock://<hash>" (dev uniquement).
// Le JWT n'est jamais dans le navigateur : les requêtes passent par le proxy Vite (/api/pinata).

/* global __PINATA_ENABLED__ */
export const ipfsMode = __PINATA_ENABLED__ ? "pinata" : "mock";

const GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || "https://ipfs.io/ipfs/";
export const MAX_IMAGE_BYTES = ipfsMode === "pinata" ? 5 * 1024 * 1024 : 1024 * 1024;
export const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// ---------- Mode Pinata ----------

async function pinataFetch(path, init) {
  let res;
  try {
    res = await fetch(`/api/pinata${path}`, { method: "POST", ...init });
  } catch {
    throw new Error("Impossible de joindre Pinata (réseau).");
  }
  if (res.status === 401 || res.status === 403)
    throw new Error("Pinata a refusé la clé (JWT invalide ou droits insuffisants).");
  if (!res.ok) throw new Error(`Erreur Pinata (HTTP ${res.status}).`);
  const { IpfsHash } = await res.json();
  return `ipfs://${IpfsHash}`;
}

const pinataFile = (file) => {
  const form = new FormData();
  form.append("file", file);
  form.append("pinataMetadata", JSON.stringify({ name: file.name }));
  return pinataFetch("/pinning/pinFileToIPFS", { body: form });
};

const pinataJSON = (obj, name) =>
  pinataFetch("/pinning/pinJSONToIPFS", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: obj, pinataMetadata: { name } }),
  });

// ---------- Mode simulé ----------

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Lecture du fichier impossible."));
    r.readAsDataURL(file);
  });

async function mockStore(content) {
  const hash = await sha256Hex(content);
  try {
    localStorage.setItem(`mockipfs:${hash}`, content);
  } catch {
    throw new Error("Stockage local plein : choisis une image plus petite.");
  }
  return `mock://${hash}`;
}

// ---------- API commune ----------

export const uploadFile = (file) => (ipfsMode === "pinata" ? pinataFile(file) : fileToDataUrl(file).then(mockStore));

export const uploadJSON = (obj, name = "metadata") =>
  ipfsMode === "pinata" ? pinataJSON(obj, name) : mockStore(JSON.stringify(obj));

/** Envoie l'image, puis les métadonnées (format standard ERC-721). Retourne l'URI des métadonnées. */
export async function uploadNFT({ file, name, description }) {
  const image = await uploadFile(file);
  return uploadJSON({ name, description, image }, `${name}.json`);
}

/** Convertit une URI (ipfs://, mock://, http(s)) en URL utilisable dans <img> / fetch. */
export function toHttp(uri) {
  if (!uri) return "";
  if (uri.startsWith("mock://")) return localStorage.getItem(`mockipfs:${uri.slice(7)}`) || "";
  if (uri.startsWith("ipfs://")) return GATEWAY + uri.slice(7);
  return uri;
}

const cache = new Map();

/** Lit le JSON de métadonnées d'un NFT. */
export async function fetchMetadata(uri) {
  if (cache.has(uri)) return cache.get(uri);
  let json;
  if (uri.startsWith("mock://")) {
    const raw = localStorage.getItem(`mockipfs:${uri.slice(7)}`);
    if (!raw) throw new Error("Métadonnées introuvables (stockage simulé d'un autre navigateur ?)");
    json = JSON.parse(raw);
  } else {
    const res = await fetch(toHttp(uri));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
  }
  const meta = {
    name: String(json.name ?? "Sans nom"),
    description: String(json.description ?? ""),
    image: toHttp(json.image),
  };
  cache.set(uri, meta);
  return meta;
}
