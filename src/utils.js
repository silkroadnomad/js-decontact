export async function sha256(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Gets all contact data from orbitdb and returns it in an array
 * firstname and lastname must be set.
 * @param _dbMyAddressBook
 * @returns {Promise<[]>}
 */
export async function getAddressRecords(_dbMyAddressBook) {
    if(!_dbMyAddressBook || _dbMyAddressBook.length===0) return
    const addressRecords = await _dbMyAddressBook.all();
    let transformedRecords = addressRecords.map(record => ({
        ...record.value,
        id: record.value._id
    }));
    transformedRecords = transformedRecords.filter((addr)=> {
        return addr.id !==undefined && addr.firstName !== undefined && addr.lastName
    })
    return transformedRecords
}