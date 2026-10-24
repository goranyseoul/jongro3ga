// Deploys a compiled artifact, deploying and linking its external libraries first.
export async function deployArtifact(wallet, pub, artifact, args = []) {
  let code = artifact.bytecode.slice(2);
  for (const lib of artifact.libraries ?? []) {
    const libAddr = await deployRaw(wallet, pub, lib, []);
    for (const { start, length } of artifact.linkReferences[lib.file][lib.name]) {
      code = code.slice(0, start * 2) + libAddr.slice(2).toLowerCase() + code.slice((start + length) * 2);
    }
  }
  return deployRaw(wallet, pub, { abi: artifact.abi, bytecode: '0x' + code }, args);
}

async function deployRaw(wallet, pub, { abi, bytecode }, args) {
  const hash = await wallet.deployContract({ abi, bytecode, args });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error('deploy reverted');
  return rcpt.contractAddress;
}
