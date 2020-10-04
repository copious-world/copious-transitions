
//>--
function hex_fromArrayOfBytes(arrayOfBytes) {
    const hexstr = arrayOfBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return(hexstr)
}
//--<
module.exports.hex_fromArrayOfBytes = hex_fromArrayOfBytes
//>--
function hex_fromTypedArray(byteArray){
    let arrayOfBytes = Array.from(byteArray)
    return(hex_fromArrayOfBytes(arrayOfBytes))
}
//--<
module.exports.hex_fromTypedArray = hex_fromTypedArray
//>--
function hex_fromByteArray(byteArray){
    return hex_fromTypedArray(ArrayOfBytes_toByteArray(byteArray))
}
//--<
module.exports.hex_fromByteArray = hex_fromByteArray
//>--
function hex_toArrayOfBytes(hexString) {
    let result = [];
    for ( let i = 0; i < hexString.length; i += 2 ) {
        result.push(parseInt(hexString.substr(i, 2), 16));
    }
    return result;
}
//--<
module.exports.hex_toArrayOfBytes = hex_toArrayOfBytes
//>--
function ArrayOfBytes_toByteArray(arrayOfBytes) {
    let byteArray = new Uint8Array(arrayOfBytes)
    return(byteArray)
}
//--<
module.exports.ArrayOfBytes_toByteArray = ArrayOfBytes_toByteArray
//>--
function hex_toByteArray(hexstr) {
    let aob = hex_toArrayOfBytes(hexstr)
    return ArrayOfBytes_toByteArray(aob)
}
//--<
module.exports.hex_toByteArray = hex_toByteArray


