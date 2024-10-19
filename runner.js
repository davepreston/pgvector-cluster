const { scan } = require('./index');

(async () => {
  console.time('cluster');
  // scan({ name: 'test 4', epsilon: 0.07, minPoints: 10 });
  // scan({ name: 'test 8', epsilon: 0.03, minPoints: 20 });
  // scan({ epsilon: 0.04, minPoints: 10 });

  await scan({ epsilon: 0.03, minPoints: 5 });
  console.timeEnd('cluster');
})();
