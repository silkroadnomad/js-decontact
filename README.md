# js-decontact 
An address book peer-to-peer protocol and local first smart contract built with Libp2p, Helia and OrbitDB

## Features
0. DID wallet (via seed phrase)
1. Alice requests address from Bob via DID
   - Alice gives write permission to Bob
   - Bob writes his contact data into Alice' address book
2. Bob is moving to a new city or country (contact data are changing) 
   - Bob automatically updates Alice's address book with his data
3. Auto-Sync of own devices with same seed phrase 
   - Having the same seed phrase on different devices results into auto replicated address books.
4. Restore all contacts from people who backuped up my data

## Todo
- [x] integrate into deContact.xyz
  - [ ] confirm dialog still missing in handleMessages (can be a callback method)
  - [ ] DID from seed phrase
  - [ ] Encryption
- [ ] alternative PublicKey for browser in combination with DIDIdentityProvider 
  - https://github.com/orbitdb/orbitdb/blob/main/test/identities/identities.test.js
- Test Bob-Bot 
  - start test-bot-node with fix DID 
  - answer automatically with address (write into Alice (requester) DB)
- [ ] browser based distributed storage protocol
- [ ] optional blockchain based handles
- [ ] optional blockchain based DIDs (Bitcoin, Doichain, Namecoin)

## Usage
```
npm i decontact
```

## Test 
1. Clone this repositoty
```
npm install
npm test
```
