import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Explore from "./pages/Explore.jsx";
import Create from "./pages/Create.jsx";
import Sell from "./pages/Sell.jsx";
import MyNFTs from "./pages/MyNFTs.jsx";
import Performance from "./pages/Performance.jsx";

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/create" element={<Create />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/my-nfts" element={<MyNFTs />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="*" element={<p className="muted">Page introuvable.</p>} />
        </Routes>
      </main>
    </>
  );
}
