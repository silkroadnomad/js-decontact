import { strictEqual, notStrictEqual, ok } from 'assert'
import { rimraf } from 'rimraf'
import { createOrbitDB, isIdentity } from '@orbitdb/core'
import connectPeers from './utils/connect-nodes.js'
import createHelia from './utils/create-helia.js'
import {createDeContact} from "../src/index.js";
import waitFor from "./utils/wait-for.js";

describe('deContact basics', function () {
        this.timeout(5000)

        let ipfs1, ipfs2
        let orbitdb1
        let orbitdb2
        let deContactInstance1
        let deContactInstance2

        before(async () => {
                [ipfs1, ipfs2] = await Promise.all([
                    createHelia({ directory: './ipfs1' }),
                    createHelia({ directory: './ipfs2' })])
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

        describe('DeContact instance creation - defaults', () => {
                before(async () => {
                        await rimraf('./orbitdb1')
                        await rimraf('./orbitdb2')
                        orbitdb1 = await createOrbitDB({ ipfs: ipfs1, id: 'user1', directory: './orbitdb1' })
                        deContactInstance1 = await createDeContact({ orbitdb: orbitdb1 })

                        orbitdb2 = await createOrbitDB({ ipfs: ipfs2,  id: 'user2', directory: './orbitdb2'  })
                        deContactInstance2 = await createDeContact({ orbitdb: orbitdb2 })
                })

                after(async () => {
                        if (deContactInstance1) {
                                await deContactInstance1.stop()
                        }
                        if (deContactInstance2) {
                                await deContactInstance2.stop()
                        }
                        await rimraf('./orbitdb1')
                        await rimraf('./orbitdb2')
                })

                it('create address book for alice and bob', async () => {
                        const aliceAddrDB = await deContactInstance1.open()
                        const aliceContactData = deContactInstance1.newContact()
                        aliceContactData.own  = true
                        aliceContactData.category  = 'private'
                        aliceContactData.firstName = "Alice"
                        aliceContactData.lastName = "Brown"
                        aliceContactData.city = "Montpellier"
                        const hashAliceAdded = await deContactInstance1.addContact(aliceContactData)
                        ok(hashAliceAdded);
                        let aliceRecords = await aliceAddrDB.all()
                        strictEqual(1,aliceRecords.length)
                        strictEqual(aliceRecords[0].value.firstName,"Alice")

                        const bobAddrDB = await deContactInstance2.open()
                        const bobContactData = deContactInstance2.newContact()
                        bobContactData.own  = true
                        bobContactData.category  = 'private'
                        bobContactData.firstName = 'Bob'
                        bobContactData.lastName = 'Serio'
                        bobContactData.city = 'Firenze'
                        const hashBobAdded = await deContactInstance2.addContact(bobContactData)
                        ok(hashBobAdded);
                        let bobRecords = await bobAddrDB.all()
                        strictEqual(1,bobRecords.length)
                        strictEqual(bobRecords[0].value.firstName,"Bob")

                        //2. Alice sends an address request to Bob
                        await deContactInstance1.requestAddress(deContactInstance2.identity.id)

                        //3. Bob should receive a gossip sub call
                        await waitFor(() => deContactInstance2.isPubSubMessageReceived(), () => true)

                        //4. Bob replicated Alice db successfully and writes his address into Alice's address book
                        await waitFor(() => deContactInstance2.isRequesterDBReplicated(), () => true)

                        //5. Alice address book is synced (and has Bobs contact data)
                        await waitFor(() => deContactInstance1.getSyncedDevices(), () => 1) //TODO why twice?
                        await waitFor(() => deContactInstance1.getSyncedDevices(), () => 1)
                        aliceRecords = await aliceAddrDB.all()

                        strictEqual(aliceRecords[0].value.firstName,'Alice')
                        strictEqual(aliceRecords[0].value.city,'Montpellier')

                        strictEqual(aliceRecords[1].value.firstName,'Bob')
                        strictEqual(aliceRecords[1].value.city,'Firenze')

                        //6. Bob now has a subscriberlist
                        const subscriberListAlice = deContactInstance1.getSubscriberList()
                        strictEqual(subscriberListAlice.length,0)
                        const subscriberListBob = deContactInstance2.getSubscriberList()
                        strictEqual(subscriberListBob.length,1)

                        // const syncedFollowerDbs = await deContactInstance2.getSynchedFollowerDBs()
                        // console.log("syncedFollowerDbs",syncedFollowerDbs)

                })
        })
});