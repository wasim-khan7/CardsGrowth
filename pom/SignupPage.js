import UtilitiyFunctions from "./UtilitiyFunctions";
const UtilitiyFunctions = new UtilitiyFunctions();

class SignupPage {
    constructor(page, contextName, baseEmail, runCount) {
        this.page = page;
        this.contextName = contextName;
        this.baseEmail = baseEmail;
        this.runCount = runCount;

    }

    async stagingSignupFirstStepFiller() {
        
        await page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
        await page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
        await page.getByRole('textbox', { name: '(222) 222-' }).fill(UtilitiyFunctions.randomPhoneNumber());
        await page.getByRole('textbox', { name: 'Extension' }).fill(UtilitiyFunctions.randomDigits(5));
        await page.getByRole('textbox', { name: 'example@website.com' }).click();

        const emailContextName = contextName.replace(/\s+/g, '_').toLowerCase();
        const [local, domain] = baseEmail.split('@');
        email = `${local}+${emailContextName}_${runCount}@${domain}`;
        await page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

        await page.locator('#user_password').fill('Nopass@1234');
        await page.getByText('I have read and accept the').click();
        await page.getByRole('button', { name: 'Next' }).click();

    }
    
export default SignupPage;
