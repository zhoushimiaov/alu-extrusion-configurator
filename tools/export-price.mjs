import { MARKET } from '../src/config/market.js';
import { writeFileSync } from 'fs';
writeFileSync('tools/price_table.json', JSON.stringify(MARKET, null, 2), 'utf8');
console.log('price_table.json written:', JSON.stringify(MARKET).length, 'bytes');

