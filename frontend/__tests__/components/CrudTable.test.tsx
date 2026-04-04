import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrudTable } from '@/components/shared/CrudTable';
import type { ColumnDef } from '@tanstack/react-table';

// Simple test data type
interface TestRow {
  id: number;
  nombre: string;
  estado: string;
}

const testColumns: ColumnDef<TestRow, unknown>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'nombre', header: 'Nombre' },
  { accessorKey: 'estado', header: 'Estado' },
];

const testData: TestRow[] = [
  { id: 1, nombre: 'Cereza', estado: 'activo' },
  { id: 2, nombre: 'Ciruela', estado: 'pendiente' },
  { id: 3, nombre: 'Durazno', estado: 'baja' },
];

describe('CrudTable', () => {
  it('renders data rows', () => {
    render(<CrudTable data={testData} columns={testColumns} />);
    expect(screen.getByText('Cereza')).toBeInTheDocument();
    expect(screen.getByText('Ciruela')).toBeInTheDocument();
    expect(screen.getByText('Durazno')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<CrudTable data={testData} columns={testColumns} />);
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByText('Estado')).toBeInTheDocument();
  });

  it('shows "Sin resultados" when data is empty', () => {
    render(<CrudTable data={[]} columns={testColumns} />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });

  it('shows "Cargando..." when isLoading is true', () => {
    render(<CrudTable data={[]} columns={testColumns} isLoading={true} />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('shows create button when onCreate is provided', () => {
    const onCreate = vi.fn();
    render(<CrudTable data={testData} columns={testColumns} onCreate={onCreate} />);
    const createBtn = screen.getByText('Nuevo');
    expect(createBtn).toBeInTheDocument();
  });

  it('calls onCreate when create button is clicked', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<CrudTable data={testData} columns={testColumns} onCreate={onCreate} />);
    await user.click(screen.getByText('Nuevo'));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it('does not show create button when onCreate is not provided', () => {
    render(<CrudTable data={testData} columns={testColumns} />);
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('uses custom createLabel', () => {
    const onCreate = vi.fn();
    render(
      <CrudTable data={testData} columns={testColumns} onCreate={onCreate} createLabel="Agregar Especie" />
    );
    expect(screen.getByText('Agregar Especie')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    render(<CrudTable data={testData} columns={testColumns} />);
    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument();
  });

  it('uses custom searchPlaceholder', () => {
    render(<CrudTable data={testData} columns={testColumns} searchPlaceholder="Filtrar especies..." />);
    expect(screen.getByPlaceholderText('Filtrar especies...')).toBeInTheDocument();
  });

  it('search filters data rows', async () => {
    const user = userEvent.setup();
    render(<CrudTable data={testData} columns={testColumns} />);

    const searchInput = screen.getByPlaceholderText('Buscar...');
    await user.type(searchInput, 'Cereza');

    // After filtering, only "Cereza" row should be visible
    expect(screen.getByText('Cereza')).toBeInTheDocument();
    expect(screen.queryByText('Ciruela')).not.toBeInTheDocument();
    expect(screen.queryByText('Durazno')).not.toBeInTheDocument();
  });

  it('shows edit and delete buttons when handlers are provided', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { container } = render(
      <CrudTable data={testData} columns={testColumns} onEdit={onEdit} onDelete={onDelete} />
    );
    // Each row should have action buttons (edit + delete per row = 6 buttons total for 3 rows)
    // Plus potentially the create button - but we didn't pass onCreate
    const actionButtons = container.querySelectorAll('tbody button');
    // 3 rows x 2 actions = 6 buttons
    expect(actionButtons.length).toBe(6);
  });
});
