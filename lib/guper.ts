import axios from 'axios';

const BASE_URL = process.env.GUPER_BASE_URL || "https://cloe.myguper.com/api";
const TOKEN = process.env.GUPER_TOKEN || "3d0131453cee9a7e540dbcd78eb9c8daf31761270b96c3f3d1405a898dda759a";
const HEADERS = {
  "x-guper-authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

const TAG_COMPLETO = "119";       // Completo
const TAG_PIN_VALIDATED = "207";  // PIN Validated

function normalizarFechaGuper(valor: any) {
  if (!valor) return "";
  if (typeof valor === "string") {
    return valor.includes("T") ? valor.split("T")[0] : valor.split(" ")[0];
  }
  if (valor.date) {
    return String(valor.date).includes("T") ? String(valor.date).split("T")[0] : String(valor.date).split(" ")[0];
  }
  return "";
}

function scoreClienteGuper(cliente: any, fechaEsperada?: string) {
  const tags = Array.isArray(cliente?.tags) ? cliente.tags : [];
  
  // Helper to get tag id/name
  const getTagId = (t: any) => String(t?.tag ?? t?.id ?? t?.tagId ?? "").trim();
  
  const tag119 = tags.find((t: any) => getTagId(t) === TAG_COMPLETO);
  const tag207 = tags.find((t: any) => getTagId(t) === TAG_PIN_VALIDATED);

  let score = 0;

  // Prioridad principal: cliente completo.
  if (tag119) score += 1000;

  // Luego prioridad a clientes con compras reales.
  const compras = Number(cliente?.rfm?.totalPurchases ?? 0);
  if (compras > 0) score += 600;

  if (fechaEsperada) {
    const fechaTag119 = normalizarFechaGuper(tag119?.createdAt);
    const fechaTag207 = normalizarFechaGuper(tag207?.createdAt);
    
    // Si el tag 119 fue creado justo en la fecha del reporte, debe ganar.
    if (fechaTag119 === fechaEsperada) score += 400;
    // PIN Validated ayuda a identificar el registro correcto.
    if (fechaTag207 === fechaEsperada) score += 300;
  }

  if (tag207) score += 200;

  // Validado en Guper.
  if (cliente?.validatedAt) score += 100;

  // Desempate por volumen de compras, sin dejar que domine todo.
  const valorCompras = Number(cliente?.rfm?.totalPurchaseValue ?? 0);
  score += Math.min(compras, 100);
  score += Math.min(Math.floor(valorCompras / 10000), 100);

  return score;
}

export async function getGuperCustomerByEmail(email: string, fechaEsperada?: string) {
  try {
    const emailKey = String(email || "").trim().toLowerCase();
    if (!emailKey || !emailKey.includes('@')) return null;

    // 1. Buscar lista de candidatos
    const listUrl = `${BASE_URL}/register/customer?q[email]=${encodeURIComponent(emailKey)}`;
    const listRes = await axios.get(listUrl, { headers: HEADERS });
    
    let candidatos = [];
    if (Array.isArray(listRes.data?.list)) {
      candidatos = listRes.data.list;
    } else if (Array.isArray(listRes.data)) {
      candidatos = listRes.data;
    }

    if (candidatos.length === 0) return null;

    // 2. Obtener detalles para cada candidato (para tener Tags y RFM completos)
    // Limitamos a los primeros 5 para evitar exceso de llamadas
    const detalles = await Promise.all(
      candidatos.slice(0, 5).map(async (c: any) => {
        const personId = c?.id;
        if (!personId) return c;
        try {
          const detUrl = `${BASE_URL}/register/customer/${personId}`;
          const detRes = await axios.get(detUrl, { headers: HEADERS });
          
          const payload = detRes.data;
          if (payload.id) return payload;
          if (payload.data?.id) return payload.data;
          if (payload.customer?.id) return payload.customer;
          if (payload.person?.id) return payload.person;
          
          return c;
        } catch (err) {
          return c;
        }
      })
    );

    // 3. Seleccionar el mejor según el Score
    const ordenados = detalles.sort((a: any, b: any) => {
      const sA = scoreClienteGuper(a, fechaEsperada);
      const sB = scoreClienteGuper(b, fechaEsperada);
      
      if (sB !== sA) return sB - sA;
      
      // Desempates adicionales por fechas
      const dateA = Date.parse(normalizarFechaGuper(a?.rfm?.lastPurchaseDate) || normalizarFechaGuper(a?.updatedAt) || "1970-01-01");
      const dateB = Date.parse(normalizarFechaGuper(b?.rfm?.lastPurchaseDate) || normalizarFechaGuper(b?.updatedAt) || "1970-01-01");
      
      return (dateB || 0) - (dateA || 0);
    });

    return ordenados[0];
  } catch (error) {
    console.error(`[Guper API] Error fetching email ${email}:`, error);
    return null;
  }
}
