import {getAddressRecords, sha256} from "./utils.js";
import { OrbitDBAccessController, useAccessController } from "@orbitdb/core";
import { fromString, toString } from 'uint8arrays';

/**
 * The gossip sub topic
 * @type {string}
 */
export const CONTENT_TOPIC = "/dContact/3/message/proto";


/**
 * DeContact - a local first smart contract and peer-to-peer address book protocol
 * @param orbitdb
 * @returns {Promise<{peerId: *, ipfs: *, getSubscriberList: (function(): *[]), newContact: (function(): {owner: string, lastName: string, city: string, postalCode: string, countryRegion: string, own: boolean, sharedAddress: string, stateProvince: string, firstName: string, street: string, _id: string, category: string, ipns: string}), getSyncedDevices: (function(): number), addContact: (function(*): Promise<*>), isPubSubMessageReceived: (function(): boolean), requestAddress: ((function(*): Promise<void>)|*), getMyAddressBook: (function(): *), stop: ((function(): Promise<void>)|*), identity: *, isRequesterDBReplicated: (function(): boolean), open: (function(): Promise<*>)}>}
 * @constructor
 */
const DeContact = async ({ orbitdb } = {}) => {

    const REQUEST_ADDRESS = 'REQUEST_ADDRESS';
    const ipfs = orbitdb.ipfs
    const libp2p = ipfs.libp2p
    const identity = orbitdb.identity
    const peerId = orbitdb.peerId
    let syncedDevices = 0
    let syncedFollowerDBs = 0
    let connectedPeers = 0
    let subscriberList = []

    let dbMyAddressBook
    let myAddresses = []
    let messageReceived = false
    let requesterDBReplicated = false

    if (orbitdb == null || libp2p == null){
        throw new Error('OrbitDB or libp2p instance is a required argument.')
    }

    /**
     * Opens deContact address book
     * @returns {Promise<any[]>} dbMyAddressBook (the orbitdb containing all addresses)
     */
    const open = async () => {

        const myDBName = await sha256(orbitdb.identity.id)
        useAccessController(OrbitDBAccessController)
        const ourContentTopic = CONTENT_TOPIC+"/"+orbitdb.identity.id
        libp2p.services.pubsub.subscribe(ourContentTopic)

        libp2p.addEventListener('connection:open',  async (c) => {
            console.log("connection:open",c.detail.remoteAddr.toString())
            connectedPeers++;
            if(connectedPeers>1) {
                await getAddressRecords(dbMyAddressBook);
            }
        });

        libp2p.addEventListener('connection:close', (c) => {
            console.log("connection:close",c.detail.id)
            connectedPeers--;
        });

        libp2p.services.pubsub.addEventListener('message', event => {
            const topic = event.detail.topic
            const message = toString(event.detail.data)
            messageReceived = true
            if(!topic.startsWith(CONTENT_TOPIC)) return
            handleMessage(message)
        })

        dbMyAddressBook = await orbitdb.open("/myAddressBook/"+myDBName, {
            type: 'documents',
            sync: true,
            AccessController: OrbitDBAccessController({ write: [orbitdb.identity.id]})
        })
    
        myAddresses = await getAddressRecords(dbMyAddressBook)
        initReplicationOfSubscriberDBs(orbitdb.identity.id)

        dbMyAddressBook.events.on('join', async (peerId, heads) => {
            console.log("one of my devices joined and synced my address book",peerId)
            syncedDevices++
            myAddresses = await getAddressRecords(dbMyAddressBook)
        })

        dbMyAddressBook.events.on('update', async (entry) => {
            console.log(`someone updated my address book with data: ${entry.id}`,entry?.payload?.value?.firstName)
            myAddresses = await getAddressRecords(dbMyAddressBook)
        })
        return dbMyAddressBook
    }

    /**
     * Loop through our address book and filter all our addresses where others are the owners
     * (we follow their addresses - we are the follower).
     *
     * Then initialize all databases we follow
     * @param ourDID our DID
     * @returns {Promise<void>}
     */
    async function initReplicationOfSubscriberDBs(ourDID) {
        const addressRecords = await dbMyAddressBook.all();
        subscriberList = addressRecords.filter((addr)=> {
            return addr.value.owner !== ourDID && addr.value.sharedAddress!==undefined //sharedAddress undefined for all not decentralized addresses
        })
        for (const s in subscriberList) {
            const dbAddress = subscriberList[s].value.sharedAddress
            subscriberList[s].db = await orbitdb.open(dbAddress, {type: 'documents',sync: true})
            subscriberList[s].db.events.on('join', async (peerId, heads) => syncedFollowerDBs++)
            subscriberList[s].db.all().then((records)=> { //replicate the addresses of Bob, Peter etc.
                // console.log(`subscriberList dbAddress: ${dbAddress} records`,records)
            })
        }
    }

    const contact = {
        _id: "",
        firstName: "",
        lastName: "",
        street: "",
        postalCode: "",
        city: "",
        stateProvince: "",
        countryRegion:"",
        ipns: "",
        owner: "",
        own: false,
        category: "business",
        sharedAddress: ""
    }

    /**
     * Returns a new empty contact object
     * @returns {{owner: string, lastName: string, city: string, postalCode: string, countryRegion: string, own: boolean, sharedAddress: string, stateProvince: string, firstName: string, street: string, _id: string, category: string, ipns: string}}
     */
    function newContact() {
        return contact
    }

    /**
     * Adds a new address record.
     * Sets owner, sharedAddress (our db.address) an _id (a sha256 of the original address)
     * returns a hash
     * @param addr
     * @returns {Promise<string>}
     */
    async function addContact(addr) {
        addr.owner = orbitdb.identity.id
        addr.sharedAddress = dbMyAddressBook.address
        addr._id = await sha256(JSON.stringify(addr))
        const hash = await dbMyAddressBook.put(addr)
        return hash
    }

    /**
     * 1. Save the current edited address into the Svelte storage (local only)
     * 2. Inform the subscribers about the address update
     * @returns {Promise<void>}
     */
    async function updateContact(_selectedAddr) {
        _selectedAddr.owner = orbitdb.identity.id
        await dbMyAddressBook.put(_selectedAddr)
        if(_selectedAddr.owner === orbitdb.identity.id){ //only send update requests if my own address was changed
            for (const s in  subscriberList) {
                console.log("updating address in ",subscriberList[s].db.address)
                subscriberList[s].db.put(_selectedAddr)
                // notify(`Updated db ${_subscriberList[s].db.address} `) //TODO publish an event about updated
            }
        }
    }

    /**
     * Deletes an address by its _id
     * @param _id
     * @returns {Promise<string>} hash of the deleted record
     */
    async function deleteContact(_id) {
        const hash = await dbMyAddressBook.del(_id)
        return hash
    }
    /**
     * dContact gossip sub protocol handler
     *
     * @param dContactMessage
     * @returns {Promise<void>}
     */
    async function handleMessage (dContactMessage) {
        if (!dContactMessage) return;
        const messageObj = JSON.parse(dContactMessage)
        let result, data, requesterDB
        if (messageObj.recipient === orbitdb.identity.id){
            switch (messageObj.command) {
                case REQUEST_ADDRESS:
                    data = JSON.parse(messageObj.data)
                    console.log("opening requester db",data.sharedAddress)
                    requesterDBReplicated = false
                    requesterDB = await orbitdb.open(data.sharedAddress, {type: 'documents',sync: true})
                    await requesterDB.all()
                    const onJoin = async (peerId, heads) => {
                        requesterDBReplicated = true
                        console.log("requesterDBReplicated",requesterDB.address)
                        result = "ONLY_HANDOUT" //TODO await confirm({data:messageObj, db:requesterDB, sender: messageObj.sender })
                        if(result){
                            if(result==='ONLY_HANDOUT'){
                                await writeMyAddressIntoRequesterDB(requesterDB); //Bob writes his address into Alice address book
                                //add a subscriber to our address book (should not be displayed in datatable
                                const subscriber  = { sharedAddress: data.sharedAddress, subscriber:true }
                                subscriber._id = await sha256(JSON.stringify(subscriber));
                                await dbMyAddressBook.put(subscriber)
                                console.log("ONLY_HANDOUT DONE")
                            }
                            else {
                                await writeMyAddressIntoRequesterDB(requesterDB);
                                await requestAddress(messageObj.sender)
                                //await addRequestersContactDataToMyDB(requesterDB,messageObj.sender) //we want to write Alice contact data into our address book same time
                                //TODO in case Bob want's to exchange the data he should just send another request to Alice (just as Alice did)
                            }
                            initReplicationOfSubscriberDBs(orbitdb.identity.id) //init replication of all subscriber ids
                        }else{
                            //TODO send "rejected sending address"
                        }
                    }
                    const isRes = await isRecipientInSenderDB(requesterDB, messageObj)
                    if (isRes) break;
                    requesterDB.events.on('join', onJoin)

                    break;
                default:
                    console.error(`Unknown command: ${messageObj.command}`);
            }
        }
    }

    /**
     * isRecipientInSenderDB
     * @param requesterDB
     * @param messageObj
     * @returns {Promise<boolean>}
     */
    async function isRecipientInSenderDB (requesterDB, messageObj){

        const records = await requesterDB.all()
        if(records.length>0){
            const isRecipient = records.filter(element => {
                return element.value.owner === messageObj.recipient
            });

            if(isRecipient.length>0 ) return true
        }
        return false
    }

    /**
     * When ever we want to send something out to a peer we create a message here
     * @param command
     * @param recipient
     * @param data
     * @returns {Promise<{data: (string|null), sender: *, recipient, command, timestamp: number}>}
     */
    async function createMessage(command, recipient, data = null) {
        const message = {
            timestamp: Date.now(),
            command,
            sender: orbitdb.identity.id,
            recipient,
            data: data ? JSON.stringify(data) : null,
        };
        message._id = await sha256(JSON.stringify(message));
        return message;
    }

    /**
     * 1. Bob requests an address from Alice via Pub Sub
     * 2. Bob adds write permission to Alice identity to his own address book //TODO please make sure Alice can only write up to 3 addresses into Bobs db and can only update and delte her own.
     * 3. Bob is so kind and backups Alice (encrypted) address db on his device by opening it.
     * @param scannedAddress
     * @returns {Promise<void>}
     */
    const requestAddress = async (_scannedAddress) => {
        const scannedAddress = _scannedAddress.trim()
        const data = { sharedAddress:dbMyAddressBook.address }
        await dbMyAddressBook.access.grant("admin",orbitdb.identity.id)
        await dbMyAddressBook.access.grant("write",scannedAddress) //the requested did (to write into my address book)
        await dbMyAddressBook.put({_id: scannedAddress}) //adding a dummy record for bob
        const msg = await createMessage(REQUEST_ADDRESS, scannedAddress,data);
        await libp2p.services.pubsub.publish(CONTENT_TOPIC+"/"+scannedAddress,fromString(JSON.stringify(msg)))
    }

    /**
     * Now we are writing our address directly into Alice address book (we got write permission)
     *
     * @param recipient
     * @param data
     * @returns {Promise<void>}
     */
    async function writeMyAddressIntoRequesterDB(requesterDB) {
        delete myAddresses[0].own;
        const hash = await requesterDB.put(myAddresses[0]);
        await requesterDB.del(orbitdb.identity.id);
        return hash
    }

    const isPubSubMessageReceived = () => {
        return messageReceived
    }

    const isRequesterDBReplicated = () => {
        return requesterDBReplicated
    }


    /**
     * Returns the number of connected ppers
     * @returns {number}
     */
    const getConnectedPeers = () => {
        return connectedPeers
    }


    /**
     * Returns the number of other devices synced with our db.
     * Could be one of our devices but could be also a follower which synced (backed) our devices
     * @returns {number}
     */
    const getSyncedDevices = () => {
        return syncedDevices
    }

    /**
     * Returns the number of synced dbs we follow (the dbs we backup)
     * @returns {number}
     */
    const getSyncedFollowerDBs = () => {
        return syncedFollowerDBs
    }

    /**
     * My addresses in an array ready to be rendered in a datatable component
     * @returns {*[]}
     */
    const getMyAddresses = () => {
        return myAddresses
    }

    /**
     * MyAddressBook as OrbitDB
     * @returns {*}
     */
    const getMyAddressBook = () => {
        return dbMyAddressBook
    }

    /**
     * List of subscriberList. When initialized containing the OrbitDB listening for updates via gossip-sub
     * @returns {*[]}
     */
    const getSubscriberList = () => {
        return subscriberList
    }

    /**
     * Stops deContact instance (and its OrbitDB)
     * @function stop
     * @instance
     * @async
     */
    const stop = async () => {
        orbitdb.stop()
    }

    return {
        open,
        stop,
        ipfs,
        identity,
        peerId,
        newContact,
        addContact,
        updateContact,
        deleteContact,
        getConnectedPeers,
        getMyAddresses,
        getMyAddressBook,
        getSyncedDevices,
        getSyncedFollowerDBs,
        getSubscriberList,
        requestAddress,
        isPubSubMessageReceived,
        isRequesterDBReplicated
    }
}

export { DeContact as default }