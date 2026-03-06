import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { CategoryPage } from "./pages/CategoryPage";
import VelocityField from "./apps/VelocityField/VelocityField";
import Deformations from "./apps/Deformations/Deformations";
import DiscreteContinuous from "./apps/DiscreteContinuous/DiscreteContinuous";
import MeanFreePath from "./apps/MeanFreePath/MeanFreePath";
import EulerLagrange from "./apps/EulerLagrange/EulerLagrange";
import Meniscus from "./apps/Meniscus/Meniscus";
import HydrostaticPressure from "./apps/HydrostaticPressure/HydrostaticPressure";
import ParallelAtmospheres from "./apps/ParallelAtmospheres/ParallelAtmospheres";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/category/:categoryId" element={<CategoryPage />} />
        <Route path="/apps/velocity-field" element={<VelocityField />} />
        <Route path="/apps/calc-deformaciones" element={<Deformations />} />
        <Route path="/apps/discreto-continuo" element={<DiscreteContinuous />} />
        <Route path="/apps/camino-libre-medio" element={<MeanFreePath />} />
        <Route path="/apps/euler-lagrange" element={<EulerLagrange />} />
        <Route path="/apps/meniscus" element={<Meniscus />} />
        <Route path="/apps/hydrostatic-pressure" element={<HydrostaticPressure />} />
        <Route path="/apps/parallel-atmospheres" element={<ParallelAtmospheres />} />
      </Routes>
    </Layout>
  );
}

export default App;
