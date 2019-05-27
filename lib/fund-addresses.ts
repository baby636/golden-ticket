// imports
import { BITBOX } from "bitbox-sdk"
import { AddressUtxoResult } from "bitcoin-com-rest"
import { ECPair, HDNode } from "bitcoincashjs-lib"
import {
  FundAddressesResult,
  Wallet
} from "./interfaces/GoldenTicketInterfaces"

// consts
const bitbox: BITBOX = new BITBOX()
const prompt: any = require("prompt")

// Open the wallet generated with generate-wallet.
const main: any = async (): Promise<any> => {
  // start the prompt to get user input
  prompt.start()

  // ask for language, hdpath and walletFileName
  prompt.get(
    ["hdAccount", "ticketCount"],
    async (err: any, result: FundAddressesResult): Promise<any> => {
      try {
        const wallet: Wallet = require(`../goldenTicketWallet.json`)
        const ticketCount: number = parseInt(result.ticketCount)

        const rootSeed: Buffer = bitbox.Mnemonic.toSeed(wallet.mnemonic)

        const masterHDNode: HDNode = bitbox.HDNode.fromSeed(rootSeed)

        const mothership: HDNode = bitbox.HDNode.derivePath(
          masterHDNode,
          wallet.mothership.hdPath
        )

        const mothershipAddress: string = bitbox.HDNode.toCashAddress(
          mothership
        )
        console.log("mothership addy", mothershipAddress)
        // return

        // HDNode of BIP44 account
        const account: HDNode = bitbox.HDNode.derivePath(
          masterHDNode,
          `m/44'/145'/${result.hdAccount ? result.hdAccount : 0}'`
        )

        const utxos:
          | AddressUtxoResult
          | AddressUtxoResult[] = await bitbox.Address.utxo(mothershipAddress)
        if (!Array.isArray(utxos)) {
          console.log(utxos.utxos[0])
          if (!utxos.utxos[0]) return

          const transactionBuilder = new bitbox.TransactionBuilder()
          const originalAmount: number = utxos.utxos[0].satoshis

          const vout: number = utxos.utxos[0].vout

          const txid: string = utxos.utxos[0].txid

          transactionBuilder.addInput(txid, vout)

          const byteCount: number = bitbox.BitcoinCash.getByteCount(
            { P2PKH: 1 },
            { P2PKH: ticketCount }
          )

          const sendAmount: number = originalAmount - byteCount

          const iterator: number = 0
          for (let i: number = iterator; i < ticketCount + iterator; i++) {
            // derive the ith external change address HDNode
            const node: HDNode = bitbox.HDNode.derivePath(account, `0/${i}`)

            // get the cash address
            const cashAddress: string = bitbox.HDNode.toCashAddress(node)
            const wif: string = bitbox.HDNode.toWIF(node)

            console.log(i, cashAddress, wif)
            // add output w/ address and amount to send
            transactionBuilder.addOutput(
              cashAddress,
              Math.floor(sendAmount / ticketCount)
            )
          }

          const keyPair: ECPair = bitbox.HDNode.toKeyPair(mothership)

          // sign w/ HDNode
          let redeemScript: undefined
          transactionBuilder.sign(
            0,
            keyPair,
            redeemScript,
            transactionBuilder.hashTypes.SIGHASH_ALL,
            originalAmount
          )

          // build tx
          const tx: any = transactionBuilder.build()
          // output rawhex
          const hex: string = tx.toHex()
          console.log("HEX: ", hex)

          // sendRawTransaction to running BCH node
          const success: string = await bitbox.RawTransactions.sendRawTransaction(
            hex
          )
          console.log("Success! TXID: ", success)
        }
      } catch (err) {
        console.log(
          `Could not open goldenTicketWallet.json. Generate a mnemonic with generate-wallet first.
      Exiting.`
        )
        process.exit(0)
      }
    }
  )
}

main()
