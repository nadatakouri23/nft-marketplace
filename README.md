# NFT Marketplace décentralisée

Version simplifiée d'OpenSea : créer (mint) des NFT, les mettre en vente en ETH, les acheter, annuler une annonce, consulter ses NFT et son historique, et mesurer les performances des opérations blockchain.

**Stack :** Solidity 0.8.24 · OpenZeppelin 5 · Hardhat · Ethers.js v6 · React + Vite · MetaMask · IPFS (Pinata)

## Sommaire
1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Lancer en local](#lancer-en-local)
5. [Utilisation](#utilisation)
6. [Tests](#tests)
7. [Mesures de performance](#mesures-de-performance)
8. [Déploiement sur Sepolia](#déploiement-sur-sepolia)
9. [On-chain et off-chain](#on-chain-et-off-chain)
10. [Sécurité](#sécurité)
11. [Limites et améliorations](#limites-et-améliorations)

## Architecture

```text
nft-marketplace/
├── contracts/
│   ├── MyNFT.sol               ERC-721 + URI par token + énumération
│   ├── NFTMarketplace.sol      annonces, achat atomique, annulation
│   └── mocks/RejectingSeller.sol   contrat de TEST uniquement
├── scripts/
│   ├── deploy.js               déploie + exporte adresses et ABI vers le frontend
│   └── benchmark.js            mesures de latence, gas, frais, débit
├── test/                       tests unitaires et d'intégration (Hardhat/Mocha/Chai)
├── benchmarks/                 résultats de mesure (JSON, un fichier par réseau)
├── docs/                       rapport PDF, checklist de tests manuels
└── frontend/                   React + Vite
    └── src/ components/ pages/ hooks/ services/ utils/ contracts/ data/
```

- **MyNFT** : registre de propriété. Hérite de `ERC721URIStorage` et `ERC721Enumerable`. `mint(uri)` crée un NFT pour l'appelant.
- **NFTMarketplace** : *non-custodial*. Le NFT reste chez le vendeur, qui approuve seulement la marketplace. `listNFT`, `buyNFT`, `cancelListing`, `getActiveListings`.
- **Achat atomique** : l'annonce est supprimée avant les appels externes, puis transfert du NFT, puis paiement du vendeur. Si une étape échoue, tout est annulé. Protégé par `nonReentrant`.
- `deploy.js` écrit `frontend/src/contracts/deployments.json` (adresses **par chainId**) et les ABI : le frontend choisit les bonnes adresses selon le réseau MetaMask.

Documentation détaillée des contrats : `docs/Rapport_NFT_Marketplace.pdf`.

## Prérequis
- Node.js 20 ou 22 (LTS). Sous Windows, avec les versions très récentes, Hardhat peut afficher `Assertion failed … UV_HANDLE_CLOSING` à la fermeture : sans conséquence.
- Extension **MetaMask**.
- (Pour IPFS) un compte gratuit **Pinata** et un JWT.
- (Pour Sepolia) une URL RPC Sepolia et des ETH de test.

## Installation
```bash
npm install                  # dépendances Hardhat (racine)
cd frontend && npm install   # dépendances React
```

### Variables d'environnement
**Ne commite jamais de `.env`** (déjà dans `.gitignore`).

| Fichier | Variable | Rôle |
|---|---|---|
| `.env` (racine) | `SEPOLIA_RPC_URL` | URL RPC Sepolia (Alchemy, Infura…) |
| `.env` (racine) | `PRIVATE_KEY` | Clé privée d'un **portefeuille de test dédié** (jamais ton portefeuille personnel) |
| `frontend/.env` | `PINATA_JWT` | JWT Pinata, **sans préfixe `VITE_`** : reste côté serveur Vite (voir [Sécurité](#sécurité)) |
| `frontend/.env` | `VITE_IPFS_GATEWAY` | (optionnel) passerelle IPFS de lecture |

Modèles : `.env.example` et `frontend/.env.example`. Sans `PINATA_JWT`, l'application utilise un **stockage simulé** dans le navigateur (développement uniquement).

## Lancer en local
Trois terminaux :
```bash
# 1. Blockchain locale (à laisser ouverte)
npm run node

# 2. Déploiement des contrats (à refaire à chaque redémarrage du nœud)
npm run deploy:local

# 3. Application
cd frontend && npm run dev        # http://localhost:5173
```

### Configurer MetaMask
1. Réseau : RPC `http://127.0.0.1:8545`, Chain ID `31337`, symbole `ETH` (l'application propose un bouton « Passer sur Hardhat Local »).
2. Importer 2 comptes de test avec les clés privées affichées par `npm run node` (comptes #1 et #2). **Ces clés sont publiques : n'y envoie jamais de vrais fonds.**
3. Après un redémarrage du nœud : MetaMask > Paramètres > Avancé > *Effacer les données d'activité*.

## Utilisation
| Page | Fonction |
|---|---|
| **Explorer** | NFT en vente (image, nom, prix, vendeur) et bouton Acheter |
| **Créer** | Image + nom + description, upload IPFS, mint |
| **Vendre** | Choisir un NFT, **1. Approuver** la marketplace, **2. Fixer le prix** et mettre en vente |
| **Mes NFT** | NFT détenus, annulation d'annonce, historique (événements on-chain) |
| **Performance** | Tableau et graphiques des mesures (sans MetaMask) |

## Tests
```bash
npm test
```
39 tests : unitaires (`MyNFT`, `NFTMarketplace`), d'intégration (parcours complet avec les ABI du frontend) et validations frontend. Cas couverts : mauvais prix, NFT non détenu, non approuvé, achat déjà effectué, annonce annulée, atomicité (vendeur qui refuse le paiement), annonce périmée.

Tests manuels avec MetaMask : `docs/CHECKLIST_E2E.md`.

## Mesures de performance
```bash
npm run benchmark            # Hardhat en mémoire
npm run benchmark:local      # nœud local (npm run node lancé)
npm run benchmark:sepolia    # Sepolia (consomme des ETH de test)
```
Variables : `BENCH_RUNS` (répétitions, défaut 10), `BENCH_BATCH` (taille du lot de débit, défaut 20). Sur Sepolia, commence petit : `BENCH_RUNS=3 BENCH_BATCH=5`.

Définitions :
- **Envoi** : temps jusqu'à ce que le nœud accepte la transaction (hash reçu).
- **Confirmation** : temps suivant jusqu'à l'inclusion dans un bloc (`tx.wait()`).
- **Frais** = `gasUsed × effectiveGasPrice`.
- **Débit** : transactions confirmées par seconde, en envoi séquentiel et en rafale.

Résultats dans `benchmarks/results-<réseau>.json` et affichés dans la page **Performance**.

**Hardhat vs Sepolia :** Hardhat mine un bloc instantanément à chaque transaction (latences de l'ordre de la milliseconde, débit surtout limité par le simulateur). Sepolia produit un bloc toutes les ~12 s : la confirmation domine, le débit est limité par le temps de bloc et le prix du gas varie. Le gas utilisé par opération est identique partout : il dépend du code, pas du réseau.

## Déploiement sur Sepolia
1. **Portefeuille de test dédié** : crée un nouveau compte MetaMask uniquement pour ce projet et exporte sa clé privée (Détails du compte > Exporter la clé privée).
2. **RPC** : crée une app Sepolia sur Alchemy ou Infura et copie l'URL HTTPS.
3. **ETH de test** : demande-en sur un faucet Sepolia (Google Cloud Web3 faucet, Alchemy faucet…). 0,1 ETH suffit largement.
4. **Configurer `.env` (racine)** :
   ```
   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
   PRIVATE_KEY=0x...
   ```
5. **Déployer** :
   ```bash
   npm run deploy:sepolia
   ```
   Les adresses sont ajoutées à `frontend/src/contracts/deployments.json` sous la clé `11155111`. Tu peux les voir sur https://sepolia.etherscan.io.
6. **Mesurer** (optionnel) : `BENCH_RUNS=3 BENCH_BATCH=5 npm run benchmark:sepolia`.
7. **Utiliser l'application** : `cd frontend && npm run dev`, puis dans MetaMask choisis le réseau **Sepolia**. Pour de vraies images, configure `PINATA_JWT` (sinon le stockage simulé ne fonctionne que dans un seul navigateur).

> Sur Sepolia, il n'y a pas de nœud « automine » : une transaction prend quelques secondes à être confirmée. L'interface affiche l'état « en attente de confirmation ».

## On-chain et off-chain
| On-chain | Off-chain (IPFS) |
|---|---|
| Propriétaire de chaque tokenId | Image du NFT |
| URI des métadonnées (`ipfs://CID`) | JSON : nom, description, lien vers l'image |
| Annonces (vendeur, prix) | |
| Événements (historique) | |

Stocker une image sur Ethereum coûterait des centaines de dollars de gas : on ne garde on-chain que la propriété et la référence. Le CID IPFS étant l'empreinte du contenu, l'URI prouve l'intégrité du fichier.

## Sécurité
- Standards **OpenZeppelin** (ERC-721, `ReentrancyGuard`), pas de réimplémentation.
- Propriété et approbation vérifiées à la mise en vente **et** à l'achat ; annulation réservée au vendeur.
- Double vente et réentrance : annonce supprimée avant les appels externes (Checks-Effects-Interactions) + `nonReentrant`.
- Prix exact exigé (`msg.value == price`) ; la marketplace ne conserve aucun ETH.
- Validations côté frontend (ergonomie) **et** côté contrats (sécurité réelle).
- **Secrets** : une variable `VITE_xxx` est copiée dans le code du navigateur, donc visible par tous. Le JWT Pinata est donc dans `frontend/.env` **sans** préfixe `VITE_` et injecté uniquement par le proxy du serveur Vite. La clé privée Sepolia ne sert que dans les scripts Hardhat.
- Les contrats **n'ont pas été audités**. Ne pas les utiliser avec de vrais fonds.

## Limites et améliorations
| Limite | Amélioration |
|---|---|
| Prix fixe uniquement | Enchères, offres |
| Pas de commission de plateforme | Frais en pourcentage plafonnés |
| Pas de royalties pour le créateur | ERC-2981 |
| Pas de modification de prix | `updatePrice` (aujourd'hui : annuler puis relister) |
| `getActiveListings` parcourt toute la collection | Indexeur (The Graph) ou pagination |
| Une seule collection | Marketplace multi-collections |
| Paiement direct au vendeur | Modèle « retrait » (pull payment) |
| Proxy Pinata réservé au mode développement | Petit backend ou fonction serverless en production |
| Pas de test de réentrance avec contrat attaquant dédié | Ajouter un contrat attaquant, Slither, fuzzing |
| Pas d'audit externe | Audit avant tout usage réel |
