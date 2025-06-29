class GeneralUtility {
    randomDigits(length) {
        return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
    }
    randomPhoneNumber() {
        const firstDigit = Math.floor(Math.random() * 7) + 2;
        return firstDigit.toString() + this.randomDigits(9);
    }

    randomAlphaNumeric(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    }

}

module.exports = { GeneralUtility };