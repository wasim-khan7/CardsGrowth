// const {LoginPage}= require('./LoginPage.js');
// const {DashboardPage}= require('./DashboardPage.js');
// const {CartAndCheckoutPage}= require('./CartAndCheckoutPage.js');
const {MotiveSignupPage}= require('./motiveSignupPage.js');
class POManager{
    constructor(page, baseUrl){
        console.log('POManager constructor called');
        console.log('PO Manger received Base URL:', baseUrl);
        if(page){
console.log('PO Manger received Page:',page.url()
);
        }
        this.page=page;
        this.baseUrl=baseUrl;
        // this.loginPage= new LoginPage(this.page);
        // this.dashboardPage= new DashboardPage(this.page);
        // this.cartAndCheckoutPage=new CartAndCheckoutPage(this.page);
        this.motiveSignupPage=new MotiveSignupPage(this.page,baseUrl);
    
    }

    // getLoginPage(){
    //     return this.loginPage;
    // }
    // getDashboardPage(){
    //     return this.dashboardPage;
    // }   
    // getCartAndCheckoutPage(){
    //     return this.cartAndCheckoutPage;
    // }
    getMotiveSignupPage(){
        return this.motiveSignupPage;
    }
}


module.exports={POManager};