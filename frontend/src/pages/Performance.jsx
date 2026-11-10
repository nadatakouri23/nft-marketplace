import { useState } from "react";
import data from "../data/benchmarks.json";
import BarChart from "../components/BarChart.jsx";

const LABELS = {
  mint: "Mint (créer)",
  approve: "Approve",
  list: "Mise en vente",
  buy: "Achat",
  cancel: "Annulation",
};
const ORDER = ["mint", "approve", "list", "buy", "cancel"];
const SEND = "var(--series-1)";
const CONFIRM = "var(--series-2)";

const ms = (v) => (v < 10 ? v.toFixed(2) : v < 1000 ? v.toFixed(1) : `${(v / 1000).toFixed(2)} s`);
const msUnit = (v) => (v >= 1000 ? ms(v) : `${ms(v)} ms`);
const eth = (v) => v.toFixed(8);

export default function Performance() {
  const networks = Object.keys(data);
  const [net, setNet] = useState(networks[0]);

  if (networks.length === 0)
    return (
      <section>
        <h1>Performance</h1>
        <p className="muted">Aucune mesure. Lance <code>npx hardhat run scripts/benchmark.js</code>.</p>
      </section>
    );

  const r = data[net];
  const ops = ORDER.filter((o) => r.ops[o]);
  const t = r.throughput;

  return (
    <section>
      <h1>Performance des opérations</h1>
      <div className="controls">
        <label>Réseau
          <select value={net} onChange={(e) => setNet(e.target.value)}>
            {networks.map((n) => <option key={n} value={n}>{n} (chainId {data[n].chainId})</option>)}
          </select>
        </label>
        <p className="muted">
          {r.runs} répétitions par opération · lot de {r.batch} transactions · mesuré le {new Date(r.date).toLocaleString("fr-FR")}
        </p>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-value">{t.sequentialTps.toFixed(1)}</span><span className="muted">tx/s confirmées, envoi séquentiel</span></div>
        <div className="stat"><span className="stat-value">{t.parallelTps.toFixed(1)}</span><span className="muted">tx/s confirmées, envoi en rafale</span></div>
      </div>

      <div className="panel">
        <BarChart
          title="Latence moyenne : envoi et confirmation"
          unit="ms ou s"
          series={[{ name: "Envoi", color: SEND }, { name: "Confirmation", color: CONFIRM }]}
          rows={ops.map((o) => ({ label: LABELS[o], values: [r.ops[o].send.mean, r.ops[o].confirm.mean] }))}
          format={msUnit}
        />
      </div>

      <div className="panel">
        <BarChart
          title="Gas utilisé par opération"
          unit="unités de gas"
          series={[{ name: "Gas utilisé", color: SEND }]}
          rows={ops.map((o) => ({ label: LABELS[o], values: [r.ops[o].gasUsed] }))}
          format={(v) => Math.round(v).toLocaleString("fr-FR")}
        />
      </div>

      <h2>Tableau des mesures</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Opération</th><th>Envoi moy.</th><th>Confirm. moy.</th><th>Total médian</th>
            <th>Total min–max</th><th>Gas</th><th>Prix gas (gwei)</th><th>Frais (ETH)</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((o) => {
            const x = r.ops[o];
            return (
              <tr key={o}>
                <td>{LABELS[o]}</td>
                <td>{msUnit(x.send.mean)}</td>
                <td>{msUnit(x.confirm.mean)}</td>
                <td>{msUnit(x.total.median)}</td>
                <td>{ms(x.total.min)}–{msUnit(x.total.max)}</td>
                <td>{Math.round(x.gasUsed).toLocaleString("fr-FR")}</td>
                <td>{x.gasPriceGwei.toFixed(2)}</td>
                <td>{eth(x.feeEth)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">
        Frais = gasUsed × effectiveGasPrice. Envoi = délai jusqu'à l'acceptation de la transaction par le nœud (hash reçu) ;
        confirmation = délai suivant jusqu'à l'inclusion dans un bloc.
      </p>

      <h2>Hardhat local ou Sepolia : pourquoi les résultats diffèrent</h2>
      <ul className="explain">
        <li><b>Production des blocs.</b> Hardhat mine un bloc instantanément à chaque transaction (automine). Sepolia produit un bloc environ toutes les 12 secondes : la confirmation y domine la latence.</li>
        <li><b>Réseau.</b> En local il n'y a ni latence réseau ni concurrence. Sur Sepolia, l'envoi passe par un fournisseur RPC distant et le mempool public.</li>
        <li><b>Frais.</b> En local le prix du gas est fictif. Sur Sepolia il fluctue avec la demande (et les ETH de test n'ont pas de valeur réelle).</li>
        <li><b>Gas.</b> Le gas utilisé par opération est identique : il dépend du code des contrats, pas du réseau.</li>
        <li><b>Débit.</b> Hardhat mesure surtout la vitesse du simulateur. Sur Sepolia, le débit est limité par le temps de bloc : une rafale est confirmée par lots dans quelques blocs.</li>
      </ul>
    </section>
  );
}
