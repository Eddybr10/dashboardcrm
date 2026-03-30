const BASE_URL = process.env.GUPER_BASE_URL!;
const TOKEN = process.env.GUPER_TOKEN!;

const headers = {
  'x-guper-authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

export async function getGuperCustomerByEmail(email: string) {
  try {
    const url = `${BASE_URL}/register/customer?q[email]=${encodeURIComponent(email)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.list && data.list.length > 0) return data.list[0];
    return null;
  } catch {
    return null;
  }
}
