import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '@/components/shared/KpiCard';
import { Leaf } from 'lucide-react';

describe('KpiCard', () => {
  it('renders title and value', () => {
    render(<KpiCard title="Total Plantas" value={1250} icon={Leaf} />);
    expect(screen.getByText('Total Plantas')).toBeInTheDocument();
    expect(screen.getByText('1250')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<KpiCard title="Estado" value="Activo" icon={Leaf} />);
    expect(screen.getByText('Estado')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    const { container } = render(<KpiCard title="Test" value={42} icon={Leaf} />);
    // lucide-react icons render as SVG elements
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders trend when provided', () => {
    render(<KpiCard title="Plantas" value={100} icon={Leaf} trend="+12% este mes" />);
    expect(screen.getByText('+12% este mes')).toBeInTheDocument();
  });

  it('does not render trend when not provided', () => {
    render(<KpiCard title="Plantas" value={100} icon={Leaf} />);
    expect(screen.queryByText('+12% este mes')).not.toBeInTheDocument();
  });
});
