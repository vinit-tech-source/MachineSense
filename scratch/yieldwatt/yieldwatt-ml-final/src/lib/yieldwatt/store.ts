import { create } from "zustand";
import { bootstrapPlant, plantKpis, tickPlant, type MachineLive, type Plant } from "./plant";
import type { FaultKind } from "./types";

const initial = bootstrapPlant(42);

interface PlantStore {
  plant: Plant;
  kpis: ReturnType<typeof plantKpis>;
  epoch: number;
  tick: () => void;
  setFault: (id: string, fault: FaultKind) => void;
  machine: (id: string) => MachineLive | undefined;
}

export const usePlant = create<PlantStore>((set, get) => ({
  plant: initial,
  kpis: plantKpis(initial),
  epoch: 0,
  tick: () => {
    const plant = get().plant;
    tickPlant(plant);
    set({
      plant: { ...plant, machines: plant.machines.map((m) => ({ ...m })) },
      kpis: plantKpis(plant),
      epoch: get().epoch + 1,
    });
  },
  setFault: (id, fault) => {
    const plant = get().plant;
    const m = plant.machines.find((x) => x.engine.profile.id === id);
    if (!m) return;
    m.fault = fault;
    set({
      plant: { ...plant, machines: plant.machines.map((x) => ({ ...x })) },
      epoch: get().epoch + 1,
    });
  },
  machine: (id) => get().plant.machines.find((m) => m.engine.profile.id === id),
}));
