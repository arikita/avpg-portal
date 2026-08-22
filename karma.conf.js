// Cau hinh Karma toi thieu — chi ton tai de co launcher ChromeHeadlessNoSandbox.
// Chrome tren may chu nay khong bat duoc sandbox cua nhan (VM khong co user
// namespace) nen ban ChromeHeadless mac dinh sap ngay khi khoi dong.
//
// Builder la `@angular/build:karma` — no TU nap framework va plugin can thiet,
// nen o day KHONG khai bao frameworks/plugins (khai bao vao la loi module).
module.exports = function (config) {
  config.set({
    // Builder khong tu them 'jasmine' khi da co file config nay, phai khai bao.
    frameworks: ['jasmine'],
    plugins: [require('karma-jasmine'), require('karma-chrome-launcher')],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    reporters: ['progress'],
    restartOnFileChange: true,
  });
};
