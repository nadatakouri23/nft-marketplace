# Checklist de tests de bout en bout (manuels, avec MetaMask)

Prérequis : `npx hardhat node`, `npx hardhat run scripts/deploy.js --network localhost`, `cd frontend && npm run dev`.
MetaMask sur « Hardhat Local » (chainId 31337) avec 2 comptes de test importés (A = vendeur, B = acheteur).

Cocher la colonne « Résultat » (OK / KO + remarque) pendant l'exécution.

## 1. Portefeuille

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 1.1 | Ouvrir le site sans être connecté | Pages Explorer/Créer/Vendre/Mes NFT demandent de connecter MetaMask | |
| 1.2 | Cliquer « Connecter MetaMask » | Adresse courte et badge « Hardhat Local » affichés | |
| 1.3 | Cliquer « Déconnecter » | Retour à l'état non connecté ; un rechargement ne reconnecte pas | |
| 1.4 | Changer de compte dans MetaMask | L'adresse affichée change, les pages se mettent à jour | |
| 1.5 | Passer MetaMask sur un autre réseau (ex. Ethereum Mainnet) | Badge « non supporté » + message « Mauvais réseau » avec boutons de changement | |
| 1.6 | Refuser la demande de connexion dans MetaMask | Message d'erreur clair, pas de plantage | |
| 1.7 | Désactiver l'extension MetaMask et recharger | Message « MetaMask n'est pas détecté » | |

## 2. Création (compte A)

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 2.1 | Envoyer sans image | « Choisis une image. » | |
| 2.2 | Choisir un fichier non image (ex. .pdf) | « Format non supporté… » | |
| 2.3 | Choisir une image trop lourde | « Image trop lourde… » | |
| 2.4 | Image valide, nom vide | « Le nom est obligatoire. » | |
| 2.5 | Image + nom valides, créer | Bandeau Pinata (vert), signature MetaMask, « confirmé (bloc N) » | |
| 2.6 | Refuser la signature | « Transaction refusée dans MetaMask. », aucun NFT créé | |
| 2.7 | Vérifier sur app.pinata.cloud > Files | Image et JSON présents | |

## 3. Mise en vente (compte A)

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 3.1 | Page Vendre | Le NFT créé est listé | |
| 3.2 | Choisir le NFT | Bouton « 1. Approuver la marketplace » | |
| 3.3 | Approuver | « Marketplace approuvée ✓ » + champ prix | |
| 3.4 | Prix vide, `0`, `abc`, `1,5` | Message de validation à chaque fois | |
| 3.5 | Prix `0.5`, mettre en vente | Confirmé ; le NFT apparaît « Déjà en vente » | |

## 4. Achat (compte B)

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 4.1 | Explorer avec le compte B | Annonce visible : image, nom, prix 0.5 ETH, vendeur | |
| 4.2 | Explorer avec le compte A | Bouton « Votre annonce » désactivé | |
| 4.3 | Acheter avec B | Confirmé ; l'annonce disparaît | |
| 4.4 | Mes NFT (B) | Le NFT est présent, « Non listé » ; historique : Achat | |
| 4.5 | Mes NFT (A) | NFT absent ; historique : Création, Mise en vente, Vente | |
| 4.6 | Soldes MetaMask | A ≈ +0.5 ETH, B ≈ −0.5 ETH (− gas) | |

## 5. Annulation et cas limites

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 5.1 | A crée un 2ᵉ NFT et le met en vente | Visible dans Explorer | |
| 5.2 | Mes NFT (A) > « Annuler l'annonce » | Confirmé ; disparaît d'Explorer ; historique : Annulation | |
| 5.3 | B tente d'acheter une annonce que A vient d'annuler (page Explorer ouverte avant l'annulation) | Erreur lisible « NFT non en vente », rien débité sauf le gas | |
| 5.4 | Redémarrer `hardhat node` sans redéployer, recharger | Message « Contrats introuvables… relance le déploiement » | |
| 5.5 | Relancer le déploiement + « Effacer les données d'activité » MetaMask | L'application refonctionne | |

## 6. Responsive

| # | Action | Résultat attendu | Résultat |
|---|--------|------------------|----------|
| 6.1 | Réduire la fenêtre (≈ 400 px) | Barre de navigation empilée, galerie en 1 colonne, tableau d'historique défilable | |
