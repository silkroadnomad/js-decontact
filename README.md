# js-decontact
An simple address book peer-to-peer protocol built on Libp2p, Helia and OrbitDB

## Features
0. DID wallet (via seed phrase)
1. Alice requests address from Bob's DID
   - Alice gives write permission to Bob's DID
   - Bob writes his contact data into Alice' address book
2. Bob is moving to a new city or country (contact data are changing) 
   - Alice's address book is automatically updated by Bob
3. Auto-Sync of own devices with same seed phrase 
   - Having the same seed phrase on different devices results into auto replicated address books.

## Todo
- Test Bob-Bot 
  - start test-bot-node with fix DID 
  - answer automatically with address (write into Alice (requester) DB)
  - (optionally)
- DID from seed phrase
- Encryption
- Browser based distributed storage protocol
- Blockchain based handles
- Blockchain based DIDs (Bitcoin, Doichain, Namecoin)

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
