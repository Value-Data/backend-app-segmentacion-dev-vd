import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/Login";

// Lazy-loaded pages — code-split per route
const HomePage = lazy(() => import("@/pages/Home").then(m => ({ default: m.HomePage })));

// Catalogos (ex Mantenedores)
const MantenedoresHub = lazy(() => import("@/pages/mantenedores/MantenedoresHub").then(m => ({ default: m.MantenedoresHub })));
const EspeciesPage = lazy(() => import("@/pages/mantenedores/EspeciesPage").then(m => ({ default: m.EspeciesPage })));
const VariedadesPage = lazy(() => import("@/pages/mantenedores/VariedadesPage").then(m => ({ default: m.VariedadesPage })));
const PortainjertosPage = lazy(() => import("@/pages/mantenedores/PortainjertosPage").then(m => ({ default: m.PortainjertosPage })));
const PmgPage = lazy(() => import("@/pages/mantenedores/PmgPage").then(m => ({ default: m.PmgPage })));
const ViverosPage = lazy(() => import("@/pages/mantenedores/ViverosPage").then(m => ({ default: m.ViverosPage })));
const CamposPage = lazy(() => import("@/pages/mantenedores/CamposPage").then(m => ({ default: m.CamposPage })));
const ColoresPage = lazy(() => import("@/pages/mantenedores/ColoresPage").then(m => ({ default: m.ColoresPage })));
const SusceptibilidadesPage = lazy(() => import("@/pages/mantenedores/SusceptibilidadesPage").then(m => ({ default: m.SusceptibilidadesPage })));
const TiposLaborPage = lazy(() => import("@/pages/mantenedores/TiposLaborPage").then(m => ({ default: m.TiposLaborPage })));
const EstadosFenologicosPage = lazy(() => import("@/pages/mantenedores/EstadosFenologicosPage").then(m => ({ default: m.EstadosFenologicosPage })));
const EstadosPlantaPage = lazy(() => import("@/pages/mantenedores/EstadosPlantaPage").then(m => ({ default: m.EstadosPlantaPage })));
const PaisesPage = lazy(() => import("@/pages/mantenedores/PaisesPage").then(m => ({ default: m.PaisesPage })));
const OrigenesPage = lazy(() => import("@/pages/mantenedores/OrigenesPage").then(m => ({ default: m.OrigenesPage })));
const TemporadasPage = lazy(() => import("@/pages/mantenedores/TemporadasPage").then(m => ({ default: m.TemporadasPage })));
const BodegasPage = lazy(() => import("@/pages/mantenedores/BodegasPage").then(m => ({ default: m.BodegasPage })));
const RegionesPage = lazy(() => import("@/pages/mantenedores/RegionesPage").then(m => ({ default: m.RegionesPage })));
const ComunasPage = lazy(() => import("@/pages/mantenedores/ComunasPage").then(m => ({ default: m.ComunasPage })));

// Inventario
const InventarioPage = lazy(() => import("@/pages/inventario/InventarioPage").then(m => ({ default: m.InventarioPage })));
const LoteDetailPage = lazy(() => import("@/pages/inventario/LoteDetailPage").then(m => ({ default: m.LoteDetailPage })));

// TestBlocks
const TestblocksListPage = lazy(() => import("@/pages/testblocks/TestblocksListPage").then(m => ({ default: m.TestblocksListPage })));
const TestblockNewPage = lazy(() => import("@/pages/testblocks/TestblockNewPage").then(m => ({ default: m.TestblockNewPage })));
const TestblockDetailPage = lazy(() => import("@/pages/testblocks/TestblockDetailPage").then(m => ({ default: m.TestblockDetailPage })));

// Laboratorio
const LaboratorioPage = lazy(() => import("@/pages/laboratorio/LaboratorioPage").then(m => ({ default: m.LaboratorioPage })));
const AnalisisLabPage = lazy(() => import("@/pages/laboratorio/AnalisisLabPage").then(m => ({ default: m.AnalisisLabPage })));

// Labores
const LaboresPage = lazy(() => import("@/pages/labores/LaboresPage").then(m => ({ default: m.LaboresPage })));

