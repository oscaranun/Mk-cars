export const WHATSAPP_NUMBER = "5492615099230"
export const WHATSAPP_DISPLAY = "+54 9 2615 09-9230"

export const SERVICE_DAYS = { full: "Lunes a sábado", short: "Lun a Sáb" }
export const SERVICE_HOURS = { open: "9:00", close: "18:00" }

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const DEFAULT_WHATSAPP_MESSAGE =
  "Hola MK Cars, quiero reservar un lavado a domicilio."

export const VEHICLES = [
  {
    id: "auto",
    name: "Auto",
    detail: "Hatchback, sedán, coupé",
    price: 25000,
  },
  {
    id: "suv",
    name: "SUV / Crossover",
    detail: "SUV compacta y mediana",
    price: 30000,
  },
  {
    id: "pickup",
    name: "Pick-up / Utilitario",
    detail: "Camionetas, SUV grandes, vans",
    price: 35000,
  },
] as const

export type VehicleId = (typeof VEHICLES)[number]["id"]

export function formatARS(value: number) {
  return `$${value.toLocaleString("es-AR")}`
}

export const DEPARTMENTS = [
  {
    name: "Capital",
    areas: ["Centro", "Quinta Sección", "Sexta Sección", "Cuarta Sección", "Parque General San Martín", "Barrio Cívico", "Bombal", "San Agustín", "Barrio Jardín"],
  },
  {
    name: "Godoy Cruz",
    areas: ["Centro Godoy Cruz", "Villa Hipódromo", "Trapiche", "San Francisco del Monte", "Villa Marini", "Las Tortugas", "Benegas", "Palmares"],
  },
  {
    name: "Guaymallén",
    areas: ["Villa Nueva", "Dorrego", "San José", "Bermejo", "Rodeo de la Cruz", "Pedro Molina", "Belgrano", "Las Cañas", "Villa Ruiz", "Corralitos"],
  },
  {
    name: "Las Heras",
    areas: ["Centro Las Heras", "El Challao", "El Plumerillo", "El Resguardo", "Panquehua", "Ciudad de Las Heras", "El Algarrobal"],
  },
  {
    name: "Luján de Cuyo",
    areas: ["Chacras de Coria", "Vistalba", "Carrodilla", "Luján Centro", "Mayor Drummond", "Perdriel", "Agrelo", "La Puntilla"],
  },
  {
    name: "Maipú",
    areas: ["Maipú Centro", "Coquimbito", "Russell", "Luzuriaga", "General Gutiérrez", "Rodeo del Medio", "Barrancas", "Fray Luis Beltrán"],
  },
] as const
