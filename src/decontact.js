

const DeContact = async ({ orbitdb } = {}) => {

    console.log("orbitdb",orbitdb)
    const ipfs = orbitdb.ipfs
    const identity = orbitdb.identity
    const peerId = orbitdb.peerId

    if (orbitdb == null) {
        throw new Error('OrbitDB instance is a required argument.')
    }

    /**
     * Opens deContact address book
     * @returns {Promise<void>}
     */
    const open = async () => {

        return true
    }
    /**
     * Stops deContact
     * @function stop
     * @instance
     * @async
     */
    const stop = async () => {
        orbitdb.stop()
    }

    return {
        // id,
        open,
        stop,
        ipfs,
        // directory,
        // keystore,
        identity,
        peerId
    }
}

export { DeContact as default }