// Fenologia
const FenologiaPage = lazy(() => import("@/pages/fenologia/FenologiaPage").then(m => ({ default: m.FenologiaPage })));

// Analisis
const AnalisisPage = lazy(() => import("@/pages/analisis/AnalisisPage").then(m => ({ default: m.AnalisisPage })));

// Reportes
const ReportesPage = lazy(() => import("@/pages/reportes/ReportesPage").then(m => ({ default: m.ReportesPage })));

// Alertas
const AlertasPage = lazy(() => import("@/pages/alertas/AlertasPage").then(m => ({ default: m.AlertasPage })));

// Sistema
const UsuariosPage = lazy(() => import("@/pages/sistema/UsuariosPage").then(m => ({ default: m.UsuariosPage })));
const AuditLogPage = lazy(() => import("@/pages/sistema/AuditLogPage").then(m => ({ default: m.AuditLogPage })));

// Mockup
const MockupPage = lazy(() => import("@/pages/MockupPage").then(m => ({ default: m.MockupPage })));

// Demo Lotes
const DemoLotesPage = lazy(() => import("@/pages/DemoLotesPage").then(m => ({ default: m.DemoLotesPage })));

// 404
const NotFoundPage = lazy(() => import("@/pages/NotFound").then(m => ({ default: m.NotFoundPage })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />

        {/* Catalogos (ex Mantenedores) */}
        <Route path="catalogos" element={<MantenedoresHub />} />
        <Route path="catalogos/especies" element={<EspeciesPage />} />
        <Route path="catalogos/variedades" element={<VariedadesPage />} />
        <Route path="catalogos/portainjertos" element={<PortainjertosPage />} />
        <Route path="catalogos/pmg" element={<PmgPage />} />
        <Route path="catalogos/viveros" element={<ViverosPage />} />
        <Route path="catalogos/campos" element={<CamposPage />} />
        <Route path="catalogos/colores" element={<ColoresPage />} />
        <Route path="catalogos/susceptibilidades" element={<SusceptibilidadesPage />} />
        <Route path="catalogos/tipos-labor" element={<TiposLaborPage />} />
        <Route path="catalogos/estados-fenologicos" element={<EstadosFenologicosPage />} />
        <Route path="catalogos/estados-planta" element={<EstadosPlantaPage />} />
        <Route path="catalogos/paises" element={<PaisesPage />} />
        <Route path="catalogos/origenes" element={<OrigenesPage />} />
        <Route path="catalogos/temporadas" element={<TemporadasPage />} />
        <Route path="catalogos/bodegas" element={<BodegasPage />} />
        <Route path="catalogos/regiones" element={<RegionesPage />} />
        <Route path="catalogos/comunas" element={<ComunasPage />} />
        {/* Redirect legacy /mantenedores URLs */}
        <Route path="mantenedores/*" element={<Navigate to="/catalogos" replace />} />

        {/* Inventario */}
        <Route path="inventario" element={<InventarioPage />} />
        <Route path="inventario/:id" element={<LoteDetailPage />} />

        {/* TestBlocks */}
        <Route path="testblocks" element={<TestblocksListPage />} />
        <Route path="testblocks/nuevo" element={<TestblockNewPage />} />
        <Route path="testblocks/:id" element={<TestblockDetailPage />} />

        {/* Laboratorio */}
        <Route path="laboratorio" element={<LaboratorioPage />} />
        <Route path="laboratorio/analisis" element={<AnalisisLabPage />} />

        {/* Labores */}
        <Route path="labores" element={<LaboresPage />} />

        {/* Fenologia */}
        <Route path="fenologia" element={<FenologiaPage />} />

        {/* Analisis */}
        <Route path="analisis" element={<AnalisisPage />} />

        {/* Reportes */}
        <Route path="reportes" element={<ReportesPage />} />

        {/* Alertas */}
        <Route path="alertas" element={<AlertasPage />} />

        {/* Sistema */}
        <Route path="sistema/usuarios" element={<UsuariosPage />} />
        <Route path="sistema/audit-log" element={<AuditLogPage />} />

        {/* Mockup */}
        <Route path="mockup" element={<MockupPage />} />

        {/* Demo Lotes */}
        <Route path="demo-lotes" element={<DemoLotesPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
