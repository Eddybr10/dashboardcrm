const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: '.env.local' });

// We need to use 'require' because this is a plain node script, 
// but our lib/guper.ts is likely using ES modules or needs transpile.
// However, since this is a Next.js project, we can try to run it with 'node' 
// if we mock the environment or use a tool.
// Alternatively, I'll just write the logic here directly to test the connection and logic.

const axios = require('axios');

const BASE_URL = process.env.GUPER_BASE_URL || "https://cloe.myguper.com/api";
const TOKEN = process.env.GUPER_TOKEN || "3d0131453cee9a7e540dbcd78eb9c8daf31761270b96c3f3d1405a898dda759a";
const HEADERS = {
  "x-guper-authorization": `Bearer ${TOKEN}`,
  "Content-Type": "application/json"
};

async function testGuperLogic(email) {
  console.log(`Testing Guper logic for: ${email}`);
  try {
    const listUrl = `${BASE_URL}/register/customer?q[email]=${encodeURIComponent(email)}`;
    const listRes = await axios.get(listUrl, { headers: HEADERS });
    const candidatos = listRes.data?.list || listRes.data || [];
    console.log(`Candidatos encontrados: ${candidatos.length}`);

    for (const c of candidatos.slice(0, 3)) {
      console.log(`- ID: ${c.id}, Name: ${c.name}`);
      try {
        const detUrl = `${BASE_URL}/register/customer/${c.id}`;
        const detRes = await axios.get(detUrl, { headers: HEADERS });
        const detail = detRes.data?.data || detRes.data?.customer || detRes.data;
        console.log(`  Tags: ${JSON.stringify(detail.tags?.map(t => t.tag || t.id))}`);
        console.log(`  RFM: ${JSON.stringify(detail.rfm)}`);
      } catch (e) {
        console.error(`  Error fetching detail for ${c.id}: ${e.message}`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

testGuperLogic('eddy201222@hotmail.com');
