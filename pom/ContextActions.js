class ContextActions {
    constructor(context) {
        this.context = context;
    }

    async setHttpCredentials(username, password) {
        await context.setHTTPCredentials({
            username: username,
            password: password
        });
    }



}
export default new ContextActions();