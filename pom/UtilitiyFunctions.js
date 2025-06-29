class UtilityFunctions {
function randomDigits(length: number) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

function randomPhoneNumber() {
    const firstDigit = Math.floor(Math.random() * 7) + 2;
    return firstDigit.toString() + randomDigits(9);
}

function randomAlphaNumeric(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}



}
export default UtilityFunctions;
