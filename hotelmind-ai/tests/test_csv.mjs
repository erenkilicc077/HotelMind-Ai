import assert from 'node:assert/strict';
import {parseCSV,toCSV} from '../dist/assets/csv.js';
const header=['hotel','note'];
const rows=[['City Hotel','contains, comma'],['Resort Hotel','a "quote"\nand newline']];
assert.deepEqual(parseCSV('\uFEFF'+toCSV(header,rows)),[header,...rows]);
assert.deepEqual(parseCSV('a,b\r\n1,2\r\n\r\n'),[['a','b'],['1','2']]);
assert.throws(()=>parseCSV('a,b\n1,"open'));
assert.throws(()=>parseCSV('a,b\n1,"closed"bad'));
console.log('CSV parser: 4 cases passed');
