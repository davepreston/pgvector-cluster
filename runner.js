// runner.js used purely for manual testing purposes

const { scan } = require('./index');

(async () => {
  console.time('cluster');
  // scan({ name: 'test 4', epsilon: 0.07, minPoints: 10 });
  // scan({ name: 'test 8', epsilon: 0.03, minPoints: 20 });
  // scan({ epsilon: 0.04, minPoints: 10 });
  const epsilon = 0.03;
  const minPoints = 5;
  const name = `timetest 2: ${epsilon}/${minPoints}`;

  await scan({ epsilon, minPoints, name });
  console.timeEnd('cluster');
})();
