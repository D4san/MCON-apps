import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import VelocityField from "./apps/VelocityField/VelocityField";
import Deformations from "./apps/Deformations/Deformations";
import DiscreteContinuous from "./apps/DiscreteContinuous/DiscreteContinuous";
import MeanFreePath from "./apps/MeanFreePath/MeanFreePath";
import EulerLagrange from "./apps/EulerLagrange/EulerLagrange";
import Meniscus from "./apps/Meniscus/Meniscus";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps/velocity-field" element={<VelocityField />} />
        <Route path="/apps/calc-deformaciones" element={<Deformations />} />
        <Route path="/apps/discreto-continuo" element={<DiscreteContinuous />} />
        <Route path="/apps/camino-libre-medio" element={<MeanFreePath />} />
        <Route path="/apps/perspectiva-euler-lagrange" element={<EulerLagrange />} />
        <Route path="/apps/meniscos" element={<Meniscus />} />
      </Routes>
    </Layout>
  );
}

export default App;
