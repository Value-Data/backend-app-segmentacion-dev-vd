import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { testblockService } from "@/services/testblock";
import { mantenedorService } from "@/services/mantenedores";
import type { Campo } from "@/types/maestras";

export function TestblockNewPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    id_campo: "",
    num_hileras: "",
    posiciones_por_hilera: "",
    temporada_inicio: "",
    notas: "",
  });

  const { data: campos } = useQuery({
    queryKey: ["campos"],
    queryFn: () => mantenedorService("campos").list(),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => testblockService.create(data),
    onSuccess: (tb) => {
      toast.success("TestBlock creado");
      navigate(`/testblocks/${tb.id_testblock}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      codigo: form.codigo,
      nombre: form.nombre,
      id_campo: Number(form.id_campo),
      num_hileras: form.num_hileras ? Number(form.num_hileras) : null,
      posiciones_por_hilera: form.posiciones_por_hilera ? Number(form.posiciones_por_hilera) : null,
      temporada_inicio: form.temporada_inicio || null,
      notas: form.notas || null,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/testblocks")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold text-garces-cherry">Nuevo TestBlock</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Codigo *</Label>
            <Input className="mt-1" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div>
            <Label>Nombre *</Label>
            <Input className="mt-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <Label>Campo *</Label>
            <Select value={form.id_campo} onValueChange={(v) => setForm({ ...form, id_campo: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar campo" /></SelectTrigger>
              <SelectContent>
                {((campos || []) as Campo[]).map((c) => (
                  <SelectItem key={c.id_campo} value={String(c.id_campo)}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Temporada Inicio</Label>
            <Input className="mt-1" value={form.temporada_inicio} onChange={(e) => setForm({ ...form, temporada_inicio: e.target.value })} placeholder="2024-2025" />
          </div>
          <div>
            <Label>Num. Hileras</Label>
            <Input type="number" className="mt-1" value={form.num_hileras} onChange={(e) => setForm({ ...form, num_hileras: e.target.value })} />
          </div>
          <div>
            <Label>Posiciones por Hilera</Label>
            <Input type="number" className="mt-1" value={form.posiciones_por_hilera} onChange={(e) => setForm({ ...form, posiciones_por_hilera: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Notas</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[80px]"
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? "Creando..." : "Crear TestBlock"}
        </Button>
      </form>
    </div>
  );
}
