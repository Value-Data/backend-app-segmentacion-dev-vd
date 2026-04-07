/**
 * QA AUDIT: Button → Dialog rendering tests.
 *
 * Tests that every button that triggers a dialog/form actually renders
 * the corresponding dialog in the SAME return path.
 *
 * This catches the VariedadesPage bug where the CrudForm was only in the
 * list view return, but the "Editar" button existed in the detail view.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock all API services
vi.mock("@/services/api", () => ({
  get: vi.fn().mockResolvedValue([]),
  post: vi.fn().mockResolvedValue({}),
  put: vi.fn().mockResolvedValue({}),
  del: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/services/mantenedores", () => ({
  mantenedorService: () => ({
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue({}),
  }),
  variedadBitacoraService: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/services/labores", () => ({
  laboresService: {
    tiposLabor: vi.fn().mockResolvedValue([]),
    estadosFenologicos: vi.fn().mockResolvedValue([]),
    seedEstadosFenologicos: vi.fn().mockResolvedValue({ created: 0 }),
    seedTiposLabor: vi.fn().mockResolvedValue({ created: 0 }),
    seedDetallesLabor: vi.fn().mockResolvedValue({ created: 0 }),
    detallesLabor: vi.fn().mockResolvedValue([]),
    dashboard: vi.fn().mockResolvedValue({ total: 0, planificadas: 0, ejecutadas: 0, atrasadas: 0, esta_semana: 0, pct_cumplimiento: 0, por_tipo: {}, por_mes: {} }),
    planificacion: vi.fn().mockResolvedValue([]),
    hoy: vi.fn().mockResolvedValue([]),
    historialFenologico: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/services/laboratorio", () => ({
  laboratorioService: {
    mediciones: vi.fn().mockResolvedValue([]),
    kpis: vi.fn().mockResolvedValue({ total: 0 }),
  },
}));

vi.mock("@/hooks/useLookups", () => ({
  useLookups: () => ({
    especie: () => "-",
    pmg: () => "-",
    portainjerto: () => "-",
    variedad: () => "-",
    options: { especies: [], pmgs: [], portainjertos: [], variedades: [], campos: [] },
    stringOptions: { regiones: [], comunas: [] },
    comunasPorRegionNombre: () => [],
    rawData: { especies: [], variedades: [] },
  }),
}));

vi.mock("@/hooks/useTestblock", () => ({
  useTestblocks: () => ({ data: [] }),
}));

vi.mock("@/hooks/useRelaciones", () => ({
  usePmgEspecies: () => ({ currentIds: [], save: vi.fn(), isSaving: false }),
  useViveroPmgs: () => ({ currentIds: [], save: vi.fn(), isSaving: false }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: any) => {
    const state = { token: "test-token", user: { username: "admin", rol: "admin" } };
    return selector ? selector(state) : state;
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIEDADES PAGE
// ═══════════════════════════════════════════════════════════════════════════

describe("VariedadesPage: buttons and dialogs", () => {
  // Mock useCrud to return test data
  const mockVariedades = [
    { id_variedad: 1, codigo: "V-001", nombre: "Lapins", id_especie: 1, id_pmg: 1, estado: "prospecto", activo: true },
    { id_variedad: 2, codigo: "V-002", nombre: "Regina", id_especie: 1, id_pmg: 1, estado: "en_evaluacion", activo: true },
  ];

  beforeEach(() => {
    vi.doMock("@/hooks/useCrud", () => ({
      useCrud: () => ({
        data: mockVariedades,
        isLoading: false,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        isCreating: false,
        isUpdating: false,
      }),
    }));
  });

  it("renders 'Nueva Variedad' button in list view", async () => {
    const { VariedadesPage } = await import("@/pages/mantenedores/VariedadesPage");
    render(<VariedadesPage />, { wrapper });
    expect(screen.getByText("Nueva Variedad")).toBeInTheDocument();
  });

  it("opens CrudForm when 'Nueva Variedad' is clicked in list view", async () => {
    const { VariedadesPage } = await import("@/pages/mantenedores/VariedadesPage");
    render(<VariedadesPage />, { wrapper });
    await userEvent.click(screen.getByText("Nueva Variedad"));
    // CrudForm dialog should open with title
    expect(screen.getByText("Nueva Variedad", { selector: "[role='dialog'] *" }) || screen.getAllByText("Nueva Variedad").length >= 1).toBeTruthy();
  });

  it("opens detail view when clicking a variedad card", async () => {
    const { VariedadesPage } = await import("@/pages/mantenedores/VariedadesPage");
    render(<VariedadesPage />, { wrapper });
    // Click on variedad name
    await userEvent.click(screen.getByText("Lapins"));
    // Should show detail view with Edit/Delete buttons
    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(screen.getByText("Eliminar")).toBeInTheDocument();
  });

  it("CrudForm opens when clicking Editar in DETAIL view", async () => {
    const { VariedadesPage } = await import("@/pages/mantenedores/VariedadesPage");
    render(<VariedadesPage />, { wrapper });
    // Enter detail view
    await userEvent.click(screen.getByText("Lapins"));
    // Click Editar
    await userEvent.click(screen.getByText("Editar"));
    // Form dialog should be visible with "Editar Variedad" title
    expect(screen.getByText("Editar Variedad")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC MANTENEDOR PAGES (Campos, Viveros, PMG)
// ═══════════════════════════════════════════════════════════════════════════

describe("GenericMantenedorPage: buttons and dialogs", () => {
  beforeEach(() => {
    vi.doMock("@/hooks/useCrud", () => ({
      useCrud: () => ({
        data: [{ id_pais: 1, codigo: "CL", nombre: "Chile", activo: true }],
        isLoading: false,
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        isCreating: false,
        isUpdating: false,
      }),
    }));
  });

  it("Nuevo button opens CrudForm", async () => {
    const { PaisesPage } = await import("@/pages/mantenedores/PaisesPage");
    render(<PaisesPage />, { wrapper });
    await userEvent.click(screen.getByText("Nuevo"));
    expect(screen.getByText(/Nuevo Paises/i) || screen.getAllByText("Nuevo").length >= 1).toBeTruthy();
  });

  it("Edit button on card opens CrudForm", async () => {
    const { PaisesPage } = await import("@/pages/mantenedores/PaisesPage");
    render(<PaisesPage />, { wrapper });
    const editBtn = screen.getByText("Editar");
    await userEvent.click(editBtn);
    expect(screen.getByText(/Editar Paises/i) || screen.getByText("Actualizar")).toBeTruthy();
  });

  it("Delete button opens confirmation dialog", async () => {
    const { PaisesPage } = await import("@/pages/mantenedores/PaisesPage");
    render(<PaisesPage />, { wrapper });
    const delBtn = screen.getByText("Eliminar");
    await userEvent.click(delBtn);
    expect(screen.getByText("Confirmar eliminacion")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MERGE DIALOG
// ═══════════════════════════════════════════════════════════════════════════

describe("MergeDialog: renders and functions", () => {
  it("renders when open", async () => {
    const { MergeDialog } = await import("@/components/shared/MergeDialog");
    render(
      <MergeDialog
        open={true}
        onClose={vi.fn()}
        entidad="viveros"
        queryKey="viveros"
        items={[
          { value: 1, label: "Vivero A" },
          { value: 2, label: "Vivero B" },
        ]}
      />,
      { wrapper },
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // Items appear in both Origen and Destino dropdowns
    expect(screen.getAllByText("Vivero A").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Vivero B").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render when closed", async () => {
    const { MergeDialog } = await import("@/components/shared/MergeDialog");
    render(
      <MergeDialog
        open={false}
        onClose={vi.fn()}
        entidad="viveros"
        queryKey="viveros"
        items={[]}
      />,
      { wrapper },
    );
    expect(screen.queryByText(/Fusionar/)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CRUD FORM
// ═══════════════════════════════════════════════════════════════════════════

describe("CrudForm: renders fields and submits", () => {
  it("renders all field types correctly", async () => {
    const { CrudForm } = await import("@/components/shared/CrudForm");
    const fields = [
      { key: "nombre", label: "Nombre", type: "text" as const, required: true },
      { key: "desc", label: "Descripcion", type: "textarea" as const },
      { key: "activo", label: "Activo", type: "boolean" as const },
      { key: "tipo", label: "Tipo", type: "select" as const, options: [{ value: "a", label: "A" }] },
      { key: "num", label: "Cantidad", type: "number" as const },
    ];
    render(
      <CrudForm
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        fields={fields}
        title="Test Form"
      />,
      { wrapper },
    );
    expect(screen.getByText("Test Form")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Descripcion")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Tipo")).toBeInTheDocument();
    expect(screen.getByText("Cantidad")).toBeInTheDocument();
    expect(screen.getByText("Crear")).toBeInTheDocument();
  });

  it("shows 'Actualizar' button when initialData is set", async () => {
    const { CrudForm } = await import("@/components/shared/CrudForm");
    render(
      <CrudForm
        open={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        fields={[{ key: "nombre", label: "Nombre", type: "text" as const }]}
        initialData={{ nombre: "Test" }}
        title="Edit Form"
      />,
      { wrapper },
    );
    expect(screen.getByText("Actualizar")).toBeInTheDocument();
  });

  it("calls onSubmit with cleaned data", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { CrudForm } = await import("@/components/shared/CrudForm");
    render(
      <CrudForm
        open={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        fields={[{ key: "nombre", label: "Nombre", type: "text" as const, required: true }]}
        title="Submit Test"
      />,
      { wrapper },
    );
    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Nuevo Valor");
    await userEvent.click(screen.getByText("Crear"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Nuevo Valor" }));
  });
});
