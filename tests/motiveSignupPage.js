
// import { MotiveUtilityFunctions } from "../utilities/MotiveUtilityFunctions";
// let motiveUtilityFunctions = new MotiveUtilityFunctions();

import { GeneralUtility } from "../utilities/generalUtility";
let generalUtility = new GeneralUtility();

class MotiveSignupPage {
  constructor(page, baseUrl) {
    this.page = page;
    this.baseUrl = baseUrl;
    this.url = `${this.baseUrl}/sign-up`;
    // this.email = 'muhammadwasimkhan8@gmail.com';
    // this.password = 'Nopass@1234';
    this.contextName = 'TestContext';
    this.baseEmail = 'wasim.khan@gomotive.com';
    this.runCount = 4;
    console.log('utility test', generalUtility.randomPhoneNumber());

  }
  async setupHttpCredentialsFirstTime() {
    await this.page.context().setHTTPCredentials({
      username: 'keeptruckin',
      password: 'kilokilo'
    });
    console.log('HTTP credentials setup for first load');
  }

  async setupHttpCredentials2ndTime() {
    await this.page.context().setHTTPCredentials({
      username: 'keeptruckin',
      password: 'kiloskilos'
    });
    console.log('HTTP credentials updated');
  }

  async navigate() {
    await this.setupHttpCredentialsFirstTime();
    await this.page.goto(this.url);
    await this.setupHttpCredentials2ndTime();
  }

  async stagingSignUpFirstPageFill() {
    await this.page.getByRole('textbox', { name: 'First Name' }).fill('Muhammad Wasim');
    await this.page.getByRole('textbox', { name: 'Last Name' }).fill('Khan');
    await this.page.getByRole('textbox', { name: '(222) 222-' }).fill(generalUtility.randomPhoneNumber());
    await this.page.getByRole('textbox', { name: 'Extension' }).fill(generalUtility.randomDigits(5));
    await this.page.getByRole('textbox', { name: 'example@website.com' }).click();

    const emailContextName = this.contextName.replace(/\s+/g, '_').toLowerCase();
    const [local, domain] = this.baseEmail.split('@');
    let email = `${local}+${emailContextName}_${this.runCount}@${domain}`;
    await this.page.getByRole('textbox', { name: 'example@website.com' }).fill(email);

    await this.page.locator('#user_password').fill('Nopass@1234');
    await this.page.getByText('I have read and accept the').click();
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

 async stagingSignUp2ndPageFill() {
        
        
        const WC = `WCS`;
        const street = '123 Main St';
        const city = 'Cleveland';
        const postalCode = generalUtility.randomDigits(5);
        const totalVehicles = 5;
        const companyName = `${WC} ${this.contextName} ${this.runCount} ${this.totalVehicles}`;
        await this.page.locator('#company_name').fill(companyName);
        await this.page.getByRole('textbox', { name: 'Street' }).fill(street);
        await this.page.getByRole('textbox', { name: 'City' }).fill(city);
        await this.page.getByRole('button', { name: 'Country' }).click();
        await this.page.getByRole('link', { name: 'United States' }).click();
        await this.page.getByRole('textbox', { name: 'Postal Code' }).fill(postalCode);
        await this.page.getByRole('button', { name: 'State/Province' }).click();
        await this.page.getByRole('link', { name: 'Alabama' }).click();
        await this.page.getByRole('textbox', { name: 'Total Vehicles' }).fill(totalVehicles.toString());
        await this.page.getByRole('button', { name: 'Go To Dashboard' }).click();
        await this.page.waitForTimeout(10000);
        await this.page.waitForLoadState('networkidle');
        await this.page.pause();

}
}
module.exports = { MotiveSignupPage };