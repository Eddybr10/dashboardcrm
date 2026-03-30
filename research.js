import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  console.log('--- Testing Guper API ---');
  const GUPER_BASE_URL = process.env.GUPER_BASE_URL;
  const GUPER_TOKEN = process.env.GUPER_TOKEN;
  const email = 'eddy201222@hotmail.com';
  const url = `${GUPER_BASE_URL}/register/customer?q[email]=${encodeURIComponent(email)}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        "x-guper-authorization": `Bearer ${GUPER_TOKEN}`,
        "Content-Type": "application/json",
      }
    });
    console.log('Guper Status:', res.status);
    const data = await res.json();
    console.log('Guper Data (keys):', Object.keys(data));
    console.log('Guper List Lenght:', data.list?.length);
    if (data.list?.length > 0) {
      console.log('First Record (keys):', Object.keys(data.list[0]));
    }
  } catch (e) {
    console.error('Guper Error:', e);
  }

  console.log('\n--- Testing MySQL Columns ---');
  try {
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQL_PORT || '3306'),
    });
    const [rows] = await pool.query('SELECT * FROM ordenes_enriquecidas LIMIT 1');
    if (rows.length > 0) {
      console.log('Columns in ordenes_enriquecidas:', Object.keys(rows[0]));
    } else {
      console.log('ordenes_enriquecidas is empty');
    }
    await pool.end();
  } catch (e) {
    console.error('MySQL Error:', e);
  }
}

test();
