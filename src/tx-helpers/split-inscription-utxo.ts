import { bitcoin } from "../bitcoin-core";
import { UTXO_DUST } from "../constants";
import { ErrorCodes, WalletUtilsError } from "../error";
import {
  InscriptionUnit,
  InscriptionUnspendOutput,
  Transaction,
  utxoHelper,
} from "../transaction";
import { ToSignInput, UnspentOutput } from "../types";

export function splitInscriptionUtxo({
  btcUtxos,
  assetUtxo,
  network,
  changeAddress,
  feeRate,
  enableRBF = true,
  outputValue = 546,
}: {
  btcUtxos: UnspentOutput[];
  assetUtxo: UnspentOutput;
  network: bitcoin.Network;
  changeAddress: string;
  feeRate?: number;
  enableRBF?: boolean;
  outputValue?: number;
}) {
  if (utxoHelper.hasAnyAssets(btcUtxos)) {
    throw new WalletUtilsError(ErrorCodes.NOT_SAFE_UTXOS);
  }

  if (utxoHelper.hasAtomicals([assetUtxo])) {
    throw new WalletUtilsError(ErrorCodes.NOT_SAFE_UTXOS);
  }

  const tx = new Transaction(network, feeRate, changeAddress, enableRBF);

  const toSignInputs: ToSignInput[] = [];

  let lastUnit: InscriptionUnit = null;
  let splitedCount = 0;
  const ordUtxo = new InscriptionUnspendOutput(assetUtxo, outputValue);
  tx.addInput(ordUtxo.utxo);
  toSignInputs.push({ index: 0, publicKey: ordUtxo.utxo.pubkey });

  let tmpOutputCounts = 0;
  for (let j = 0; j < ordUtxo.inscriptionUnits.length; j++) {
    const unit = ordUtxo.inscriptionUnits[j];
    if (unit.hasInscriptions()) {
      tx.addChangeOutput(unit.satoshis);
      lastUnit = unit;
      tmpOutputCounts++;
      splitedCount++;
      continue;
    }
    tx.addChangeOutput(unit.satoshis);
    lastUnit = unit;
  }

  if (!lastUnit.hasInscriptions()) {
    tx.removeChangeOutput();
  }

  if (lastUnit.satoshis < UTXO_DUST) {
    lastUnit.satoshis = UTXO_DUST;
  }

  const _toSignInputs = tx.addSufficientUtxosForFee(btcUtxos);
  toSignInputs.push(..._toSignInputs);

  const psbt = tx.toPsbt();

  return { psbt, toSignInputs, splitedCount };
}
