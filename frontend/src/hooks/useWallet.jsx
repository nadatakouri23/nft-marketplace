import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider } from "ethers";
import deployments from "../contracts/deployments.json";
import { errorMessage } from "../utils/format.js";

const WalletContext = createContext(null);
export const useWallet = () => useContext(WalletContext);

const NETWORKS = {
  31337: {
    chainId: "0x7a69",
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  11155111: { chainId: "0xaa36a7" }, // Sepolia : déjà connu de MetaMask
};
export const NETWORK_NAMES = { 31337: "Hardhat Local", 11155111: "Sepolia" };
const DISCONNECT_FLAG = "wallet_disconnected";

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);

  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;
  // Réseau supporté = réseau pour lequel on a des adresses de contrats déployés
  const isSupported = chainId !== null && !!deployments[chainId];
  const provider = useMemo(
    () => (hasMetaMask && account ? new BrowserProvider(window.ethereum) : null),
    [hasMetaMask, account, chainId] // chainId : on recrée le provider au changement de réseau
  );

  const connect = useCallback(async () => {
    setError("");
    if (!window.ethereum) {
      setError("MetaMask n'est pas installé. Installe l'extension puis recharge la page.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      localStorage.removeItem(DISCONNECT_FLAG);
      setAccount(accounts[0] ?? null);
      setChainId(parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16));
    } catch (e) {
      setError(e.code === -32002 ? "Une demande de connexion est déjà ouverte dans MetaMask." : errorMessage(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  // MetaMask ne permet pas de se déconnecter par code : on oublie simplement le compte côté appli.
  const disconnect = useCallback(() => {
    localStorage.setItem(DISCONNECT_FLAG, "1");
    setAccount(null);
    setError("");
  }, []);

  const switchNetwork = useCallback(async (id) => {
    setError("");
    const net = NETWORKS[id];
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: net.chainId }] });
    } catch (e) {
      if (e.code === 4902 && net.rpcUrls) {
        try {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [net] });
        } catch (e2) {
          setError(errorMessage(e2));
        }
      } else setError(errorMessage(e));
    }
  }, []);

  // Restaure la session et écoute les changements de compte / réseau
  useEffect(() => {
    if (!window.ethereum) return;
    const eth = window.ethereum;
    eth.request({ method: "eth_chainId" }).then((id) => setChainId(parseInt(id, 16))).catch(() => {});
    if (!localStorage.getItem(DISCONNECT_FLAG)) {
      eth.request({ method: "eth_accounts" }).then((a) => setAccount(a[0] ?? null)).catch(() => {});
    }
    const onAccounts = (a) => setAccount(localStorage.getItem(DISCONNECT_FLAG) ? null : a[0] ?? null);
    const onChain = (id) => setChainId(parseInt(id, 16));
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  const value = { account, chainId, provider, isSupported, hasMetaMask, connecting, error, connect, disconnect, switchNetwork };
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
