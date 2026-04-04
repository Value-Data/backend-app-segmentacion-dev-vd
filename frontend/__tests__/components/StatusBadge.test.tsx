import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/shared/StatusBadge';

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="activo" />);
    expect(screen.getByText('activo')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<StatusBadge status="alta" />);
    const badge = screen.getByText('alta');
    expect(badge.tagName).toBe('SPAN');
  });

  it('applies green styles for "activo" status', () => {
    render(<StatusBadge status="activo" />);
    const badge = screen.getByText('activo');
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-800');
  });

  it('applies red styles for "baja" status', () => {
    render(<StatusBadge status="baja" />);
    const badge = screen.getByText('baja');
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-800');
  });

  it('applies yellow styles for "pendiente" status', () => {
    render(<StatusBadge status="pendiente" />);
    const badge = screen.getByText('pendiente');
    expect(badge.className).toContain('bg-yellow-100');
    expect(badge.className).toContain('text-yellow-800');
  });

  it('applies blue styles for "planificada" status', () => {
    render(<StatusBadge status="planificada" />);
    const badge = screen.getByText('planificada');
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-800');
  });

  it('applies fallback gray styles for unknown status', () => {
    render(<StatusBadge status="desconocido" />);
    const badge = screen.getByText('desconocido');
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-600');
  });

  it('is case-insensitive via toLowerCase', () => {
    render(<StatusBadge status="ACTIVO" />);
    const badge = screen.getByText('ACTIVO');
    // The component lowercases for lookup but renders the original text
    expect(badge.className).toContain('bg-green-100');
  });
});
