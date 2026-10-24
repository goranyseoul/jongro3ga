// Generates the Solidity verifier for the append circuit (EVM target, keccak transcript).
import { readFileSync, writeFileSync } from 'node:fs';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';

const circuit = JSON.parse(readFileSync(new URL('./append/target/append.json', import.meta.url)));
const api = await Barretenberg.new();
const backend = new UltraHonkBackend(circuit.bytecode, api);
const vk = await backend.getVerificationKey({ verifierTarget: 'evm' });
const sol = await backend.getSolidityVerifier(vk, { verifierTarget: 'evm' });
writeFileSync(new URL('../chain/contracts/AppendVerifier.sol', import.meta.url), sol);
console.log('AppendVerifier.sol', sol.length, 'chars');
await api.destroy();
