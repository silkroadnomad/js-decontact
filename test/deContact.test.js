import { strictEqual, notStrictEqual, ok } from 'assert'
import { rimraf } from 'rimraf'
import fs from 'fs'
import path from 'path'
import { createOrbitDB, isIdentity } from '@orbitdb/core'
import connectPeers from './utils/connect-nodes.js'
import createHelia from './utils/create-helia.js'
import {createDeContact} from "../src/index.js";

describe('deContact basics', function () {
        this.timeout(5000)

        let ipfs1, ipfs2
        let orbitdb1
        let deContact1

        before(async () => {
                [ipfs1, ipfs2] = await Promise.all([createHelia(), createHelia()])
                await connectPeers(ipfs1, ipfs2)
        })

        after(async () => {
                if (ipfs1) {
                        await ipfs1.stop()
                }
                if (ipfs2) {
                        await ipfs2.stop()
                }
                await rimraf('./ipfs1')
                await rimraf('./ipfs2')
        })

        describe('OrbitDB instance creation - defaults', () => {
                before(async () => {
                        await rimraf('./orbitdb')
                        orbitdb1 = await createOrbitDB({ ipfs: ipfs1 })
                })

                after(async () => {
                        if (orbitdb1) {
                                await orbitdb1.stop()
                        }
                        await rimraf('./orbitdb')
                })

                it('has an IPFS instance', async () => {
                        notStrictEqual(orbitdb1.ipfs, undefined)
                        strictEqual(typeof orbitdb1.ipfs, 'object')
                })


                it('has the IPFS instance given as a parameter', async () => {
                        const { id: expectedId } = ipfs1.libp2p.peerId
                        const { id: resultId } = orbitdb1.ipfs.libp2p.peerId
                        strictEqual(expectedId, resultId)
                })

                it('has a directory', async () => {
                        notStrictEqual(orbitdb1.directory, undefined)
                        strictEqual(typeof orbitdb1.directory, 'string')
                })

                it('has the directory given as a parameter', async () => {
                        strictEqual(orbitdb1.directory, './orbitdb')
                })

                it('has a keystore', async () => {
                        notStrictEqual(orbitdb1.keystore, undefined)
                        strictEqual(typeof orbitdb1.keystore, 'object')
                })

                it('has a keystore that contains a private key for the created identity', async () => {
                        const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id)
                        notStrictEqual(privateKey, undefined)
                        strictEqual(privateKey.constructor.name, 'Secp256k1PrivateKey')
                        notStrictEqual(privateKey._key, undefined)
                        notStrictEqual(privateKey._publicKey, undefined)
                })

                it('has a keystore that contains a public key that matches the identity\'s public key', async () => {
                        const privateKey = await orbitdb1.keystore.getKey(orbitdb1.identity.id)
                        const publicKey = await orbitdb1.keystore.getPublic(privateKey)
                        notStrictEqual(publicKey, undefined)
                        strictEqual(typeof publicKey, 'string')
                        strictEqual(publicKey, orbitdb1.identity.publicKey)
                })

                it('creates a directory for the keystore', async () => {
                        const directoryExists = fs.existsSync(path.join('./orbitdb/keystore'))
                        strictEqual(directoryExists, true)
                })

                it('has an identity', async () => {
                        notStrictEqual(orbitdb1.identity, undefined)
                        strictEqual(typeof orbitdb1.identity, 'object')
                })

                it('creates a valid identity', async () => {
                        strictEqual(isIdentity(orbitdb1.identity), true)
                })
        })

        describe('DeContact instance creation - defaults', () => {
                before(async () => {
                        await rimraf('./orbitdb')
                        deContact1 = await createDeContact({ orbitdb: orbitdb1 })
                })

                after(async () => {
                        if (deContact1) {
                                await deContact1.stop()
                        }
                        await rimraf('./orbitdb')
                })
                it('open deContact', async () => {
                        ok(deContact1.identity);
                        strictEqual( await deContact1.open(), true)
                })
        })
});