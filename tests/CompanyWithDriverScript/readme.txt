companyAndDriverCreater.spec.ts also depends on the driverWorker.js 
driverWorker.js is separate because we its a node script which calls CPU OS level threads for multithreading, ( in order to be faster ),
thats why its not ideal to run it inside playwright test

