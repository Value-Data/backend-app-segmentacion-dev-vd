import { useState } from "react";

const COLORS = {
  primary: "#7C1D1D",
  primaryLight: "#9B2C2C",
  primaryDark: "#5C0E0E",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#2563EB",
  neutral: "#9CA3AF",
  bg: "#F8F9FA",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#1F2937",
  textMuted: "#6B7280",
  cereza: "#DC2626",
  ciruela: "#7C3AED",
  carozo: "#EA580C",
  nectarin: "#D97706",
};

const Badge = ({ children, color = COLORS.success, size = "sm" }: { children: React.ReactNode; color?: string; size?: string }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: size === "sm" ? "2px 8px" : "4px 12px",
      borderRadius: 999,
      fontSize: size === "sm" ? 11 : 12,
      fontWeight: 600,
      background: color + "18",
      color: color,
      letterSpacing: 0.3,
    }}
  >
    {children}
  </span>
);

const KPICard = ({ title, value, icon, color, subtitle, onClick, active }: any) => (
  <div
    onClick={onClick}
    style={{
      background: active ? color + "08" : COLORS.card,
      border: `1.5px solid ${active ? color : COLORS.border}`,
      borderRadius: 12,
      padding: "16px 20px",
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.2s",
      flex: 1,
      minWidth: 140,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>{title}</span>
      <span style={{ fontSize: 18, opacity: 0.6 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
    {subtitle && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{subtitle}</div>}
  </div>
);

const Tab = ({ label, active, onClick, badge }: any) => (
  <button
    onClick={onClick}
    style={{
      padding: "8px 16px",
      border: "none",
      borderBottom: active ? `2.5px solid ${COLORS.primary}` : "2.5px solid transparent",
      background: "none",
      color: active ? COLORS.primary : COLORS.textMuted,
      fontWeight: active ? 700 : 500,
      fontSize: 13,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    {label}
    {badge && (
      <span style={{ background: COLORS.danger, color: "#fff", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, minWidth: 18, textAlign: "center" as const }}>
        {badge}
      </span>
    )}
  </button>
);

const SidebarItem = ({ icon, label, active, badge, indent }: any) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: indent ? "7px 16px 7px 36px" : "9px 16px",
      background: active ? "rgba(255,255,255,0.15)" : "transparent",
      borderLeft: active ? "3px solid #fff" : "3px solid transparent",
      cursor: "pointer",
      fontSize: 13,
      color: active ? "#fff" : "rgba(255,255,255,0.75)",
      fontWeight: active ? 600 : 400,
    }}
  >
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 15, width: 20, textAlign: "center" as const }}>{icon}</span>
      {label}
    </span>
    {badge && (
      <span style={{ background: "#EF4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99 }}>
        {badge}
      </span>
    )}
  </div>
);

const SidebarSection = ({ label }: { label: string }) => (
  <div style={{ padding: "14px 16px 4px", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5, textTransform: "uppercase" as const }}>
    {label}
  </div>
);

const MockSidebar = ({ activeScreen, setActiveScreen }: any) => (
  <div style={{ width: 200, background: `linear-gradient(180deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`, color: "#fff", display: "flex", flexDirection: "column" as const, flexShrink: 0, overflowY: "auto" as const }}>
    <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>Garces Fruit</div>
      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>Segmentacion de Especies</div>
    </div>
    <div style={{ padding: "8px 0", flex: 1 }}>
      <SidebarItem icon="H" label="Inicio" active={activeScreen === "home"} />
      <SidebarSection label="Catalogos" />
      <SidebarItem icon="E" label="Especies" indent />
      <SidebarItem icon="V" label="Variedades" indent />
      <SidebarItem icon="P" label="Portainjertos" indent />
      <SidebarItem icon="C" label="Campos" indent />
      <SidebarItem icon="M" label="PMG" indent />
      <SidebarSection label="Inventario" />
      <SidebarItem icon="I" label="Inventario Vivero" active={activeScreen === "inventario"} />
      <SidebarSection label="Operaciones" />
      <SidebarItem icon="T" label="TestBlocks" active={activeScreen === "testblock"} />
      <SidebarItem icon="L" label="Labores" active={activeScreen === "labores"} badge="15" />
      <SidebarItem icon="F" label="Fenologia" active={activeScreen === "fenologia"} />
      <SidebarSection label="Calidad" />
      <SidebarItem icon="M" label="Mediciones Lab" active={activeScreen === "mediciones"} />
      <SidebarItem icon="A" label="Analisis" />
      <SidebarItem icon="R" label="Reportes" />
      <SidebarSection label="" />
      <SidebarItem icon="!" label="Alertas" badge="4" />
      <SidebarItem icon="S" label="Sistema" />
    </div>
    <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 99, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>CG</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 11 }}>Camila Garces</div>
        <div style={{ fontSize: 9, opacity: 0.5 }}>Administradora</div>
      </div>
    </div>
  </div>
);

/* --- LABORES SCREEN --- */
const LaboresScreen = () => {
  const [activeTab, setActiveTab] = useState("hoy");
  const [selectedPauta, setSelectedPauta] = useState<string | null>(null);

  const pautaCerezo = [
    { id: 1, tipo: "Fenologia", nombre: "Inicio caida de hoja", icon: "L", mes: "Abr", cat: "fenologia" },
    { id: 2, tipo: "Fenologia", nombre: "50% caida de hoja", icon: "L", mes: "May", cat: "fenologia" },
    { id: 3, tipo: "Fenologia", nombre: "100% caida de hoja", icon: "L", mes: "Jun", cat: "fenologia" },
    { id: 4, tipo: "Labor", nombre: "Poda de formacion", icon: "P", mes: "Jun-Jul", cat: "poda" },
    { id: 5, tipo: "Fenologia", nombre: "Yema dormante", icon: "Y", mes: "Jul", cat: "fenologia" },
    { id: 6, tipo: "Labor", nombre: "Aplicacion Dormex", icon: "D", mes: "Jul", cat: "fitosanidad" },
    { id: 7, tipo: "Labor", nombre: "Fertilizacion base", icon: "F", mes: "Ago", cat: "fertilizacion" },
    { id: 8, tipo: "Fenologia", nombre: "Yema hinchada", icon: "Y", mes: "Ago", cat: "fenologia" },
    { id: 9, tipo: "Fenologia", nombre: "Punta verde", icon: "P", mes: "Sep", cat: "fenologia" },
    { id: 10, tipo: "Fenologia", nombre: "Inicio floracion", icon: "F", mes: "Sep", cat: "fenologia" },
    { id: 11, tipo: "Fenologia", nombre: "Plena floracion", icon: "F", mes: "Oct", cat: "fenologia" },
    { id: 12, tipo: "Labor", nombre: "Aplicacion GA3", icon: "G", mes: "Oct", cat: "fitosanidad" },
    { id: 13, tipo: "Fenologia", nombre: "Cuaja", icon: "C", mes: "Oct-Nov", cat: "fenologia" },
    { id: 14, tipo: "Labor", nombre: "Raleo", icon: "R", mes: "Nov", cat: "manejo" },
    { id: 15, tipo: "Fenologia", nombre: "Pinta / Envero", icon: "E", mes: "Nov", cat: "fenologia" },
    { id: 16, tipo: "Labor", nombre: "Cosecha", icon: "C", mes: "Nov-Dic", cat: "cosecha" },
  ];

  const laboresHoy = [
    { id: 1, tb: "TB-CEREZO-2024", labor: "Poda de formacion", tipo: "Labor", estado: "pendiente", grupo: "TestBlock completo" },
    { id: 2, tb: "TB-47516", labor: "Fertilizacion base", tipo: "Labor", estado: "pendiente", grupo: "Grupo PRIM 2.5 / Colt" },
    { id: 3, tb: "TB-CEREZO-2024", labor: "Inicio caida de hoja", tipo: "Fenologia", estado: "pendiente", grupo: "TestBlock completo" },
    { id: 4, tb: "TB-47517", labor: "Aplicacion Dormex", tipo: "Labor", estado: "ejecutada", grupo: "TestBlock completo" },
  ];

  const catColors: Record<string, string> = {
    fenologia: "#7C3AED", poda: "#16A34A", fitosanidad: "#EA580C",
    fertilizacion: "#2563EB", manejo: "#D97706", cosecha: "#DC2626",
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Gestion de Labores</h2>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.textMuted }}>Labores y registro fenologico integrado</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>+ Planificar Posicion</button>
          <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+ Planificar TestBlock</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <KPICard title="Hoy" value="3" icon="+" color={COLORS.info} subtitle="labores programadas" />
        <KPICard title="Esta semana" value="12" icon="S" color={COLORS.text} subtitle="pendientes" />
        <KPICard title="Atrasadas" value="15" icon="!" color={COLORS.danger} subtitle="vencidas" />
        <KPICard title="Cumplimiento" value="68%" icon="^" color={COLORS.success} subtitle="este mes" />
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16, gap: 4 }}>
        <Tab label="Hoy" active={activeTab === "hoy"} onClick={() => setActiveTab("hoy")} />
        <Tab label="Semana" active={activeTab === "semana"} onClick={() => setActiveTab("semana")} />
        <Tab label="Pauta por Especie" active={activeTab === "pauta"} onClick={() => setActiveTab("pauta")} />
        <Tab label="Timeline" active={activeTab === "timeline"} onClick={() => setActiveTab("timeline")} />
        <Tab label="Atrasadas" active={activeTab === "atrasadas"} onClick={() => setActiveTab("atrasadas")} badge="15" />
      </div>

      {activeTab === "hoy" && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textMuted, marginBottom: 12 }}>
            Viernes 4 de Abril, 2026 -- 3 pendientes, 1 ejecutada
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {laboresHoy.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: l.estado === "ejecutada" ? "#F0FDF4" : "#fff", borderRadius: 10, border: `1px solid ${l.estado === "ejecutada" ? "#BBF7D0" : COLORS.border}` }}>
                <button style={{ width: 36, height: 36, borderRadius: 99, border: l.estado === "ejecutada" ? "none" : `2px solid ${COLORS.border}`, background: l.estado === "ejecutada" ? COLORS.success : "#fff", color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {l.estado === "ejecutada" ? "v" : ""}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, textDecoration: l.estado === "ejecutada" ? "line-through" : "none", color: l.estado === "ejecutada" ? COLORS.textMuted : COLORS.text }}>{l.labor}</span>
                    <Badge color={l.tipo === "Fenologia" ? "#7C3AED" : COLORS.info}>{l.tipo}</Badge>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{l.tb} - {l.grupo}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {l.tipo === "Fenologia" && l.estado !== "ejecutada" && (
                    <button style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid #7C3AED30`, background: "#7C3AED08", color: "#7C3AED", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>+ Foto</button>
                  )}
                  <button style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>...</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "pauta" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["Cerezo", "Ciruela", "Nectarin", "Durazno"].map((e, i) => (
              <button key={e} onClick={() => setSelectedPauta(i === 0 ? "cerezo" : null)} style={{ padding: "6px 14px", borderRadius: 99, border: `1.5px solid ${(i === 0 && selectedPauta === "cerezo") ? COLORS.cereza : COLORS.border}`, background: (i === 0 && selectedPauta === "cerezo") ? COLORS.cereza + "10" : "#fff", color: (i === 0 && selectedPauta === "cerezo") ? COLORS.cereza : COLORS.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {e}
              </button>
            ))}
          </div>

          {selectedPauta === "cerezo" && (
            <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, background: "#FAFAFA", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Pauta Cerezo -- Temporada 2025-2026</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 12 }}>16 items (9 fenologia + 7 labores)</span>
                </div>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: COLORS.primary, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Aplicar pauta a TestBlock</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {pautaCerezo.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: i < pautaCerezo.length - 1 ? `1px solid ${COLORS.border}40` : "none" }}>
                    <input type="checkbox" defaultChecked />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</span>
                    </div>
                    <Badge color={catColors[p.cat]} size="sm">{p.tipo}</Badge>
                    <span style={{ fontSize: 12, color: COLORS.textMuted, width: 60, textAlign: "right" as const }}>{p.mes}</span>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: catColors[p.cat], opacity: 0.6 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!selectedPauta && (
            <div style={{ textAlign: "center" as const, padding: 60, color: COLORS.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>+</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Selecciona una especie para ver su pauta</div>
            </div>
          )}
        </div>
      )}

      {(activeTab === "semana" || activeTab === "timeline" || activeTab === "atrasadas") && (
        <div style={{ textAlign: "center" as const, padding: 40, color: COLORS.textMuted }}>
          <div style={{ fontSize: 14 }}>Vista "{activeTab}" -- misma logica, datos reales</div>
        </div>
      )}
    </div>
  );
};

