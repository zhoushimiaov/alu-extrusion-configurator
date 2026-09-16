import test from 'node:test';import assert from 'node:assert/strict';
const {migrateProfileConfig}=await import('../src/ui/persist.js');
test('legacy saved standard default migrates to exact GLB mode',()=>{assert.deepEqual(migrateProfileConfig({frameMode:'standard',bays:6}),{frameMode:'glb',bays:6,schemaVersion:2});assert.deepEqual(migrateProfileConfig({bays:4}),{bays:4,frameMode:'glb',schemaVersion:2});});
test('v2 explicit standard choice is preserved',()=>{assert.equal(migrateProfileConfig({schemaVersion:2,frameMode:'standard'}).frameMode,'standard');assert.equal(migrateProfileConfig({schemaVersion:2,frameMode:'glb'}).frameMode,'glb');});
