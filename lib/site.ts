export const WHATSAPP_NUMBER = "5492615099230"
export const WHATSAPP_DISPLAY = "+54 9 2615 09-9230"

export const INSTAGRAM_HANDLE = "mkcars.mza"
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`

export const SERVICE_DAYS = { full: "Lunes a sábado", short: "Lun a Sáb" }
export const SERVICE_HOURS = { open: "9:00", close: "18:00" }

export const TIME_SLOTS = ["9:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

export function whatsappUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const DEFAULT_WHATSAPP_MESSAGE = "Hola MK Cars, quiero reservar un lavado a domicilio."

export const VEHICLES = [
  {
    id: "auto",
    name: "Auto",
    detail: "Hatchback, sedán y coupé",
    price: 25000,
    image: "/images/car-auto.png",
  },
  {
    id: "suv",
    name: "SUV",
    detail: "SUV y crossover",
    price: 30000,
    image: "/images/car-suv.png",
  },
  {
    id: "pickup",
    name: "Pick-up",
    detail: "Pick-up y utilitarios",
    price: 35000,
    image: "/images/car-pickup.png",
  },
] as const

export type VehicleId = (typeof VEHICLES)[number]["id"]

export const SERVICES = [
  { id: "agua-propia", name: "Lavado con agua propia", detail: "Llevamos nuestra agua" },
  { id: "agua-domicilio", name: "Lavado con agua del domicilio", detail: "Usamos tu agua corriente" },
] as const

export function formatARS(value: number) {
  return `$${value.toLocaleString("es-AR")}`
}

export const COVERAGE_ZONES = [
  "Capital",
  "Godoy Cruz",
  "Guaymallén",
  "Las Heras",
  "Luján de Cuyo",
  "Maipú",
] as const

export const COVERAGE_KEYWORDS = [
  "mendoza",
  "capital",
  "ciudad",
  "godoy cruz",
  "guaymallen",
  "las heras",
  "lujan",
  "maipu",
  "chacras",
  "vistalba",
  "carrodilla",
  "dorrego",
  "villa nueva",
  "san jose",
  "bermejo",
  "rodeo de la cruz",
  "el challao",
  "plumerillo",
  "panquehua",
  "russell",
  "coquimbito",
  "luzuriaga",
  "gutierrez",
  "trapiche",
  "villa hipodromo",
  "benegas",
  "quinta seccion",
  "sexta seccion",
  "cuarta seccion",
  "bombal",
  "barrio civico",
  "perdriel",
  "mayor drummond",
  "la puntilla",
  "palmares",
  "san francisco del monte",
  "villa marini",
]

export const GRAN_MENDOZA_BOUNDS = { latMin: -33.15, latMax: -32.75, lngMin: -69.0, lngMax: -68.6 }

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}