/* --- TESTBLOCK SCREEN --- */
const TestBlockScreen = () => {
  const [selectedCell, setSelectedCell] = useState<any>(null);
  const [estadoTB, setEstadoTB] = useState("formacion");

  const variedades = ["Gi6", "Nip", "IBC", "HSP", "Cat", "Swe", "Roy", "Lap", "CE2", "H12", "H15", "H19", "H21", "San", "Sal", "69", "EB", "IVU"];
  const palette = ["#DC2626", "#EA580C", "#D97706", "#16A34A", "#0D9488", "#2563EB", "#7C3AED", "#DB2777", "#9333EA", "#6366F1", "#0EA5E9", "#14B8A6", "#84CC16", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4"];

  const grid: any[][] = [];
  for (let h = 1; h <= 6; h++) {
    const row: any[] = [];
    for (let p = 1; p <= 20; p++) {
      const vi = Math.floor(Math.random() * variedades.length);
      const isLap = p === 6 || p === 12 || p === 18;
      row.push({ h, p, var: isLap ? "Lap" : variedades[vi], status: Math.random() > 0.92 ? "baja" : Math.random() > 0.95 ? "vacia" : "alta" });
    }
    grid.push(row);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted, cursor: "pointer" }}>TestBlocks</span>
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700 }}>TestBlock Cuartel 47516</h2>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <Badge color={COLORS.success}>activo</Badge>
            <Badge color={COLORS.cereza}>Cerezo</Badge>
            <Badge color={COLORS.info}>2024</Badge>
            <Badge color="#7C3AED">Raiz desnuda</Badge>
            <div style={{ display: "inline-flex", borderRadius: 99, border: `1.5px solid ${COLORS.border}`, overflow: "hidden", marginLeft: 4 }}>
              <button onClick={() => setEstadoTB("formacion")} style={{ padding: "3px 10px", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: estadoTB === "formacion" ? "#D97706" : "#fff", color: estadoTB === "formacion" ? "#fff" : COLORS.textMuted }}>Formacion</button>
              <button onClick={() => setEstadoTB("produccion")} style={{ padding: "3px 10px", border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", background: estadoTB === "produccion" ? COLORS.success : "#fff", color: estadoTB === "produccion" ? "#fff" : COLORS.textMuted }}>Produccion</button>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 12, cursor: "pointer" }}>QR Etiquetas</button>
          <button style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: COLORS.success, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>+ Alta</button>
          <button style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: COLORS.danger, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>- Baja</button>
          <button style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: COLORS.info, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Replante</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <KPICard title="Total" value="120" icon="T" color={COLORS.text} />
        <KPICard title="Alta" value="112" icon="A" color={COLORS.success} />
        <KPICard title="Baja" value="5" icon="B" color={COLORS.danger} />
        <KPICard title="Vacia" value="3" icon="V" color={COLORS.neutral} />
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Tab label="Grilla" active />
              <Tab label="Resumen" />
              <Tab label="Variedades" />
              <Tab label="Mediciones" />
              <Tab label="Historial" />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {[{ c: COLORS.success, l: "Alta" }, { c: COLORS.danger, l: "Baja" }, { c: COLORS.neutral, l: "Vacia" }, { c: "#D97706", l: "Polinizante" }].map(x => (
                <span key={x.l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textMuted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: x.c }} /> {x.l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `28px repeat(20, 1fr)`, gap: 2, fontSize: 9 }}>
            <div style={{ fontWeight: 700, fontSize: 8, color: COLORS.textMuted, textAlign: "center" as const }}>H\P</div>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{ textAlign: "center" as const, fontWeight: 600, fontSize: 8, color: COLORS.textMuted }}>{i + 1}</div>
            ))}

            {grid.map((row, hi) => (
              <div key={`row-${hi}`} style={{ display: "contents" }}>
                <div style={{ fontWeight: 700, fontSize: 8, color: COLORS.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>{hi + 1}</div>
                {row.map((cell, pi) => {
                  const isSelected = selectedCell?.h === cell.h && selectedCell?.p === cell.p;
                  const bg = cell.status === "baja" ? COLORS.danger : cell.status === "vacia" ? COLORS.neutral + "40" : cell.var === "Lap" ? "#D97706" : COLORS.success;
                  return (
                    <div
                      key={`${hi}-${pi}`}
                      onClick={() => setSelectedCell(cell)}
                      style={{
                        background: bg,
                        color: "#fff",
                        textAlign: "center" as const,
                        padding: "3px 0",
                        borderRadius: 3,
                        fontSize: 8,
                        fontWeight: 600,
                        cursor: "pointer",
                        outline: isSelected ? "2px solid #000" : "none",
                        outlineOffset: 1,
                        opacity: cell.status === "vacia" ? 0.4 : 1,
                      }}
                    >
                      {cell.status === "vacia" ? "" : cell.var.slice(0, 3)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {selectedCell && (
          <div style={{ width: 260, background: "#fff", borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>H{selectedCell.h} - P{selectedCell.p}</span>
              <Badge color={selectedCell.status === "alta" ? COLORS.success : selectedCell.status === "baja" ? COLORS.danger : COLORS.neutral}>{selectedCell.status}</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
              <div><span style={{ color: COLORS.textMuted }}>Variedad:</span> <strong>{selectedCell.var}</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Portainjerto:</span> <strong>Gisela 6</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Tipo planta:</span> <strong>Raiz desnuda</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Injerto:</span> <strong>Ojo vivo (dic 2024)</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Marco:</span> <strong>3,6 x 1,8</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Conduccion:</span> <strong>Bibaun</strong></div>
              <div><span style={{ color: COLORS.textMuted }}>Estado:</span> <Badge color="#D97706" size="sm">Formacion</Badge></div>
              <div><span style={{ color: COLORS.textMuted }}>Lote origen:</span> <span style={{ color: COLORS.info, cursor: "pointer", fontWeight: 600 }}>INV-00001</span></div>

              <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8, color: COLORS.textMuted }}>HISTORIAL</div>
                {[
                  { fecha: "15-Mar-2025", accion: "Alta", desc: "Desde INV-00001", color: COLORS.success },
                  { fecha: "04-Abr-2026", accion: "Fenologia", desc: "Inicio caida hoja", color: "#7C3AED" },
                ].map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: ev.color, marginTop: 4, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{ev.accion}</div>
                      <div style={{ fontSize: 10, color: COLORS.textMuted }}>{ev.fecha} - {ev.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${COLORS.danger}30`, background: COLORS.danger + "08", color: COLORS.danger, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Dar de baja</button>
                <button style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1px solid ${COLORS.info}30`, background: COLORS.info + "08", color: COLORS.info, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Replantar</button>
              </div>
              <button style={{ padding: "6px 0", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.textMuted, fontSize: 11, cursor: "pointer", width: "100%" }}>Generar QR</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* --- MEDICIONES SCREEN --- */
const MedicionesScreen = () => {
  const [activeTab, setActiveTab] = useState("lab");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Mediciones de Calidad</h2>
          <p style={{ margin: 0, fontSize: 12, color: COLORS.textMuted }}>Evaluaciones de laboratorio, poscosecha y externas</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 12, cursor: "pointer" }}>Importar Excel</button>
          <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#7C3AED", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Analizar</button>
        </div>
      </div>

      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16, gap: 4 }}>
        <Tab label="Laboratorio (Cosecha)" active={activeTab === "lab"} onClick={() => setActiveTab("lab")} />
        <Tab label="Poscosecha" active={activeTab === "posc"} onClick={() => setActiveTab("posc")} />
        <Tab label="Ambiente (+N dias)" active={activeTab === "amb"} onClick={() => setActiveTab("amb")} />
        <Tab label="Externos" active={activeTab === "ext"} onClick={() => setActiveTab("ext")} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Temporada", value: "2024-2025" },
          { label: "Campo", value: "Santa Margarita" },
          { label: "Variedad", value: "Todas" },
          { label: "PMG", value: "Todos" },
          { label: "Color", value: "Todos" },
        ].map((f) => (
          <div key={f.label} style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{f.label}</span>
            <select style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12, background: "#fff", minWidth: 120 }}>
              <option>{f.value}</option>
            </select>
          </div>
        ))}
        {activeTab === "posc" && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: COLORS.textMuted, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Dias almacenaje</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input type="number" placeholder="30" style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12, width: 50 }} />
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>a</span>
              <input type="number" placeholder="45" style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 12, width: 50 }} />
              <span style={{ fontSize: 10, color: COLORS.textMuted }}>dias</span>
            </div>
          </div>
        )}
        <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.primary}`, background: COLORS.primary + "08", color: COLORS.primary, fontSize: 11, cursor: "pointer", fontWeight: 600, alignSelf: "flex-end" }}>Aplicar</button>
        <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.textMuted, fontSize: 11, cursor: "pointer", alignSelf: "flex-end" }}>Limpiar</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Variedad", "PMG", "P.Injerto", "Color", "Fecha", "Frutos", "Peso(g)", "Diam(mm)", "SS(%)", "Firmeza", "Defectos", ""].map(h => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left" as const, fontWeight: 600, fontSize: 11, color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { var: "Prim 2.5", pmg: "P.Stoppel", pi: "Colt", color: "Roja", fecha: "28-Nov-2024", frutos: 30, peso: "12.4", diam: "28.5", ss: "18.6", firm: "75.0", def: "3.2%" },
              { var: "Royal Tioga", pmg: "Zaiger", pi: "Gisela 6", color: "Roja", fecha: "15-Dic-2024", frutos: 25, peso: "11.8", diam: "27.2", ss: "19.1", firm: "68.5", def: "5.8%" },
              { var: "Lapins", pmg: "Summerland", pi: "Colt", color: "Roja", fecha: "20-Dic-2024", frutos: 30, peso: "10.2", diam: "26.8", ss: "17.4", firm: "72.0", def: "2.1%" },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}40` }}>
                <td style={{ padding: "10px", fontWeight: 600 }}>{r.var}</td>
                <td style={{ padding: "10px" }}>{r.pmg}</td>
                <td style={{ padding: "10px" }}>{r.pi}</td>
                <td style={{ padding: "10px" }}><Badge color={COLORS.cereza}>{r.color}</Badge></td>
                <td style={{ padding: "10px" }}>{r.fecha}</td>
                <td style={{ padding: "10px" }}>{r.frutos}</td>
                <td style={{ padding: "10px" }}>{r.peso}</td>
                <td style={{ padding: "10px" }}>{r.diam}</td>
                <td style={{ padding: "10px" }}>{r.ss}</td>
                <td style={{ padding: "10px" }}>{r.firm}</td>
                <td style={{ padding: "10px" }}><Badge color={parseFloat(r.def) > 5 ? COLORS.danger : COLORS.success}>{r.def}</Badge></td>
                <td style={{ padding: "10px" }}><span style={{ color: "#7C3AED", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Analizar</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* --- MAIN MOCKUP --- */
export function MockupPage() {
  const [activeScreen, setActiveScreen] = useState("labores");

  const screens: Record<string, React.ReactNode> = {
    labores: <LaboresScreen />,
    testblock: <TestBlockScreen />,
    mediciones: <MedicionesScreen />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", color: COLORS.text, background: COLORS.bg, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      <MockSidebar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 24px", borderBottom: `1px solid ${COLORS.border}`, background: "#fff", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { key: "labores", label: "Labores", badge: "15" },
              { key: "testblock", label: "TestBlock" },
              { key: "mediciones", label: "Mediciones" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveScreen(s.key)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: activeScreen === s.key ? `1.5px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                  background: activeScreen === s.key ? COLORS.primary + "08" : "#fff",
                  color: activeScreen === s.key ? COLORS.primary : COLORS.textMuted,
                  fontSize: 12,
                  fontWeight: activeScreen === s.key ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {s.label}
                {s.badge && <span style={{ background: COLORS.danger, color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 99, fontWeight: 700 }}>{s.badge}</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 99, background: COLORS.success }} />
            <span style={{ fontSize: 11, color: COLORS.textMuted }}>Conectado</span>
            <select style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 11 }}>
              <option>Temporada 2025-2026</option>
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {screens[activeScreen]}
        </div>
      </div>
    </div>
  );
}
