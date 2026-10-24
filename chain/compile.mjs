// Compiles contracts with solc-js and writes ABI + bytecode to build/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import solc from 'solc';

const files = ['AppendVerifier.sol', 'RecordRegistry.sol'];
const sources = Object.fromEntries(files.map((f) => [f, { content: readFileSync(`contracts/${f}`, 'utf8') }]));
const input = {
  language: 'Solidity',
  sources,
  settings: { optimizer: { enabled: true, runs: 1 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.bytecode.linkReferences'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
if (errors.length) { console.error(errors.map((e) => e.formattedMessage).join('\n')); process.exit(1); }
mkdirSync('build', { recursive: true });
for (const [file, name] of [['AppendVerifier.sol', 'HonkVerifier'], ['RecordRegistry.sol', 'RecordRegistry']]) {
  const c = out.contracts[file][name];
  const linkReferences = c.evm.bytecode.linkReferences;
  // external libraries the verifier must be linked against (deployed first, see deploy helper)
  const libraries = Object.entries(linkReferences).flatMap(([f, libs]) => Object.keys(libs).map((l) => {
    const lib = out.contracts[f][l];
    return { file: f, name: l, abi: lib.abi, bytecode: '0x' + lib.evm.bytecode.object };
  }));
  writeFileSync(`build/${name}.json`, JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, linkReferences, libraries }));
  if (libraries.length) console.log(name, 'links', libraries.map((l) => l.name).join(', '));
  console.log(name, 'bytecode', c.evm.bytecode.object.length / 2, 'bytes');
}
